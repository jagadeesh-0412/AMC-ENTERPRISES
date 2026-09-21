const { requireAdmin } = require('../lib/auth');
const { getSettings, sendEmail } = require('../lib/gmail');

module.exports = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const settings = await getSettings();
    if (!settings?.gmail_refresh_token_enc) return res.status(400).json({ error: 'Connect Gmail first.' });
    const to = String(body.to || settings.gmail_admin_email || settings.email || '').trim();
    if (!to) return res.status(400).json({ error: 'Enter an admin notification email first.' });
    const result = await sendEmail({ to, subject: body.subject || 'AMC Enterprises — Gmail test', text: body.text || 'This is a test email from the AMC Enterprises admin dashboard.', eventKey: `gmail-test-${Date.now()}`, allowDuplicate: true });
    return res.json({ ok: true, to, result });
  } catch (e) { return res.status(e.status || 500).json({ error: e.message, details: e.data || null }); }
};
