const express = require("express");
const { deleteLead, enrichLead, updateLead } = require("../controllers/leadController");

const router = express.Router();

router.route("/:leadId").put(updateLead).delete(deleteLead);
router.post("/:leadId/enrich", enrichLead);

module.exports = router;
