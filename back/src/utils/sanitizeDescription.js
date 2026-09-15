const sanitizeHtml = require('sanitize-html');

const MAX_TASK_DESCRIPTION_LENGTH = 20000;

const OPTIONS = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'mark', 'a'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'],
};

function sanitizeDescription(html) {
  if (html == null || html === '') return null;
  const clean = sanitizeHtml(String(html), OPTIONS).trim();
  const text = clean.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
  if (!text) return null;
  if (clean.length > MAX_TASK_DESCRIPTION_LENGTH) {
    throw new Error('Invalid description');
  }
  return clean;
}

module.exports = { sanitizeDescription, MAX_TASK_DESCRIPTION_LENGTH };
