const crypto = require('crypto');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const data = req.method === 'POST' ? req.body : req.query;
  
  const { hash, ...userData } = data;
  if (!hash) return res.status(400).json({ error: 'Missing hash' });

  // Verify Telegram hash
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const dataCheckString = Object.keys(userData)
    .sort()
    .map(k => `${k}=${userData[k]}`)
    .join('\n');
  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (expectedHash !== hash) {
    return res.status(403).json({ error: 'Invalid hash' });
  }

  // Auth date check (within 24 hours)
  const authDate = parseInt(userData.auth_date);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 86400) {
    return res.status(403).json({ error: 'Auth data expired' });
  }

  return res.status(200).json({ ok: true, user: userData });
}
