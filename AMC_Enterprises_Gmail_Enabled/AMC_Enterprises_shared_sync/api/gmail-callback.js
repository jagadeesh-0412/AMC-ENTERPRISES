const {
  verifyState,
  exchangeCode,
  getGmailProfile,
  encrypt,
  updateSettings
} = require('../lib/gmail');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const state = verifyState(req.query?.state);

    if (!state) {
      return res
        .status(400)
        .send('Gmail authorization state is invalid or expired. Return to AMC Admin and try again.');
    }

    const code = String(req.query?.code || '');

    if (!code) {
      return res
        .status(400)
        .send('Google did not return an authorization code.');
    }

    const tokens = await exchangeCode(req, code);

    if (!tokens.refresh_token) {
      return res
        .status(400)
        .send('Google did not return a refresh token. Disconnect Gmail and connect again with consent enabled.');
    }

    const accessToken = tokens.access_token;
    const profile = await getGmailProfile(accessToken);

    await updateSettings({
      gmail_enabled: true,
      gmail_address: profile.emailAddress || '',
      gmail_refresh_token_enc: encrypt(tokens.refresh_token),
      gmail_connected_at: new Date().toISOString()
    });

    res.writeHead(302, {
      Location: '/?gmail=connected#gmail-settings'
    });

    return res.end();
  } catch (e) {
    return res
      .status(e.status || 500)
      .json({
        error: e.message,
        details: e.data || null
      });
  }
};