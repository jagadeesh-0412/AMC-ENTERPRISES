const { supabase } = require('../lib/db');
const { requireAdmin } = require('../lib/auth');
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const rows = await supabase('orders?select=*&order=created_at.desc');
      return res.json((rows || []).map(r => ({ id:r.id, date:r.date, createdAt:r.created_at, customer:r.customer, items:r.items, total:Number(r.total||0), paymentStatus:r.payment_status, status:r.status })));
    }
    if (req.method === 'POST') {
      const o = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!o.id || !o.customer?.name || !o.customer?.phone || !o.customer?.address) return res.status(400).json({ error:'Missing order/customer details' });
      const row = { id:String(o.id), date:o.date||new Date().toLocaleString(), created_at:o.createdAt||new Date().toISOString(), customer:o.customer, items:o.items||[], total:Number(o.total||0), payment_status:o.paymentStatus||'Cash on Delivery', status:o.status||'New' };
      await supabase('orders?on_conflict=id', { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }, body:JSON.stringify(row) });
      return res.status(201).json(o);
    }
    if (!requireAdmin(req, res)) return;
    const id = encodeURIComponent(req.query.id);
    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const row = {};
      if (body.status) row.status = body.status;
      if (body.customer) row.customer = body.customer;
      if (body.items) row.items = body.items;
      if (body.total != null) row.total = Number(body.total);
      const rows = await supabase(`orders?id=eq.${id}`, { method:'PATCH', headers:{ Prefer:'return=representation' }, body:JSON.stringify(row) });
      return res.json(rows && rows[0] ? rows[0] : body);
    }
    if (req.method === 'DELETE') {
      await supabase(`orders?id=eq.${id}`, { method:'DELETE' });
      return res.json({ ok:true });
    }
    return res.status(405).json({ error:'Method not allowed' });
  } catch (e) { return res.status(e.status || 500).json({ error:e.message, details:e.data || null }); }
};
