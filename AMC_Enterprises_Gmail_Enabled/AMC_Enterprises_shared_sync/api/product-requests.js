const { supabase } = require('../lib/db');
const { requireAdmin } = require('../lib/auth');
const { getSettings, sendEmail, emailEnabled } = require('../lib/gmail');
module.exports = async (req,res)=>{try{
  if(req.method==='GET'){if(!requireAdmin(req,res))return;const rows=await supabase('product_requests?select=*&order=created_at.desc');return res.json(rows||[]);}
  if(req.method==='POST'){const b=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});if(!b.name||!b.phone||!b.productName)return res.status(400).json({error:'Name, phone and product name are required'});const row={id:'REQ-'+Date.now(),name:String(b.name),phone:String(b.phone),product_name:String(b.productName),quantity:Math.max(1,Number(b.quantity)||1),notes:String(b.notes||''),date:new Date().toLocaleString()};await supabase('product_requests',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});
    try { const settings=await getSettings(); const to=String(settings?.gmail_admin_email||'').trim(); if(to&&emailEnabled(settings,'email_product_request')) await sendEmail({to,subject:`AMC Enterprises — Product Request: ${row.product_name}`,text:`New product request received.\n\nName: ${row.name}\nPhone: ${row.phone}\nProduct: ${row.product_name}\nQuantity: ${row.quantity}\nNotes: ${row.notes||'None'}`,eventKey:`product-request:${row.id}`}); } catch(mailErr){console.warn('Gmail product-request notification failed:',mailErr.message);}
    return res.status(201).json(row);}
  if(!requireAdmin(req,res))return; if(req.method==='DELETE'){const id=encodeURIComponent(req.query.id||'');await supabase(`product_requests?id=eq.${id}`,{method:'DELETE'});return res.json({ok:true});} return res.status(405).json({error:'Method not allowed'});
}catch(e){return res.status(e.status||500).json({error:e.message,details:e.data||null});}};
