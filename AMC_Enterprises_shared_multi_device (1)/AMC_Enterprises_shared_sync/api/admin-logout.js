module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Set-Cookie', 'amc_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return res.json({ ok: true });
};
