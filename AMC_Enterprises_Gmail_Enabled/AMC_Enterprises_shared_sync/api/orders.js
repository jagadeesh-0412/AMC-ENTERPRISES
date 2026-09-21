const crypto = require('crypto');
const { supabase } = require('../lib/db');
const { requireAdmin } = require('../lib/auth');
const { getSettings, sendEmail, emailEnabled } = require('../lib/gmail');

function orderSummary(o) {
  return (o.items || []).map(i => `${i.name} × ${i.qty}`).join(', ') || 'No items';
}

async function emailNewOrder(row) {
  try {
    const settings = await getSettings();
    if (!emailEnabled(settings, 'email_new_order')) return;
    const to = String(settings?.gmail_admin_email || '').trim();
    if (!to) return;
    await sendEmail({
      to,
      subject: `AMC Enterprises — New Order ${row.id}`,
      text: `A new Cash on Delivery order was placed.\n\nOrder: ${row.id}\nCustomer: ${row.customer?.name || ''}\nPhone: ${row.customer?.phone || ''}\nEmail: ${row.customer?.email || ''}\nAddress: ${row.customer?.address || ''}\nItems: ${orderSummary(row)}\nTotal: ₹${Number(row.total || 0).toFixed(2)}\nStatus: ${row.status}`,
      eventKey: `order:${row.id}:admin:new`
    });
  } catch (e) { console.warn('Gmail new-order notification failed:', e.message); }
}

async function emailCustomerStatus(row, oldStatus, newStatus) {
  try {
    const settings = await getSettings();
    const map = { Confirmed: 'email_order_confirmed', Packed: 'email_order_packed', Cancelled: 'email_order_cancelled' };
    const toggle = map[newStatus];
    if (!toggle || !emailEnabled(settings, toggle)) return;
    const to = String(row.customer?.email || '').trim();
    if (!to) return;
    const textByStatus = {
      Confirmed: `Your order ${row.id} has been confirmed by AMC Enterprises.`,
      Packed: `Your order ${row.id} has been packed and is ready for dispatch.`,
      Cancelled: `Your order ${row.id} has been cancelled by AMC Enterprises. Please contact the team if you need assistance.`
    };
    await sendEmail({
      to,
      subject: `AMC Enterprises — Order ${row.id}: ${newStatus}`,
      text: `${textByStatus[newStatus]}\n\nCustomer: ${row.customer?.name || ''}\nItems: ${orderSummary(row)}\nTotal: ₹${Number(row.total || 0).toFixed(2)}\nPrevious status: ${oldStatus}\nNew status: ${newStatus}`,
      eventKey: `order:${row.id}:customer:${newStatus.toLowerCase()}`
    });
  } catch (e) { console.warn('Gmail customer status notification failed:', e.message); }
}

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
      let customerAccountId=null; try { const phone=String(o.customer?.phone||'').replace(/\D/g,''); if(phone) { const accts=await supabase(`customer_accounts?phone=eq.${encodeURIComponent(phone)}&select=id&limit=1`); if(accts&&accts[0]) customerAccountId=accts[0].id; } } catch (_) {}
      const row = { id:String(o.id), date:o.date||new Date().toLocaleString(), created_at:o.createdAt||new Date().toISOString(), customer:o.customer, customer_account_id:customerAccountId, items:o.items||[], total:Number(o.total||0), payment_status:o.paymentStatus||'Cash on Delivery', status:o.status||'New' };
      await supabase('orders?on_conflict=id', { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }, body:JSON.stringify(row) });
      await emailNewOrder(row);
      return res.status(201).json(o);
    }
    if (!requireAdmin(req, res)) return;
    const id = encodeURIComponent(req.query.id);
    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const currentRows = await supabase(`orders?id=eq.${id}&select=*`);
      const current = currentRows && currentRows[0] ? currentRows[0] : null;
      const row = {};
      if (body.status) row.status = body.status;
      if (body.customer) row.customer = body.customer;
      if (body.items) row.items = body.items;
      if (body.total != null) row.total = Number(body.total);
      const rows = await supabase(`orders?id=eq.${id}`, { method:'PATCH', headers:{ Prefer:'return=representation' }, body:JSON.stringify(row) });
      const updated = rows && rows[0] ? rows[0] : { ...(current || {}), ...row };
      if (body.status && current && current.status !== body.status) {
        await supabase('order_status_history', { method:'POST', headers:{ Prefer:'return=minimal' }, body:JSON.stringify({ id:crypto.randomUUID(), order_id:current.id, old_status:current.status, new_status:body.status, changed_by:'admin', created_at:new Date().toISOString() }) });
        await emailCustomerStatus(updated, current.status, body.status);
      }
      return res.json(updated);
    }
    if (req.method === 'DELETE') {
      await supabase(`orders?id=eq.${id}`, { method:'DELETE' });
      return res.json({ ok:true });
    }
    return res.status(405).json({ error:'Method not allowed' });
  } catch (e) { return res.status(e.status || 500).json({ error:e.message, details:e.data || null }); }
};
