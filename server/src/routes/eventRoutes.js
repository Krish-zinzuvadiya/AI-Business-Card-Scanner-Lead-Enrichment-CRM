const express = require("express");
const {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent
} = require("../controllers/eventController");
const {
  createFromQr,
  createManualLead,
  exportLeads,
  listLeads,
  scanLead
} = require("../controllers/leadController");
const { upload, processUploads } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.route("/").get(listEvents).post(createEvent);
router.route("/:eventId").get(getEvent).put(updateEvent).delete(deleteEvent);
router.route("/:eventId/leads").get(listLeads).post(createManualLead);
router.post("/:eventId/leads/qr", createFromQr);
router.post(
  "/:eventId/leads/scan",
  upload.fields([
    { name: "frontImage", maxCount: 1 },
    { name: "backImage", maxCount: 1 }
  ]),
  processUploads,
  scanLead
);
router.get("/:eventId/leads/export", exportLeads);

module.exports = router;
