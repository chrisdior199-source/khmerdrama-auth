export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SUPABASE_URL = 'https://hzfakfaeoqsknogiwmtp.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6ZmFrZmFlb3Fza25vZ2l3bXRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM3MDgyNiwiZXhwIjoyMDg1OTQ2ODI2fQ.yLne8eg-sjgVpdGoUEQe1v_TqGsuceXeB1XoB1Kstzk';

  const update = req.body;
  const message = update?.message;
  if (!message) return res.status(200).json({ ok: true });

  const text = message?.text || '';
  const from = message?.from || {};

  // Handle /start TOKEN
  if (text.startsWith('/start ')) {
    const token = text.replace('/start ', '').trim();
    if (!token || token.length < 10) return res.status(200).json({ ok: true });

    // Update token in Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/telegram_login_tokens?token=eq.${token}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        telegram_id: String(from.id),
        first_name: from.first_name || '',
        last_name: from.last_name || '',
        username: from.username || '',
        photo_url: '',
        status: 'completed'
      })
    });

    // Send welcome message to user
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: from.id,
        text: '✅ Login successful! You can now return to the TosMer app.'
      })
    });
  }

  return res.status(200).json({ ok: true });
}
