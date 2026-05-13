const { SignJWT, jwtVerify, createRemoteJWKSet } = require('jose');

function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const idx = c.indexOf('=');
    if (idx > 0) cookies[c.slice(0, idx).trim()] = c.slice(idx + 1);
  });
  return cookies;
}

module.exports = async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(302, `/?auth_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return res.status(400).send('Missing code or state');
  }

  const cookies = parseCookies(req);
  const raw = cookies['_oidc_state'];
  if (!raw) return res.redirect(302, '/api/auth/login');

  let saved;
  try {
    saved = JSON.parse(Buffer.from(raw, 'base64').toString());
  } catch {
    return res.redirect(302, '/api/auth/login');
  }

  if (state !== saved.state) {
    return res.status(400).send('State mismatch — possible CSRF');
  }

  const redirectUri = process.env.OIDC_REDIRECT_URI || 'https://nsls-solutions.vercel.app/api/auth/callback';
  const discovery = await fetch('https://auth.nsls.org/.well-known/openid-configuration').then(r => r.json());

  const tokenRes = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.OIDC_CLIENT_ID,
      client_secret: process.env.OIDC_CLIENT_SECRET,
      code_verifier: saved.verifier,
    }),
  });
  if (!tokenRes.ok) {
    return res.redirect(302, `/?auth_error=${encodeURIComponent('Token exchange failed')}`);
  }
  const tokens = await tokenRes.json();

  if (tokens.error) {
    return res.redirect(302, `/?auth_error=${encodeURIComponent(tokens.error_description || tokens.error)}`);
  }

  // Verify ID token via JWKS
  const JWKS = createRemoteJWKSet(new URL(discovery.jwks_uri));
  let claims;
  try {
    const { payload } = await jwtVerify(tokens.id_token, JWKS, {
      issuer: discovery.issuer,
      audience: process.env.OIDC_CLIENT_ID,
    });
    claims = payload;
  } catch (e) {
    return res.status(400).send(`ID token validation failed: ${e.message}`);
  }

  if (claims.nonce !== saved.nonce) {
    return res.status(400).send('Nonce mismatch — possible replay attack');
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) return res.status(500).send('Server misconfiguration');
  const secret = new TextEncoder().encode(sessionSecret);
  const sessionToken = await new SignJWT({
    sub: claims.sub,
    email: claims.email || '',
    name: claims.name || claims.preferred_username || claims.email || '',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);

  res.setHeader('Set-Cookie', [
    `_oidc_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    `nsls_session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800`,
  ]);

  res.redirect(302, saved.returnTo || '/');
};
