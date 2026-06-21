const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true
    },
    personName: { type: String, trim: true, default: "" },
    company: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    emails: [{ type: String, trim: true, lowercase: true }],
    phone: { type: String, trim: true, default: "" },
    phones: [{ type: String, trim: true }],
    website: { type: String, trim: true, default: "" },
    websites: [{ type: String, trim: true }],
    address: { type: String, trim: true, default: "" },
    linkedIn: { type: String, trim: true, default: "" },
    socialLinks: [{ type: String, trim: true }],
    notes: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["New", "Contacted", "Qualified", "Follow-up", "Won", "Lost"],
      default: "New"
    },
    tags: [{ type: String, trim: true }],
    score: { type: Number, min: 0, max: 100, default: 0 },
    rawText: { type: String, default: "" },
    images: {
      frontUrl: { type: String, default: "" },
      backUrl: { type: String, default: "" }
    },
    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null
    },
    enrichment: {
      status: {
        type: String,
        enum: ["pending", "skipped", "completed", "failed"],
        default: "pending"
      },
      searchedAt: Date,
      sources: [{ type: String }],
      delayMs: Number,
      error: String
    }
  },
  { timestamps: true }
);

leadSchema.index({ event: 1, email: 1 });
leadSchema.index({ event: 1, emails: 1 });
leadSchema.index({ event: 1, phone: 1 });
leadSchema.index({ event: 1, phones: 1 });
leadSchema.index({ event: 1, company: 1, personName: 1 });
leadSchema.index({
  personName: "text",
  company: "text",
  email: "text",
  emails: "text",
  phone: "text",
  phones: "text",
  websites: "text",
  designation: "text",
  notes: "text"
});

module.exports = mongoose.model("Lead", leadSchema);
