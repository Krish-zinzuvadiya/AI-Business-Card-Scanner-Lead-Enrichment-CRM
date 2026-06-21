const axios = require("axios");
const cheerio = require("cheerio");
const { compact, hostname, normalizeEmail, normalizePhone, normalizeUrl, unique, uniqueBy } = require("./text");
const { extractEmails, extractPhones } = require("./parser");

const blockedHosts = [
  "duckduckgo.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "google.com",
  "maps.google",
  "crunchbase.com",
  "zaubacorp.com",
  "justdial.com",
  "indiamart.com",
  "tradeindia.com",
  "yelp.com",
  "yellowpages.com"
];

const freeEmailHosts = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "rediffmail.com"
];

const companyNoiseWords = [
  "the",
  "and",
  "pvt",
  "private",
  "limited",
  "ltd",
  "llc",
  "inc",
  "corp",
  "corporation",
  "company",
  "co",
  "group",
  "india",
  "global"
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelayMs() {
  const min = Number(process.env.ENRICHMENT_MIN_DELAY_MS || 400);
  const max = Number(process.env.ENRICHMENT_MAX_DELAY_MS || 1200);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function client() {
  return axios.create({
    timeout: Number(process.env.ENRICHMENT_TIMEOUT_MS || 10000),
    maxRedirects: 4,
    headers: {
      "User-Agent": "BusinessCardCRM/1.0 (+public lead enrichment; contact page lookup)",
      Accept: "text/html,application/xhtml+xml"
    },
    validateStatus: (status) => status >= 200 && status < 400
  });
}

function isBlockedUrl(url) {
  const host = hostname(url);
  return !host || blockedHosts.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

function originUrl(url) {
  try {
    const parsed = new URL(normalizeUrl(url));
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch (_error) {
    return "";
  }
}

function decodeDuckDuckGoUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl, "https://duckduckgo.com");
    const uddg = parsed.searchParams.get("uddg");
    return normalizeUrl(uddg || parsed.toString());
  } catch (_error) {
    return normalizeUrl(rawUrl);
  }
}

function companyTokens(company) {
  const tokens = compact(company)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 2 && !companyNoiseWords.includes(token));

  return tokens.length ? tokens : compact(company).toLowerCase().split(/\s+/).filter(Boolean);
}

function rankSearchResult(result, company) {
  const host = hostname(result.url);
  const path = (() => {
    try {
      return new URL(result.url).pathname.toLowerCase();
    } catch (_error) {
      return "";
    }
  })();
  const terms = companyTokens(company);
  const haystack = `${host} ${result.text || ""}`.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (host.includes(term)) score += 8;
    if (haystack.includes(term)) score += 2;
  }
  if (/\.(com|in|co|io|net|org)$/.test(host)) score += 2;
  if (/official|home|contact|about|website/i.test(result.text || "")) score += 2;
  if (path === "/" || path === "") score += 2;
  score -= Math.min(path.split("/").filter(Boolean).length, 4);

  return score;
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function cleanEmails(values) {
  const preferred = uniqueBy(values, normalizeEmail).filter(
    (email) => validEmail(email) && !/(example|domain|email|sentry|wixpress|schema)\./i.test(email)
  );

  return preferred.sort((a, b) => emailPriority(b) - emailPriority(a));
}

function emailPriority(email) {
  const local = String(email).split("@")[0] || "";
  if (/^(info|contact|sales|hello|support|enquiry|enquiries|marketing|office)$/i.test(local)) return 3;
  if (/info|contact|sales|hello|support|enquiry|office/i.test(local)) return 2;
  return 1;
}

function cleanPhones(values) {
  return uniqueBy(values, normalizePhone).filter((phone) => {
    const digits = phone.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 16 && !/^(\d)\1+$/.test(digits);
  });
}

function socialUrl(url) {
  return /(linkedin\.com|facebook\.com|instagram\.com|twitter\.com|x\.com|youtube\.com)/i.test(url);
}

function absoluteUrl(baseUrl, href) {
  try {
    return normalizeUrl(new URL(href, baseUrl).toString());
  } catch (_error) {
    return "";
  }
}

