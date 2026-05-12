const { jwtVerify } = require('jose');

function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const idx = c.indexOf('=');
    if (idx > 0) cookies[c.slice(0, idx).trim()] = c.slice(idx + 1);
  });
  return cookies;
}

module.exports = async function handler(req, res) {
  const token = parseCookies(req)['nsls_session'];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const { payload } = await jwtVerify(token, secret);
    res.json({ sub: payload.sub, email: payload.email, name: payload.name });
  } catch {
    res.setHeader('Set-Cookie', 'nsls_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
    res.status(401).json({ error: 'Session expired' });
  }
};
