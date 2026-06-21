export function parseQrPayload(text) {
  const value = String(text || "");
  if (!value) return {};

  if (/BEGIN:VCARD/i.test(value)) {
    const field = (key) => {
      const match = value.match(new RegExp(`^${key}(?:;[^:]*)?:(.+)$`, "im"));
      return (match?.[1] || "").replace(/;/g, " ").trim();
    };
    return {
      personName: field("FN") || field("N"),
      company: field("ORG"),
      designation: field("TITLE"),
      email: field("EMAIL"),
      phone: field("TEL"),
      website: field("URL"),
      address: field("ADR")
    };
  }

  const email = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = value.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0] || "";
  const website = value.match(/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/?[^\s,;]*/i)?.[0] || "";

  return {
    email,
    phone,
    website,
    notes: value
  };
}
