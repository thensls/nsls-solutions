const crypto = require('crypto');

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

module.exports = async function handler(req, res) {
  if (!process.env.OIDC_CLIENT_ID) {
    return res.status(500).send('OIDC not configured — set OIDC_CLIENT_ID in Vercel env vars.');
  }

  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  const nonce = b64url(crypto.randomBytes(16));
  const returnTo = req.query.returnTo || '/';

  const cookieData = Buffer.from(JSON.stringify({ state, verifier, nonce, returnTo })).toString('base64');
  res.setHeader('Set-Cookie', `_oidc_state=${cookieData}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);

  const discovery = await fetch('https://auth.nsls.org/.well-known/openid-configuration').then(r => r.json());
  const redirectUri = process.env.OIDC_REDIRECT_URI || 'https://nsls-solutions.vercel.app/api/auth/callback';

  const q = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.OIDC_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  res.redirect(302, `${discovery.authorization_endpoint}?${q}`);
};
