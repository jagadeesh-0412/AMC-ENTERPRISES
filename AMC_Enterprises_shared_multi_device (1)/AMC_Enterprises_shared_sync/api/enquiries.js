const { supabase } = require('../lib/db');
const { requireAdmin } = require('../lib/auth');
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      if (!requireAdmin(req, res)) return;
      return res.json(await supabase('enquiries?select=*&order=created_at.desc'));
    }
    if (req.method === 'POST') {
      const e = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!e.name || !e.phone || !e.message) return res.status(400).json({ error:'Missing enquiry details' });
      await supabase('enquiries', { method:'POST', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ id:e.id||`e${Date.now()}`, name:e.name, phone:e.phone, message:e.message, date:e.date||new Date().toLocaleString(), created_at:new Date().toISOString() }) });
      return res.status(201).json({ ok:true });
    }
    if (!requireAdmin(req, res)) return;
    const id = encodeURIComponent(req.query.id);
    if (req.method === 'DELETE') { await supabase(`enquiries?id=eq.${id}`, { method:'DELETE' }); return res.json({ok:true}); }
    return res.status(405).json({ error:'Method not allowed' });
  } catch(e) { return res.status(e.status || 500).json({error:e.message, details:e.data||null}); }
};