async function searchDuckDuckGo(query, company) {
  const endpoints = [
    `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    `https://duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
  ];

  for (const url of endpoints) {
    try {
      const response = await client().get(url);
      const $ = cheerio.load(response.data);
      const results = [];

      $("a[href]").each((_index, element) => {
        const href = $(element).attr("href");
        const decoded = decodeDuckDuckGoUrl(href || "");
        if (!decoded || isBlockedUrl(decoded)) return;

        const text = compact(`${$(element).text()} ${$(element).closest(".result, tr, td").text()}`).slice(0, 1200);
        results.push({ url: decoded, text });
      });

      if (results.length) {
        return uniqueResults(results)
          .sort((a, b) => rankSearchResult(b, company) - rankSearchResult(a, company))
          .slice(0, Number(process.env.ENRICHMENT_SEARCH_RESULT_LIMIT || 8));
      }
    } catch (_error) {
      continue;
    }
  }

  return [];
}

function uniqueResults(results) {
  const byUrl = new Map();
  for (const result of results) {
    const url = normalizeUrl(result.url);
    if (!url) continue;

    const current = byUrl.get(url);
    if (current) {
      current.text = compact(`${current.text} ${result.text}`).slice(0, 1600);
    } else {
      byUrl.set(url, { ...result, url });
    }
  }

  return [...byUrl.values()];
}

async function searchCompanyPublicData(company) {
  const value = compact(company);
  if (!value) return emptyEnrichment();

  const queryLimit = Number(process.env.ENRICHMENT_SEARCH_QUERY_LIMIT || 2);
  const queries = [
    `"${value}" official website`,
    `"${value}" contact email phone`,
    `${value} contact us phone email`
  ].slice(0, queryLimit);

  const results = [];
  for (const query of queries) {
    results.push(...(await searchDuckDuckGo(query, value)));
    if (results.length >= Number(process.env.ENRICHMENT_SEARCH_RESULT_LIMIT || 8)) break;
  }

  const ranked = uniqueResults(results).sort((a, b) => rankSearchResult(b, value) - rankSearchResult(a, value));
  const snippets = ranked.map((result) => result.text).join("\n");

  return {
    websites: uniqueBy(ranked.map((result) => originUrl(result.url)), normalizeUrl).filter((url) => !isBlockedUrl(url)),
    emails: cleanEmails(extractEmails(snippets)),
    phones: cleanPhones(extractPhones(snippets)),
    linkedIn: ranked.map((result) => result.url).find((url) => /linkedin\.com/i.test(url)) || "",
    socialLinks: unique(ranked.map((result) => result.url).filter(socialUrl)),
    sources: unique(ranked.map((result) => result.url))
  };
}

async function searchOfficialWebsite(company) {
  const result = await searchCompanyPublicData(company);
  return result.websites;
}

function sameOrigin(baseUrl, nextUrl) {
  return hostname(baseUrl) === hostname(nextUrl);
}

function contactCandidateLinks(baseUrl, html) {
  const $ = cheerio.load(html);
  const found = [];

  $("a[href]").each((_index, element) => {
    const text = compact($(element).text()).toLowerCase();
    const href = $(element).attr("href");
    if (!href || /^mailto:|^tel:/i.test(href)) return;

    const absolute = absoluteUrl(baseUrl, href);
    if (!absolute || !sameOrigin(baseUrl, absolute)) return;

    const path = new URL(absolute).pathname.toLowerCase();
    if (
      text.includes("contact") ||
      text.includes("about") ||
      text.includes("reach") ||
      text.includes("support") ||
      path.includes("contact") ||
      path.includes("about") ||
      path.includes("reach") ||
      path.includes("support")
    ) {
      found.push(absolute);
    }
  });

  const common = ["/contact", "/contact-us", "/about", "/about-us", "/support"].map((path) =>
    normalizeUrl(new URL(path, baseUrl).toString())
  );

  return uniqueBy([baseUrl, ...found, ...common], normalizeUrl).slice(
    0,
    Number(process.env.ENRICHMENT_PAGE_LIMIT || 6)
  );
}

