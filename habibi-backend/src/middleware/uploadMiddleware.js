const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");

// Strict whitelist: both MIME type AND file extension must be allowed
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function imageFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error('Only images are allowed'), false);
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error('Only images are allowed'), false);
  }
  cb(null, true);
}

const USE_CLOUDINARY = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY    &&
  process.env.CLOUDINARY_API_SECRET
);

let upload;

if (USE_CLOUDINARY) {
  const cloudinary         = require("cloudinary").v2;
  const { CloudinaryStorage } = require("multer-storage-cloudinary");

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder:           "habibi-menu",
      allowed_formats:  ["jpg", "jpeg", "png", "webp"],
      transformation:   [{ width: 800, crop: "limit", quality: "auto" }],
    },
  });

  upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  });
} else {
  // Local disk fallback — used in development; images are lost on redeploy
  const uploadDir = path.join(__dirname, "../../public/uploads/menus");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => {
      const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      // Force safe extension from MIME type — never trust the original filename extension
      const safeExt = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[file.mimetype] || '.jpg';
      cb(null, `menu-${suffix}${safeExt}`);
    },
  });

  upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  });
}

module.exports = upload;
