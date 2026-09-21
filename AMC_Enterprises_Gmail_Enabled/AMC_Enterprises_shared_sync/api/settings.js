const { supabase } = require('../lib/db');
const { requireAdmin } = require('../lib/auth');

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const rows = await supabase('settings?id=eq.1&select=*');
      const row = rows && rows[0] ? { ...rows[0] } : null;
      if (row) delete row.gmail_refresh_token_enc;
      return res.json(row);
    }
    if (!requireAdmin(req, res)) return;
    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const existingRows = await supabase('settings?id=eq.1&select=*');
      const existing = existingRows && existingRows[0] ? existingRows[0] : {};
      const row = {
        id: 1,
        phone: body.phone ?? existing.phone ?? '',
        whatsapp: body.whatsapp ?? existing.whatsapp ?? '',
        sms_to: body.smsTo ?? existing.sms_to ?? '',
        email: body.email ?? existing.email ?? '',
        address: body.address ?? existing.address ?? '',
        hours: body.hours ?? existing.hours ?? '',
        gstin: body.gstin ?? existing.gstin ?? '',
        hero_title: body.heroTitle ?? existing.hero_title ?? '',
        hero_sub: body.heroSub ?? existing.hero_sub ?? '',
        gmail_enabled: body.gmailEnabled ?? existing.gmail_enabled ?? false,
        gmail_admin_email: body.gmailAdminEmail ?? existing.gmail_admin_email ?? '',
        email_new_order: body.emailNewOrder ?? existing.email_new_order ?? true,
        email_order_confirmed: body.emailOrderConfirmed ?? existing.email_order_confirmed ?? true,
        email_order_packed: body.emailOrderPacked ?? existing.email_order_packed ?? true,
        email_order_cancelled: body.emailOrderCancelled ?? existing.email_order_cancelled ?? true,
        email_product_request: body.emailProductRequest ?? existing.email_product_request ?? true,
        email_review: body.emailReview ?? existing.email_review ?? true,
        email_enquiry: body.emailEnquiry ?? existing.email_enquiry ?? true,
        updated_at: new Date().toISOString()
      };
      // OAuth refresh token is never accepted from the browser.
      await supabase('settings?on_conflict=id', { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }, body:JSON.stringify(row) });
      return res.json({ ok:true });
    }
    return res.status(405).json({ error:'Method not allowed' });
  } catch (e) { return res.status(e.status || 500).json({ error:e.message, details:e.data || null }); }
};
