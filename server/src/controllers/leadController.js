const path = require("path");
const Event = require("../models/Event");
const Lead = require("../models/Lead");
const asyncHandler = require("../middleware/asyncHandler");
const { extractTextFromImages } = require("../utils/ocr");
const { extractEmails, extractPhones, extractWebsites, parseVCard, scoreLead } = require("../utils/parser");
const { enabled: aiParserEnabled, parseLeadText, parseLeadImagesWithOpenAI } = require("../utils/aiParser");
const { enrichLeadData, needsEnrichment } = require("../utils/enrichment");
const { createLeadsWorkbook } = require("../utils/excel");
const { normalizeEmail, normalizePhone, normalizeUrl, toArray, unique, uniqueBy } = require("../utils/text");

async function assertEvent(eventId) {
  const event = await Event.findById(eventId);
  if (!event) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }
  return event;
}

function uploadUrl(file) {
  if (!file) return "";
  // When Cloudinary storage is active, multer-storage-cloudinary sets
  // file.path to the full secure HTTPS URL (e.g. https://res.cloudinary.com/…)
  // In local disk mode, file.path is an absolute local path.
  if (file.path && /^https?:\/\//.test(file.path)) {
    return file.path; // already an absolute Cloudinary URL
  }
  const uploadDirName = process.env.UPLOAD_DIR || "uploads";
  return `/${uploadDirName}/${path.basename(file.path)}`.replace(/\\/g, "/");
}

function parseTags(tags) {
  if (Array.isArray(tags)) return unique(tags);
  return unique(String(tags || "").split(","));
}

function validPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 16;
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function parseEmails(body) {
  const explicit = [body.email, ...toArray(body.emails)];
  const extracted = extractEmails(explicit.join("\n"));
  return uniqueBy([...extracted, ...explicit], normalizeEmail).filter(validEmail);
}

function parsePhones(body) {
  const explicit = [body.phone, ...toArray(body.phones)];
  const extracted = extractPhones(explicit.join("\n"));
  return uniqueBy([...extracted, ...explicit], normalizePhone).filter(validPhone);
}

function parseWebsites(body) {
  const explicit = [body.website, ...toArray(body.websites)];
  const extracted = extractWebsites(explicit.join("\n"));
  return uniqueBy([...explicit, ...extracted], normalizeUrl);
}

function sanitizeLeadPayload(body) {
  const emails = parseEmails(body);
  const phones = parsePhones(body);
  const websites = parseWebsites(body);
  const payload = {
    personName: String(body.personName || "").trim(),
    company: String(body.company || "").trim(),
    designation: String(body.designation || "").trim(),
    email: emails[0] || "",
    emails,
    phone: phones[0] || "",
    phones,
    website: websites[0] || "",
    websites,
    address: String(body.address || "").trim(),
    linkedIn: normalizeUrl(body.linkedIn || ""),
    socialLinks: Array.isArray(body.socialLinks) ? body.socialLinks.map(normalizeUrl).filter(Boolean) : [],
    notes: String(body.notes || "").trim(),
    status: String(body.status || "New"),
    tags: parseTags(body.tags),
    rawText: String(body.rawText || "")
  };
  payload.score = scoreLead(payload);
  return payload;
}

