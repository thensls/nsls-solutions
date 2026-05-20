const { jwtVerify } = require('jose');

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'chigbee@nsls.org')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const idx = c.indexOf('=');
    if (idx > 0) cookies[c.slice(0, idx).trim()] = c.slice(idx + 1);
  });
  return cookies;
}

async function getUser(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const token = parseCookies(req)['nsls_session'];
  if (!token) return null;
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key);
    return { sub: payload.sub, email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}

async function requireUser(req, res) {
  if (!process.env.SESSION_SECRET) {
    res.status(500).json({ error: 'Server misconfiguration' });
    return null;
  }
  const user = await getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return user;
}

async function requireAdmin(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (!ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return user;
}

module.exports = { getUser, requireUser, requireAdmin, ADMIN_EMAILS };
