import DOMPurify from 'dompurify';

const CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'mark', 'a'],
  ALLOWED_ATTR: ['href'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\/)/i,
};

export function sanitizeTaskHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, CONFIG);
}