function collectStructuredData($) {
  const output = {
    emails: [],
    phones: [],
    websites: [],
    socialLinks: [],
    addresses: []
  };

  function visit(value, key = "") {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, key));
      return;
    }

    if (typeof value === "object") {
      if (/address/i.test(key)) {
        const address = Object.values(value)
          .filter((item) => typeof item === "string" || typeof item === "number")
          .join(", ");
        if (address) output.addresses.push(address);
      }
      Object.entries(value).forEach(([childKey, childValue]) => visit(childValue, childKey));
      return;
    }

    const text = compact(value);
    if (!text) return;

    if (/email/i.test(key)) output.emails.push(text);
    if (/telephone|phone|mobile|fax/i.test(key)) output.phones.push(text);
    if (/url|website/i.test(key)) output.websites.push(text);
    if (/sameas|social/i.test(key)) output.socialLinks.push(text);
  }

  $('script[type="application/ld+json"]').each((_index, element) => {
    try {
      visit(JSON.parse($(element).contents().text()));
    } catch (_error) {
      // Ignore invalid structured data; visible text extraction still runs.
    }
  });

  return output;
}

function extractSocialLinks(baseUrl, html) {
  const $ = cheerio.load(html);
  const links = [];

  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    const absolute = absoluteUrl(baseUrl, href || "");
    if (absolute && socialUrl(absolute)) links.push(absolute);
  });

  return uniqueBy(links, normalizeUrl).slice(0, 8);
}

function collectPageData(pageUrl, html) {
  const $ = cheerio.load(html);
  const hrefContacts = [];

  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href") || "";
    if (/^mailto:/i.test(href)) hrefContacts.push(decodeURIComponent(href.replace(/^mailto:/i, "").split("?")[0]));
    if (/^tel:/i.test(href)) hrefContacts.push(decodeURIComponent(href.replace(/^tel:/i, "").split("?")[0]));
  });

  const structured = collectStructuredData($);
  const visibleText = compact($("body").text());
  const emailBlob = [html, visibleText, ...hrefContacts, ...structured.emails].join("\n");
  const phoneBlob = [visibleText, ...hrefContacts, ...structured.phones].join("\n");
  const socialLinks = unique([
    ...extractSocialLinks(pageUrl, html),
    ...structured.socialLinks.map((url) => normalizeUrl(url)).filter(Boolean)
  ]);

  return {
    emails: cleanEmails(extractEmails(emailBlob)),
    phones: cleanPhones(extractPhones(phoneBlob)),
    websites: uniqueBy([pageUrl, ...structured.websites], normalizeUrl),
    linkedIn: socialLinks.find((url) => /linkedin\.com/i.test(url)) || "",
    socialLinks,
    address: structured.addresses.map(compact).find(Boolean) || ""
  };
}

async function fetchHtml(url) {
  const response = await client().get(url, {
    responseType: "text",
    transformResponse: [(data) => data]
  });
  return String(response.data || "").slice(0, 700000);
}

async function scrapeWebsite(baseUrl) {
  const normalizedBase = normalizeUrl(baseUrl);
  if (!normalizedBase || isBlockedUrl(normalizedBase)) return emptyEnrichment();

  const aggregate = emptyEnrichment();
  const sources = [];
  let pageLinks = [normalizedBase];

  try {
    const homeHtml = await fetchHtml(normalizedBase);
    sources.push(normalizedBase);
    mergeCollected(aggregate, collectPageData(normalizedBase, homeHtml));
    pageLinks = contactCandidateLinks(normalizedBase, homeHtml);
  } catch (_error) {
    pageLinks = [normalizedBase];
  }

  for (const link of pageLinks.filter((link) => link !== normalizedBase)) {
    try {
      const html = await fetchHtml(link);
      sources.push(link);
      mergeCollected(aggregate, collectPageData(link, html));
    } catch (_error) {
      continue;
    }
  }

  aggregate.website = normalizedBase;
  aggregate.websites = uniqueBy([normalizedBase, ...aggregate.websites], normalizeUrl);
  aggregate.email = aggregate.emails[0] || "";
  aggregate.phone = aggregate.phones[0] || "";
  aggregate.sources = unique(sources);
  return aggregate;
}

function emptyEnrichment() {
  return {
    website: "",
    websites: [],
    email: "",
    emails: [],
    phone: "",
    phones: [],
    linkedIn: "",
    socialLinks: [],
    address: "",
    sources: []
  };
}

