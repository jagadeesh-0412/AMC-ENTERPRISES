const crypto = require('crypto');

function sign(value) {
  return crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || 'change-me').update(value).digest('base64url');
}

function makeCookie() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyCookie(req) {
  const raw = req.headers.cookie || '';
  const match = raw.match(/(?:^|;\s*)amc_admin=([^;]+)/);
  if (!match) return false;
  const token = decodeURIComponent(match[1]);
  const [payload, sig] = token.split('.');
  if (!payload || !sig || sign(payload) !== sig) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
  } catch { return false; }
}

function requireAdmin(req, res) {
  if (!verifyCookie(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Admin authentication required' }));
    return false;
  }
  return true;
}

module.exports = { makeCookie, verifyCookie, requireAdmin };
