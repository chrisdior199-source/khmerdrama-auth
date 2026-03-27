// Note: In-memory history is shared via module cache within the same Vercel instance.
// For persistent history across cold starts, integrate with Supabase.
const { notificationHistory } = require("./send-notification");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.status(200).json({ history: notificationHistory || [] });
};