function mergeCollected(target, next) {
  target.websites = uniqueBy([...(target.websites || []), next.website, ...(next.websites || [])], normalizeUrl);
  target.emails = cleanEmails([...(target.emails || []), next.email, ...(next.emails || [])]);
  target.phones = cleanPhones([...(target.phones || []), next.phone, ...(next.phones || [])]);
  target.linkedIn = target.linkedIn || next.linkedIn || "";
  target.socialLinks = unique([...(target.socialLinks || []), ...(next.socialLinks || [])]);
  target.address = target.address || next.address || "";
  target.sources = unique([...(target.sources || []), ...(next.sources || [])]);
  target.website = target.website || target.websites[0] || "";
  target.email = target.email || target.emails[0] || "";
  target.phone = target.phone || target.phones[0] || "";
  return target;
}

function leadEmails(lead) {
  return cleanEmails([lead.email, ...(lead.emails || [])]);
}

function leadPhones(lead) {
  return cleanPhones([lead.phone, ...(lead.phones || [])]);
}

function leadWebsites(lead) {
  return uniqueBy([lead.website, ...(lead.websites || [])], normalizeUrl);
}

function deriveWebsiteFromEmails(emails) {
  for (const email of emails) {
    const domain = String(email).split("@")[1] || "";
    const host = domain.replace(/^www\./, "").toLowerCase();
    if (!host || freeEmailHosts.includes(host)) continue;
    return normalizeUrl(host);
  }

  return "";
}

function needsEnrichment(lead) {
  if (process.env.ENABLE_ENRICHMENT === "false") return false;

  const emails = leadEmails(lead);
  const phones = leadPhones(lead);
  const websites = leadWebsites(lead);
  const canLookup = Boolean(lead.company || websites.length || deriveWebsiteFromEmails(emails));

  return Boolean(canLookup && (!websites.length || !emails.length || !phones.length || !lead.linkedIn));
}

function mergeEnrichment(lead, enriched) {
  const websites = uniqueBy([...leadWebsites(lead), enriched.website, ...(enriched.websites || [])], normalizeUrl);
  const emails = cleanEmails([...leadEmails(lead), enriched.email, ...(enriched.emails || [])]);
  const phones = cleanPhones([...leadPhones(lead), enriched.phone, ...(enriched.phones || [])]);
  const socialLinks = unique([...(lead.socialLinks || []), ...(enriched.socialLinks || [])]);

  return {
    ...lead,
    website: lead.website || websites[0] || "",
    websites,
    email: lead.email || emails[0] || "",
    emails,
    phone: lead.phone || phones[0] || "",
    phones,
    linkedIn: lead.linkedIn || enriched.linkedIn || "",
    socialLinks,
    address: lead.address || enriched.address || ""
  };
}

async function enrichLeadData(lead, options = {}) {
  const delayMs = options.skipDelay ? 0 : randomDelayMs();
  if (delayMs) await delay(delayMs);

  const sources = [];
  const aggregate = emptyEnrichment();
  const existingEmails = leadEmails(lead);
  const candidateWebsites = uniqueBy(
    [...leadWebsites(lead), deriveWebsiteFromEmails(existingEmails)],
    normalizeUrl
  );

  if (lead.company) {
    const searchData = await searchCompanyPublicData(lead.company);
    mergeCollected(aggregate, searchData);
    sources.push(...(searchData.sources || []));
    candidateWebsites.push(...searchData.websites);
  }

  const websites = uniqueBy(candidateWebsites, normalizeUrl)
    .filter((url) => url && !isBlockedUrl(url))
    .slice(0, Number(process.env.ENRICHMENT_WEBSITE_LIMIT || 3));

  for (const website of websites) {
    const scraped = await scrapeWebsite(website);
    mergeCollected(aggregate, scraped);
    sources.push(...(scraped.sources || []));
  }

  const data = mergeEnrichment(lead, aggregate);
  const completed =
    sources.length ||
    aggregate.emails.length ||
    aggregate.phones.length ||
    aggregate.websites.length ||
    aggregate.socialLinks.length;

  return {
    data,
    meta: {
      status: completed ? "completed" : "skipped",
      delayMs,
      sources: unique(sources),
      searchedAt: new Date()
    }
  };
}

module.exports = {
  enrichLeadData,
  needsEnrichment,
  scrapeWebsite,
  searchCompanyPublicData,
  searchOfficialWebsite
};
