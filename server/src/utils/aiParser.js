const axios = require("axios");
const { extractEmails, extractPhones, extractWebsites, parseBusinessCardText, scoreLead } = require("./parser");
const { normalizeEmail, normalizePhone, normalizeUrl, toArray, uniqueBy } = require("./text");

function localFallback(text) {
  return parseBusinessCardText(text);
}

function enabled() {
  return process.env.USE_OPENAI_PARSER === "true" && Boolean(process.env.OPENAI_API_KEY);
}

function sanitizeAiData(data, rawText) {
  const fallback = parseBusinessCardText(rawText);
  const emailText = [data.email, ...(Array.isArray(data.emails) ? data.emails : toArray(data.emails))].join("\n");
  const phoneText = [data.phone, ...(Array.isArray(data.phones) ? data.phones : toArray(data.phones))].join("\n");
  const websiteText = [data.website, ...(Array.isArray(data.websites) ? data.websites : toArray(data.websites))].join("\n");

  const emails = uniqueBy(
    [
      data.email,
      ...(Array.isArray(data.emails) ? data.emails : toArray(data.emails)),
      ...extractEmails(emailText),
      ...(fallback.emails || [])
    ],
    normalizeEmail
  );
  const phones = uniqueBy(
    [
      data.phone,
      ...(Array.isArray(data.phones) ? data.phones : toArray(data.phones)),
      ...extractPhones(phoneText),
      ...(fallback.phones || [])
    ],
    normalizePhone
  ).filter((phone) => {
    const digits = phone.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 16;
  });
  const websites = uniqueBy(
    [
      data.website,
      ...(Array.isArray(data.websites) ? data.websites : toArray(data.websites)),
      ...extractWebsites(websiteText),
      ...(fallback.websites || [])
    ],
    normalizeUrl
  );

  const payload = {
    personName: String(data.personName || fallback.personName || "").trim(),
    company: String(data.company || fallback.company || "").trim(),
    designation: String(data.designation || fallback.designation || "").trim(),
    email: emails[0] || "",
    emails,
    phone: phones[0] || "",
    phones,
    website: websites[0] || "",
    websites,
    address: String(data.address || fallback.address || "").trim(),
    rawText
  };
  payload.score = scoreLead(payload);
  return payload;
}

async function parseLeadText(text) {
  if (!enabled()) {
    return localFallback(text);
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Extract business card lead data. Return compact JSON with personName, company, designation, email, emails, phone, phones, website, websites, and address. emails, phones, and websites must be arrays containing every visible value. Use empty strings or empty arrays for missing fields."
          },
          {
            role: "user",
            content: text
          }
        ]
      },
      {
        timeout: 20000,
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const content = response.data?.choices?.[0]?.message?.content || "{}";
    return sanitizeAiData(JSON.parse(content), text);
  } catch (error) {
    console.warn("OpenAI parser failed, using local parser:", error.message);
    return localFallback(text);
  }
}

module.exports = {
  parseLeadText
};
