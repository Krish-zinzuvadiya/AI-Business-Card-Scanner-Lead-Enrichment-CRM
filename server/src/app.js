require("dotenv").config();

const path = require("path");
const compression = require("compression");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const eventRoutes = require("./routes/eventRoutes");
const leadRoutes = require("./routes/leadRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

const clientOrigins = String(process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set("trust proxy", 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      const localDevOrigin =
        process.env.NODE_ENV !== "production" && /^http:\/\/(?:localhost|127\.0\.0\.1|(?:\d{1,3}\.){3}\d{1,3}):5173$/.test(origin);
      callback(null, clientOrigins.includes(origin) || localDevOrigin);
    },
    credentials: true
  })
);
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    standardHeaders: true,
    legacyHeaders: false
  })
);

// Serve uploaded images from local disk in development only.
// In production (Vercel) files are stored on Cloudinary — no local disk needed.
if (process.env.NODE_ENV !== "production") {
  app.use("/uploads", express.static(path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads")));
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "business-card-crm-api",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/events", eventRoutes);
app.use("/api/leads", leadRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
