const crypto = require('crypto');
const { supabase } = require('./db');

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email';

function baseUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https');
  const host = req.headers.host;
  return `${proto.split(',')[0]}://${host}`;
}

function oauthConfig(req) {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const e = new Error('Gmail OAuth is not configured. Add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in Vercel.');
    e.status = 500;
    throw e;
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${baseUrl(req)}/api/gmail-callback`
  };
}

function tokenKey() {
  const source = process.env.GMAIL_TOKEN_ENCRYPTION_KEY || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'change-me';
  return crypto.createHash('sha256').update(source).digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decrypt(value) {
  if (!value) return '';
  const [ivRaw, tagRaw, dataRaw] = String(value).split('.');
  if (!ivRaw || !tagRaw || !dataRaw) throw new Error('Stored Gmail token is invalid');
  const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
}

function signState(payload) {
  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'change-me';
  const sig = crypto.createHmac('sha256', secret).update(raw).digest('base64url');
  return `${raw}.${sig}`;
}

function verifyState(state) {
  const [raw, sig] = String(state || '').split('.');
  if (!raw || !sig) return null;
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'change-me';
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  if (!payload || payload.exp < Date.now()) return null;
  return payload;
}

async function getSettings() {
  const rows = await supabase('settings?id=eq.1&select=*');
  return rows && rows[0] ? rows[0] : null;
}

async function updateSettings(patch) {
  await supabase('settings?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: 1, ...patch, updated_at: new Date().toISOString() })
  });
}

async function exchangeCode(req, code) {
  const { clientId, clientSecret, redirectUri } = oauthConfig(req);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' })
  });
  const data = await response.json();
  if (!response.ok) {
    const e = new Error(data.error_description || data.error || 'Google OAuth token exchange failed');
    e.status = 400; e.data = data; throw e;
  }
  return data;
}

async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = oauthConfig({ headers: { host: 'unused', 'x-forwarded-proto': 'https' } });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' })
  });
  const data = await response.json();
  if (!response.ok) {
    const e = new Error(data.error_description || data.error || 'Could not refresh Gmail access token');
    e.status = 401; e.data = data; throw e;
  }
  return data.access_token;
}

async function getGmailProfile(accessToken) {
  const response = await fetch(
    'https://openidconnect.googleapis.com/v1/userinfo',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const e = new Error(
      data.error_description ||
      data.error ||
      'Could not read Google account email'
    );
    e.status = response.status;
    e.data = data;
    throw e;
  }

  return {
    emailAddress: data.email || ''
  };
}

function encodeMime(text) {
  return Buffer.from(text, 'utf8').toString('base64url');
}

function makeMime({ to, subject, text, from }) {
  const clean = v => String(v || '').replace(/[\r\n]/g, ' ').trim();
  const body = String(text || '').replace(/\r?\n/g, '\r\n');
  return [
    `From: ${clean(from || 'AMC Enterprises')}`,
    `To: ${clean(to)}`,
    `Subject: ${clean(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body
  ].join('\r\n');
}

async function sendEmail({ to, subject, text, eventKey = '', allowDuplicate = false }) {
  const recipient = String(to || '').trim();
  if (!recipient) return { skipped: true, reason: 'recipient_missing' };
  const settings = await getSettings();
  if (!settings?.gmail_enabled || !settings.gmail_refresh_token_enc) return { skipped: true, reason: 'gmail_not_connected' };

  if (eventKey && !allowDuplicate) {
    const existing = await supabase(`notification_log?event_key=eq.${encodeURIComponent(eventKey)}&select=id,status&limit=1`);
    if (existing && existing[0]?.status === 'sent') return { skipped: true, reason: 'already_sent', id: existing[0].id };
  }

  const refreshToken = decrypt(settings.gmail_refresh_token_enc);
  let accessToken;
  try {
    accessToken = await refreshAccessToken(refreshToken);
  } catch (e) {
    if (eventKey) await logNotification(eventKey, '', recipient, 'email', 'gmail', 'failed', '', e.message);
    throw e;
  }

  const mime = makeMime({ to: recipient, subject, text, from: settings.gmail_address || 'AMC Enterprises' });
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encodeMime(mime) })
  });
  const data = await response.json();
  if (!response.ok) {
    if (eventKey) await logNotification(eventKey, '', recipient, 'email', 'gmail', 'failed', '', data.error?.message || 'Gmail send failed');
    const e = new Error(data.error?.message || 'Gmail send failed');
    e.status = response.status; e.data = data; throw e;
  }
  if (eventKey) await logNotification(eventKey, '', recipient, 'email', 'gmail', 'sent', data.id || '', '');
  return { sent: true, messageId: data.id || '' };
}

async function logNotification(eventKey, orderId, recipientPhone, recipientType, provider, status, providerMessageId, error) {
  if (!eventKey) return;
  await supabase('notification_log?on_conflict=event_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: crypto.randomUUID(), event_key: eventKey, order_id: orderId || null, recipient_type: recipientType, recipient_phone: recipientPhone || '', event_type: 'email', provider, provider_message_id: providerMessageId || '', status, error: error || '', created_at: new Date().toISOString() })
  });
}

function emailEnabled(settings, key) {
  return settings?.[key] !== false;
}

module.exports = { GMAIL_SCOPE, oauthConfig, signState, verifyState, encrypt, decrypt, exchangeCode, getGmailProfile, getSettings, updateSettings, sendEmail, emailEnabled };
