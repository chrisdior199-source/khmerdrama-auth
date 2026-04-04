export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SUPABASE_URL = 'https://hzfakfaeoqsknogiwmtp.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6ZmFrZmFlb3Fza25vZ2l3bXRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM3MDgyNiwiZXhwIjoyMDg1OTQ2ODI2fQ.yLne8eg-sjgVpdGoUEQe1v_TqGsuceXeB1XoB1Kstzk';
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  const update = req.body;
  const message = update?.message;
  if (!message) return res.status(200).json({ ok: true });

  const text = message?.text || '';
  const from = message?.from || {};

  if (text.startsWith('/start ')) {
    const token = text.replace('/start ', '').trim();
    if (!token || token.length < 10) return res.status(200).json({ ok: true });

    // Get and upload profile photo to Supabase Storage
    let publicPhotoUrl = '';
    try {
      const photosRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${from.id}&limit=1`);
      const photosData = await photosRes.json();
      if (photosData.ok && photosData.result.total_count > 0) {
        const fileId = photosData.result.photos[0][0].file_id;
        const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
        const fileData = await fileRes.json();
        if (fileData.ok) {
          const tgPhotoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
          
          // Download photo
          const photoRes = await fetch(tgPhotoUrl);
          const photoBuffer = await photoRes.arrayBuffer();
          
          // Upload to Supabase Storage
          const fileName = `telegram_${from.id}.jpg`;
          const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${fileName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'image/jpeg',
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'x-upsert': 'true'
            },
            body: photoBuffer
          });
          
          if (uploadRes.ok) {
            publicPhotoUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
          }
        }
      }
    } catch (e) {
      console.error('Photo upload error:', e);
    }

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
        photo_url: publicPhotoUrl,
        status: 'completed'
      })
    });

    // Send success message
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
