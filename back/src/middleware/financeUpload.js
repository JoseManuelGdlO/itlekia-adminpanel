const multer = require('multer');

const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new Error('Invalid file type'));
      return;
    }
    cb(null, true);
  },
});

function mapFinanceUploadError(err, req, res, next) {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large' });
  }
  if (err.message === 'Invalid file type') {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  return next(err);
}

function financeUpload(req, res, next) {
  upload.single('file')(req, res, (err) => mapFinanceUploadError(err, req, res, next));
}

module.exports = { financeUpload };
