const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function uploadDir() {
  return process.env.FINANCE_UPLOAD_DIR || path.join(__dirname, '../../uploads/finance');
}

function ensureDir() {
  fs.mkdirSync(uploadDir(), { recursive: true });
}

function safeOriginal(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function financeStoredName(itemId, originalName) {
  return `${itemId}-${randomUUID()}-${safeOriginal(originalName)}`;
}

function saveFinanceFile(itemId, file, storedName = financeStoredName(itemId, file.originalname)) {
  ensureDir();
  const full = path.join(uploadDir(), storedName);
  try {
    fs.writeFileSync(full, file.buffer);
  } catch (error) {
    if (fs.existsSync(full)) fs.unlinkSync(full);
    throw error;
  }
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

function financeFileExists(storedName) {
  return Boolean(storedName) && fs.existsSync(financeFilePath(storedName));
}

module.exports = {
  financeStoredName,
  saveFinanceFile,
  removeFinanceFile,
  financeFilePath,
  financeFileExists,
};
