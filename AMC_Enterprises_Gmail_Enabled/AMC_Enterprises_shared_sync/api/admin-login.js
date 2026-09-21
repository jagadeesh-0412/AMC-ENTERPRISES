const { makeCookie } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});

    // Logout
    if (body.action === 'logout') {
      res.setHeader(
        'Set-Cookie',
        'amc_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
      );
      return res.json({ ok: true });
    }

    // Login
    if (
      !process.env.ADMIN_PASSWORD ||
      body.password !== process.env.ADMIN_PASSWORD
    ) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    res.setHeader(
      'Set-Cookie',
      `amc_admin=${encodeURIComponent(makeCookie())}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
    );

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
