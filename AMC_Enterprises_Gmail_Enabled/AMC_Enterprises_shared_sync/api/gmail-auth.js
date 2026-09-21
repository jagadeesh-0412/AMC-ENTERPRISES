const { requireAdmin } = require('../lib/auth');
const { GMAIL_SCOPE, oauthConfig, signState, verifyState, encrypt, exchangeCode, getGmailProfile, getSettings, updateSettings } = require('../lib/gmail');

module.exports = async (req, res) => {
  try {
    const action = String(req.query?.action || 'status');
    if (!requireAdmin(req, res)) return;

    if (req.method === 'GET' && action === 'connect') {
      const { clientId, redirectUri } = oauthConfig(req);
      const state = signState({ exp: Date.now() + 10 * 60 * 1000, nonce: require('crypto').randomUUID() });
      const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: GMAIL_SCOPE, state });
      res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
      return res.end();
    }

    

    if (req.method === 'GET' && action === 'status') {
      const settings = await getSettings();
      return res.json({ connected: !!settings?.gmail_refresh_token_enc, enabled: settings?.gmail_enabled !== false && !!settings?.gmail_refresh_token_enc, email: settings?.gmail_address || '', connectedAt: settings?.gmail_connected_at || '' });
    }

    if (req.method === 'POST' && action === 'disconnect') {
      await updateSettings({ gmail_enabled: false, gmail_address: '', gmail_refresh_token_enc: '', gmail_connected_at: '' });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message, details: e.data || null });
  }
};
