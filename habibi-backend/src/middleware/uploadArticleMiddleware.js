const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const ALLOWED_MIME  = new Set(['image/jpeg','image/png','image/webp','image/gif']);
const ALLOWED_EXT   = new Set(['.jpg','.jpeg','.png','.webp','.gif']);

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext))
    return cb(new Error('Only images are allowed'), false);
  cb(null, true);
}

const USE_CLOUDINARY = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY    &&
  process.env.CLOUDINARY_API_SECRET
);

let upload;

if (USE_CLOUDINARY) {
  const cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  const storage = new CloudinaryStorage({
    cloudinary,
    params: { folder: 'habibi-articles', allowed_formats: ['jpg','jpeg','png','webp'], transformation: [{ width: 1200, crop: 'limit', quality: 'auto' }] },
  });
  upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 }, fileFilter });
} else {
  const uploadDir = path.join(__dirname, '../../public/uploads/articles');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => {
      const ext = { 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif' }[file.mimetype] || '.jpg';
      cb(null, `article-${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`);
    },
  });
  upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 }, fileFilter });
}

module.exports = upload;