async function findDuplicate(eventId, payload, excludeId) {
  const or = [];
  if (payload.emails?.length) {
    or.push({ email: { $in: payload.emails } }, { emails: { $in: payload.emails } });
  } else if (payload.email) {
    or.push({ email: payload.email }, { emails: payload.email });
  }
  if (payload.phones?.length) {
    or.push({ phone: { $in: payload.phones } }, { phones: { $in: payload.phones } });
  } else if (payload.phone) {
    or.push({ phone: payload.phone }, { phones: payload.phone });
  }
  if (payload.personName && payload.company) {
    or.push({
      personName: new RegExp(`^${escapeRegExp(payload.personName)}$`, "i"),
      company: new RegExp(`^${escapeRegExp(payload.company)}$`, "i")
    });
  }
  if (!or.length) return null;

  const query = { event: eventId, $or: or };
  if (excludeId) query._id = { $ne: excludeId };
  return Lead.findOne(query);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function enrichPayloadIfNeeded(payload) {
  if (!needsEnrichment(payload)) {
    return {
      payload,
      enrichment: {
        status: "skipped",
        searchedAt: new Date(),
        sources: []
      }
    };
  }

  try {
    const result = await enrichLeadData(payload);
    result.data.score = scoreLead(result.data);
    return {
      payload: result.data,
      enrichment: result.meta
    };
  } catch (error) {
    return {
      payload,
      enrichment: {
        status: "failed",
        searchedAt: new Date(),
        sources: [],
        error: error.message
      }
    };
  }
}

const listLeads = asyncHandler(async (req, res) => {
  await assertEvent(req.params.eventId);

  const query = { event: req.params.eventId };
  const search = String(req.query.search || "").trim();
  const status = String(req.query.status || "").trim();

  if (status && status !== "All") {
    query.status = status;
  }

  if (search) {
    const regex = new RegExp(escapeRegExp(search), "i");
    query.$or = [
      { personName: regex },
      { company: regex },
      { email: regex },
      { emails: regex },
      { phone: regex },
      { phones: regex },
      { website: regex },
      { websites: regex },
      { designation: regex },
      { notes: regex }
    ];
  }

  const leads = await Lead.find(query).sort({ createdAt: -1 });
  res.json(leads);
});

const createManualLead = asyncHandler(async (req, res) => {
  await assertEvent(req.params.eventId);
  const payload = sanitizeLeadPayload(req.body);
  payload.event = req.params.eventId;

  const duplicate = await findDuplicate(req.params.eventId, payload);
  if (duplicate) {
    payload.duplicateOf = duplicate._id;
  }

  const result = await enrichPayloadIfNeeded(payload);
  const lead = await Lead.create({
    ...result.payload,
    event: req.params.eventId,
    duplicateOf: payload.duplicateOf,
    enrichment: result.enrichment
  });

  res.status(201).json({ lead, duplicateOf: duplicate?._id || null });
});

const scanLead = asyncHandler(async (req, res) => {
  await assertEvent(req.params.eventId);

  const files = [req.files?.frontImage?.[0], req.files?.backImage?.[0]].filter(Boolean);
  if (!files.length) {
    res.status(400);
    throw new Error("At least one card image is required");
  }

  const imageUrls = files.map(uploadUrl).filter(Boolean);
  let rawText = "";
  let parsed = {};

  if (aiParserEnabled() && imageUrls.every((url) => /^https?:\/\//.test(url))) {
    // Blazing fast Vision AI path
    parsed = await parseLeadImagesWithOpenAI(imageUrls);
    rawText = parsed.rawText || "";
  } else {
    // Slow local OCR fallback
    rawText = await extractTextFromImages(files);
    parsed = await parseLeadText(rawText);
  }
  const payload = sanitizeLeadPayload({
    ...parsed,
    notes: req.body.notes,
    status: req.body.status,
    tags: req.body.tags,
    rawText
  });
  payload.event = req.params.eventId;
  payload.images = {
    frontUrl: imageUrls[0] || "",
    backUrl: imageUrls[1] || ""
  };

  const duplicate = await findDuplicate(req.params.eventId, payload);
  if (duplicate) {
    payload.duplicateOf = duplicate._id;
  }

  const result = await enrichPayloadIfNeeded(payload);
  const lead = await Lead.create({
    ...result.payload,
    event: req.params.eventId,
    duplicateOf: payload.duplicateOf,
    images: payload.images,
    rawText,
    enrichment: result.enrichment
  });

  res.status(201).json({
    lead,
    parsed,
    rawText,
    duplicateOf: duplicate?._id || null
  });
});

const createFromQr = asyncHandler(async (req, res) => {
  await assertEvent(req.params.eventId);
  const parsed = parseVCard(req.body.text) || (await parseLeadText(req.body.text || ""));
  const payload = sanitizeLeadPayload({
    ...parsed,
    notes: req.body.notes,
    rawText: req.body.text
  });
  payload.event = req.params.eventId;

  const duplicate = await findDuplicate(req.params.eventId, payload);
  if (duplicate) {
    payload.duplicateOf = duplicate._id;
  }

  const result = await enrichPayloadIfNeeded(payload);
  const lead = await Lead.create({
    ...result.payload,
    event: req.params.eventId,
    duplicateOf: payload.duplicateOf,
    enrichment: result.enrichment
  });

  res.status(201).json({ lead, duplicateOf: duplicate?._id || null });
});

const updateLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  const payload = sanitizeLeadPayload({ ...lead.toObject(), ...req.body });
  const duplicate = await findDuplicate(lead.event, payload, lead._id);

  Object.assign(lead, payload);
  lead.duplicateOf = duplicate?._id || null;
  await lead.save();

  res.json({ lead, duplicateOf: duplicate?._id || null });
});

const deleteLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  await lead.deleteOne();
  res.json({ ok: true });
});

const enrichLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  const result = await enrichLeadData(lead.toObject());
  Object.assign(lead, result.data);
  lead.score = scoreLead(lead);
  lead.enrichment = result.meta;
  await lead.save();

  res.json({ lead });
});

async function enrichLeadDocumentIfNeeded(lead) {
  if (!needsEnrichment(lead.toObject())) return lead;

  try {
    const result = await enrichLeadData(lead.toObject(), { skipDelay: true });
    Object.assign(lead, result.data);
    lead.score = scoreLead(lead);
    lead.enrichment = result.meta;
    await lead.save();
  } catch (error) {
    lead.enrichment = {
      status: "failed",
      searchedAt: new Date(),
      sources: lead.enrichment?.sources || [],
      error: error.message
    };
    await lead.save();
  }

  return lead;
}

const exportLeads = asyncHandler(async (req, res) => {
  const event = await assertEvent(req.params.eventId);
  const leads = await Lead.find({ event: event._id }).sort({ createdAt: -1 });
  for (const lead of leads) {
    await enrichLeadDocumentIfNeeded(lead);
  }
  const buffer = createLeadsWorkbook(leads, event.name);
  const safeName = event.name.replace(/[^a-z0-9]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName || "event"}-leads.xlsx"`);
  res.send(buffer);
});

module.exports = {
  createFromQr,
  createManualLead,
  deleteLead,
  enrichLead,
  exportLeads,
  listLeads,
  scanLead,
  updateLead
};
