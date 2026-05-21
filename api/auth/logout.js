module.exports = async function handler(req, res) {
  res.setHeader('Set-Cookie', 'nsls_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');

  try {
    const discovery = await fetch('https://auth.nsls.org/.well-known/openid-configuration').then(r => r.json());
    if (discovery.end_session_endpoint) {
      const post = encodeURIComponent(process.env.OIDC_REDIRECT_URI
        ? process.env.OIDC_REDIRECT_URI.replace('/api/auth/callback', '/')
        : 'https://nsls-solutions.vercel.app/');
      return res.redirect(302, `${discovery.end_session_endpoint}?post_logout_redirect_uri=${post}`);
    }
  } catch {
    // fall through to local redirect if discovery fails
  }

  res.redirect(302, '/');
};
