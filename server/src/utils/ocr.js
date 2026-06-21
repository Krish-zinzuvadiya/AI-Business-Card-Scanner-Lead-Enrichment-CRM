const { createWorker } = require("tesseract.js");

// In production (Vercel), we use Tesseract CDN mode so that the 5 MB
// eng.traineddata file is never bundled into the serverless function.
// In local dev you can set TESSERACT_CDN=false to use the cached local file.
//
// Tesseract v5 CDN mode: pass a language string and set cachePath to a
// writable tmp directory (/tmp is the only writable location on Vercel).
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const USE_CDN = IS_PRODUCTION || process.env.TESSERACT_CDN === "true";

async function recognizeImage(imagePath) {
  const workerOptions = USE_CDN
    ? {
        // Fetch traineddata from the official CDN instead of reading a local file
        langPath: "https://tessdata.projectnaptha.com/4.0.0",
        // /tmp is writable on Vercel serverless
        cachePath: "/tmp",
        logger: () => {} // suppress verbose progress logs in production
      }
    : {
        // Local dev: use the pre-downloaded eng.traineddata in the server root
        langPath: __dirname.includes("src") ? require("path").resolve(__dirname, "../../") : __dirname,
        logger: () => {}
      };

  const worker = await createWorker("eng", 1, workerOptions);
  try {
    const result = await worker.recognize(imagePath);
    return result.data.text || "";
  } finally {
    await worker.terminate();
  }
}

async function extractTextFromImages(files = []) {
  const chunks = [];
  for (const file of files.filter(Boolean)) {
    // multer-storage-cloudinary sets file.path to the Cloudinary HTTPS URL;
    // local disk storage sets file.path to the absolute filesystem path.
    // Tesseract.js accepts both URLs and file paths natively.
    const src = file.path;
    const text = await recognizeImage(src);
    if (text.trim()) {
      chunks.push(text.trim());
    }
  }
  return chunks.join("\n\n");
}

module.exports = {
  extractTextFromImages,
  recognizeImage
};
