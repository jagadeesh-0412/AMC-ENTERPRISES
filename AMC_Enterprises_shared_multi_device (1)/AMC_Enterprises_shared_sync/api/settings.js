const { supabase } = require('../lib/db');
const { requireAdmin } = require('../lib/auth');
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const rows = await supabase('settings?id=eq.1&select=*');
      return res.json(rows && rows[0] ? rows[0] : null);
    }
    if (!requireAdmin(req, res)) return;
    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const row = { id:1, phone:body.phone||'', whatsapp:body.whatsapp||'', sms_to:body.smsTo||'', email:body.email||'', address:body.address||'', hours:body.hours||'', gstin:body.gstin||'', hero_title:body.heroTitle||'', hero_sub:body.heroSub||'' };
      await supabase('settings?on_conflict=id', { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }, body:JSON.stringify(row) });
      return res.json({ ok:true });
    }
    return res.status(405).json({ error:'Method not allowed' });
  } catch (e) { return res.status(e.status || 500).json({ error:e.message, details:e.data || null }); }
};
