function compact(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map((value) => compact(value)))];
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return String(value)
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueBy(values, normalizer = compact) {
  const seen = new Set();
  const result = [];

  for (const value of values || []) {
    const normalized = normalizer(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalizeEmail(email) {
  return compact(email)
    .replace(/^mailto:/i, "")
    .replace(/\?.*$/, "")
    .replace(/[<>"'()]/g, "")
    .replace(/[.,;:]+$/, "")
    .toLowerCase();
}

function normalizeUrl(url) {
  const value = compact(url)
    .replace(/[<>"'()]/g, "")
    .replace(/[.,;:]+$/, "");
  if (!value) return "";

  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(withProtocol);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch (_error) {
    return "";
  }
}

function normalizePhone(phone) {
  const value = compact(phone).replace(/[^\d+]/g, "");
  if (!value) return "";

  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return value.trim().startsWith("+") ? `+${digits}` : digits;
}

function hostname(url) {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, "");
  } catch (_error) {
    return "";
  }
}

module.exports = {
  compact,
  hostname,
  normalizeEmail,
  normalizePhone,
  normalizeUrl,
  toArray,
  unique,
  uniqueBy
};
