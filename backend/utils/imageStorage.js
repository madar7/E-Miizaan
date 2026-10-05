// Minimal image upload handling: validates and stores images as data URLs
// directly on the document (User.profileImage / BusinessProfile.logo).
//
// This keeps the feature fully working with zero extra infrastructure, which
// is fine for small deployments but doesn't scale storage-wise. To swap in
// real object storage later (S3, Cloudinary, etc.), implement `store()` to
// upload the buffer and return a public URL instead of a data URL — nothing
// else in the app needs to change, since callers only ever see a URL string.
// A STORAGE_PROVIDER env var is reserved for that switch (see .env.example).

const ALLOWED_TYPES = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

// Accepts a data URL string (what the frontend sends after FileReader.readAsDataURL).
function validateAndStore(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw Object.assign(new Error("Image must be uploaded as a data URL"), { status: 400 });
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw Object.assign(new Error("Unrecognized image format"), { status: 400 });
  }
  const [, mime, base64] = match;

  if (!ALLOWED_TYPES[mime]) {
    throw Object.assign(new Error("Only JPG, PNG, and WEBP images are allowed"), { status: 400 });
  }

  // Rough byte-size check from the base64 string length (no need to decode fully).
  const approxBytes = Math.ceil((base64.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    throw Object.assign(new Error("Image must be smaller than 2MB"), { status: 400 });
  }

  return dataUrl; // storage provider = "local" (inline data URL); see note above
}

module.exports = { validateAndStore, MAX_BYTES, ALLOWED_TYPES };
