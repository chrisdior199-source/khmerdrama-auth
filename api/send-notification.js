const admin = require("firebase-admin");

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const notificationHistory = [];

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title, body, type, dramaId, imageUrl, tokens, sendToAll } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: "title and body are required" });
  }

  try {
    const channelId = getChannelId(type);

    // System-level notification — displayed by OS like major apps (WeChat, TikTok etc.)
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        type: type || "general",
        drama_id: dramaId || "",
      },
      android: {
        priority: "high",
        ttl: 86400000,
        notification: {
          channelId,
          sound: "default",
          defaultSound: true,
          notificationPriority: "PRIORITY_HIGH",
          visibility: "PUBLIC",
        },
      },
    };

    let response;
    let recipientCount = 0;

    if (sendToAll) {
      message.topic = "all_users";
      response = await admin.messaging().send(message);
      recipientCount = -1;
    } else if (tokens && tokens.length > 0) {
      const multicastMessage = { ...message, tokens };
      delete multicastMessage.topic;
      response = await admin.messaging().sendEachForMulticast(multicastMessage);
      recipientCount = response.successCount;
    } else {
      return res.status(400).json({ error: "Provide tokens or set sendToAll=true" });
    }

    const historyEntry = {
      id: Date.now().toString(),
      title,
      body,
      type: type || "general",
      dramaId: dramaId || null,
      imageUrl: imageUrl || null,
      sendToAll: !!sendToAll,
      recipientCount,
      sentAt: new Date().toISOString(),
      success: true,
    };
    notificationHistory.unshift(historyEntry);
    if (notificationHistory.length > 50) notificationHistory.pop();

    return res.status(200).json({
      success: true,
      messageId: typeof response === "string" ? response : null,
      successCount: recipientCount,
      history: historyEntry,
    });
  } catch (error) {
    console.error("FCM error:", error);
    const historyEntry = {
      id: Date.now().toString(),
      title,
      body,
      type: type || "general",
      sentAt: new Date().toISOString(),
      success: false,
      error: error.message,
    };
    notificationHistory.unshift(historyEntry);
    return res.status(500).json({ error: error.message });
  }
};

function getChannelId(type) {
  switch (type) {
    case "new_drama": return "tosmer_main";
    case "vip":       return "tosmer_vip";
    case "checkin":   return "tosmer_checkin";
    default:          return "tosmer_main";
  }
}

module.exports.notificationHistory = notificationHistory;
