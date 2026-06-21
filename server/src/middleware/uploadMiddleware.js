const path = require("path");
const fs = require("fs");
const multer = require("multer");

// ─── Detect environment ───────────────────────────────────────────────────────
const CLOUDINARY_ENABLED =
  Boolean(process.env.CLOUDINARY_CLOUD_NAME) &&
  Boolean(process.env.CLOUDINARY_API_KEY) &&
  Boolean(process.env.CLOUDINARY_API_SECRET);

// ─── Cloudinary helper ────────────────────────────────────────────────────────
// Streams a buffer to Cloudinary and returns the secure URL.
async function uploadBufferToCloudinary(buffer, originalname) {
  const cloudinary = require("cloudinary").v2;

  const rawName = path.parse(originalname).name;
  const safeName = rawName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

  const publicId = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_FOLDER || "business-card-crm",
        public_id: publicId,
        resource_type: "image",
        format: "jpg" // convert HEIC/HEIF → JPEG
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

// ─── Multer base config ───────────────────────────────────────────────────────
// Always use memory storage so we can stream to Cloudinary or write to disk.
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedTypes.has(file.mimetype)) {
      cb(new Error("Only JPG, PNG, WEBP, HEIC, and HEIF images are allowed"));
      return;
    }
    cb(null, true);
  }
});

// ─── Post-multer middleware ───────────────────────────────────────────────────
// After multer populates req.files (buffers in memory), this middleware either:
//   a) uploads each buffer to Cloudinary and sets file.path = secure_url, OR
//   b) writes the buffer to local disk and sets file.path = absolute filepath.
//
// Either way, downstream code only needs file.path — no changes needed there.
async function processUploads(req, _res, next) {
  try {
    const allFiles = Object.values(req.files || {}).flat();
    if (!allFiles.length) return next();

    if (CLOUDINARY_ENABLED) {
      // ── Cloudinary upload ──────────────────────────────────────────────────
      const cloudinary = require("cloudinary").v2;
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });

      for (const file of allFiles) {
        const url = await uploadBufferToCloudinary(file.buffer, file.originalname);
        file.path = url; // Cloudinary HTTPS URL
        delete file.buffer; // free memory
      }
    } else {
      // ── Local disk fallback (development) ──────────────────────────────────
      const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads");
      fs.mkdirSync(uploadDir, { recursive: true });

      for (const file of allFiles) {
        const safeName = file.originalname
          .toLowerCase()
          .replace(/[^a-z0-9.]+/g, "-")
          .replace(/-+/g, "-")
          .slice(0, 80);
        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`;
        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, file.buffer);
        file.path = filepath;
        delete file.buffer;
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, processUploads };
