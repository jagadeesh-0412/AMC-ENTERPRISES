const { supabase } = require('../lib/db');
const { requireAdmin } = require('../lib/auth');
const { getSettings, sendEmail, emailEnabled } = require('../lib/gmail');
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      if (!requireAdmin(req, res)) return;
      return res.json(await supabase('enquiries?select=*&order=created_at.desc'));
    }
    if (req.method === 'POST') {
      const e = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!e.name || !e.phone || !e.message) return res.status(400).json({ error:'Missing enquiry details' });
      const row = { id:e.id||`e${Date.now()}`, name:e.name, phone:e.phone, message:e.message, date:e.date||new Date().toLocaleString(), created_at:new Date().toISOString() };
      await supabase('enquiries', { method:'POST', headers:{ Prefer:'return=minimal' }, body:JSON.stringify(row) });
      try {
        const settings = await getSettings();
        const to = String(settings?.gmail_admin_email || '').trim();
        if (to && emailEnabled(settings, 'email_enquiry')) await sendEmail({ to, subject:`AMC Enterprises — New Enquiry from ${row.name}`, text:`New customer enquiry received.\n\nName: ${row.name}\nPhone: ${row.phone}\nMessage: ${row.message}`, eventKey:`enquiry:${row.id}` });
      } catch (mailErr) { console.warn('Gmail enquiry notification failed:', mailErr.message); }
      return res.status(201).json({ ok:true });
    }
    if (!requireAdmin(req, res)) return;
    const id = encodeURIComponent(req.query.id);
    if (req.method === 'DELETE') { await supabase(`enquiries?id=eq.${id}`, { method:'DELETE' }); return res.json({ok:true}); }
    return res.status(405).json({ error:'Method not allowed' });
  } catch(e) { return res.status(e.status || 500).json({error:e.message, details:e.data||null}); }
};
