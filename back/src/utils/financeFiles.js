const fs = require('fs');
const path = require('path');

function uploadDir() {
  return process.env.FINANCE_UPLOAD_DIR || path.join(__dirname, '../../uploads/finance');
}

function ensureDir() {
  fs.mkdirSync(uploadDir(), { recursive: true });
}

function safeOriginal(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function saveFinanceFile(itemId, file) {
  ensureDir();
  const storedName = `${itemId}-${safeOriginal(file.originalname)}`;
  fs.writeFileSync(path.join(uploadDir(), storedName), file.buffer);
  return { storedName, fileName: file.originalname, mimeType: file.mimetype };
}

function removeFinanceFile(storedName) {
  if (!storedName) return;
  const full = path.join(uploadDir(), storedName);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

function financeFilePath(storedName) {
  return path.join(uploadDir(), storedName);
}

module.exports = { saveFinanceFile, removeFinanceFile, financeFilePath };
