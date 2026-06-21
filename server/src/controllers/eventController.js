const Event = require("../models/Event");
const Lead = require("../models/Lead");
const asyncHandler = require("../middleware/asyncHandler");

const listEvents = asyncHandler(async (_req, res) => {
  const events = await Event.aggregate([
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "leads",
        localField: "_id",
        foreignField: "event",
        as: "leads"
      }
    },
    {
      $addFields: {
        leadCount: { $size: "$leads" }
      }
    },
    {
      $project: {
        leads: 0
      }
    }
  ]);

  res.json(events);
});

const getEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.eventId);
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }

  const leadCount = await Lead.countDocuments({ event: event._id });
  res.json({ ...event.toObject(), leadCount });
});

const createEvent = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) {
    res.status(400);
    throw new Error("Event name is required");
  }

  const event = await Event.create({
    name,
    description: String(req.body.description || "").trim()
  });

  res.status(201).json({ ...event.toObject(), leadCount: 0 });
});

const updateEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.eventId);
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }

  if (req.body.name !== undefined) event.name = String(req.body.name).trim();
  if (req.body.description !== undefined) event.description = String(req.body.description).trim();
  await event.save();

  res.json(event);
});

const deleteEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.eventId);
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }

  await Lead.deleteMany({ event: event._id });
  await event.deleteOne();
  res.json({ ok: true });
});

module.exports = {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent
};
