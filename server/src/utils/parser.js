const { compact, normalizeEmail, normalizePhone, normalizeUrl, unique, uniqueBy } = require("./text");

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const websiteRegex = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/?[^\s,;]*)/gi;
const phoneRegex = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const emailLineRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const phoneLineRegex = /(?:\+?\d[\d\s().-]{7,}\d)/;

const designationKeywords = [
  "founder",
  "co-founder",
  "ceo",
  "cto",
  "cmo",
  "director",
  "manager",
  "sales",
  "business development",
  "bde",
  "head",
  "president",
  "partner",
  "consultant",
  "engineer",
  "marketing",
  "executive",
  "specialist",
  "officer"
];

const companySuffixes = [
  "pvt",
  "private",
  "limited",
  "ltd",
  "llc",
  "inc",
  "corp",
  "corporation",
  "company",
  "co.",
  "industries",
  "solutions",
  "systems",
  "technologies",
  "tech",
  "enterprises",
  "group",
  "labs"
];

function cleanLine(line) {
  return compact(line.replace(/[|•·]+/g, " "));
}

function getLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);
}

function extractEmails(text) {
  return uniqueBy(String(text || "").match(emailRegex) || [], normalizeEmail);
}

function extractPhones(text) {
  const candidates = [];
  const lines = getLines(text);

  for (const line of lines) {
    const cleaned = line
      .replace(/(?:phone|mobile|mob|tel|telephone|cell|call|whatsapp|wa|fax|office|direct)\s*[:.-]*/gi, " ")
      .replace(/[^\d+().\-\s/,;|&]/g, " ");

    for (const part of cleaned.split(/\s*(?:,|;|\||\/|&|\band\b)\s*/i)) {
      candidates.push(...(part.match(phoneRegex) || []));
    }
  }

  candidates.push(...(String(text || "").match(phoneRegex) || []));

  return uniqueBy(candidates, normalizePhone).filter((phone) => {
    const digits = phone.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 16 && !/^(\d)\1+$/.test(digits);
  });
}

function extractWebsites(text) {
  const values = String(text || "").match(websiteRegex) || [];
  return unique(values)
    .filter((url) => !url.includes("@"))
    .map((url) => normalizeUrl(url))
    .filter(Boolean);
}

function scoreName(line) {
  if (!line || /@|www|http|\d/.test(line)) return -5;
  const words = line.split(/\s+/);
  if (words.length < 2 || words.length > 4) return -2;
  const hasTitleCase = words.every((word) => /^[A-Z][a-zA-Z.'-]+$/.test(word));
  return hasTitleCase ? 6 : 1;
}

function looksLikeDesignation(line) {
  const lower = line.toLowerCase();
  if (emailLineRegex.test(line) || phoneLineRegex.test(line) || lower.includes("www.") || lower.includes("http")) {
    return false;
  }
  return designationKeywords.some((keyword) => lower.includes(keyword));
}

function looksLikeCompany(line) {
  const lower = line.toLowerCase();
  if (/@|http|\d{5,}/.test(lower)) return false;
  return companySuffixes.some((suffix) => lower.includes(suffix)) || /^[A-Z0-9& .'-]{4,}$/.test(line);
}

function inferName(lines) {
  const candidates = lines
    .map((line, index) => ({ line, index, score: scoreName(line) + Math.max(0, 5 - index) }))
    .filter((item) => item.score > 0 && !looksLikeDesignation(item.line) && !looksLikeCompany(item.line))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.line || "";
}

function inferDesignation(lines) {
  return lines.find(looksLikeDesignation) || "";
}

function inferCompany(lines, personName, designation) {
  const filtered = lines.filter((line) => {
    const lower = line.toLowerCase();
    return (
      line !== personName &&
      line !== designation &&
      !emailLineRegex.test(line) &&
      !phoneLineRegex.test(line) &&
      !lower.includes("www.") &&
      !lower.includes("http")
    );
  });

  const direct = filtered.find(looksLikeCompany);
  if (direct) return direct;

  const nameIndex = lines.findIndex((line) => line === personName);
  if (nameIndex >= 0) {
    const nearby = lines.slice(nameIndex + 1, nameIndex + 4).find((line) => line !== designation);
    if (nearby) return nearby;
  }

  return filtered[0] || "";
}

function inferAddress(lines) {
  const addressHints = /(road|street|st\.|avenue|ave|sector|floor|suite|block|city|state|zip|pin|india|usa|uk|building|tower)/i;
  const addressLines = lines.filter((line) => addressHints.test(line) && !/@|www|http/.test(line));
  return unique(addressLines).slice(0, 3).join(", ");
}

function scoreLead(data) {
  const hasEmail = Boolean(data.email || data.emails?.length);
  const hasPhone = Boolean(data.phone || data.phones?.length);
  const hasWebsite = Boolean(data.website || data.websites?.length);
  let score = 10;
  if (data.personName) score += 15;
  if (data.company) score += 15;
  if (hasEmail) score += 20;
  if (hasPhone) score += 15;
  if (hasWebsite) score += 15;
  if (data.designation) score += 10;
  return Math.min(score, 100);
}

function parseBusinessCardText(text) {
  const lines = getLines(text);
  const emails = extractEmails(text);
  const phones = extractPhones(text);
  const websites = extractWebsites(text);
  const personName = inferName(lines);
  const designation = inferDesignation(lines);
  const company = inferCompany(lines, personName, designation);

  const data = {
    personName,
    company,
    designation,
    email: emails[0] || "",
    emails,
    phone: phones[0] || "",
    phones,
    website: websites[0] || "",
    websites,
    address: inferAddress(lines),
    rawText: text || ""
  };

  data.score = scoreLead(data);
  return data;
}

function parseVCard(text) {
  const value = String(text || "");
  if (!/BEGIN:VCARD/i.test(value)) return null;

  const fields = (key) => {
    const regex = new RegExp(`^${key}(?:;[^:]*)?:(.+)$`, "gim");
    return [...value.matchAll(regex)].map((match) => compact(match[1])).filter(Boolean);
  };

  const field = (key) => {
    return fields(key)[0] || "";
  };

  const names = field("FN") || field("N").replace(/;/g, " ");
  const emails = uniqueBy(fields("EMAIL"), normalizeEmail);
  const phones = uniqueBy(fields("TEL"), normalizePhone).filter((phone) => {
    const digits = phone.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 16;
  });
  const websites = uniqueBy(fields("URL"), normalizeUrl);
  const data = {
    personName: compact(names),
    company: field("ORG"),
    designation: field("TITLE"),
    email: emails[0] || "",
    emails,
    phone: phones[0] || "",
    phones,
    website: websites[0] || "",
    websites,
    address: field("ADR").replace(/;/g, " "),
    rawText: value
  };
  data.score = scoreLead(data);
  return data;
}

module.exports = {
  extractEmails,
  extractPhones,
  extractWebsites,
  parseBusinessCardText,
  parseVCard,
  scoreLead
};
