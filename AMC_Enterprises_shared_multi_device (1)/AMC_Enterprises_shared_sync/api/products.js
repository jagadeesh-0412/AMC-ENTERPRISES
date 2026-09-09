const { supabase } = require('../lib/db');
const { requireAdmin } = require('../lib/auth');
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const rows = await supabase('products?select=*&order=id.asc');
      return res.json(rows || []);
    }
    if (!requireAdmin(req, res)) return;
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (req.method === 'PUT') {
      const products = Array.isArray(body.products) ? body.products : [];
      const normalized = products.map(p => ({ id:String(p.id), name:p.name||'', category:p.category||'', manufacturer:p.manufacturer||'', pack:p.pack||'', stock:Math.max(0, Number(p.stock)||0), price:Math.max(0, Number(p.price)||0), image:p.image||'' }));
      if (normalized.length) await supabase('products?on_conflict=id', { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }, body:JSON.stringify(normalized) });
      const ids = normalized.map(p => p.id);
      const existing = await supabase('products?select=id');
      for (const row of (existing || [])) if (!ids.includes(row.id)) await supabase(`products?id=eq.${encodeURIComponent(row.id)}`, { method:'DELETE' });
      return res.json({ ok:true, products:normalized });
    }
    return res.status(405).json({ error:'Method not allowed' });
  } catch (e) { return res.status(e.status || 500).json({ error:e.message, details:e.data || null }); }
};
