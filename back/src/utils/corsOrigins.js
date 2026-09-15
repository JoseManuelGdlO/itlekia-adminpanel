function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/$/, '');
}

function allowedCorsOrigins(env = process.env) {
  return [env.CORS_ORIGIN, env.FRONTEND_URL]
    .filter((value) => value != null && String(value).trim() !== '')
    .flatMap((value) => String(value).split(','))
    .map(normalizeOrigin)
    .filter(Boolean);
}

function isOriginAllowed(origin, env = process.env) {
  if (!origin) return true;
  return allowedCorsOrigins(env).includes(normalizeOrigin(origin));
}

module.exports = { allowedCorsOrigins, isOriginAllowed };
