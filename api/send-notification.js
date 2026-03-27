const admin = require("firebase-admin");

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// In-memory history (resets on cold start; use Supabase for persistence if needed)
const notificationHistory = [];

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Simple password protection
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
    const message = {
      notification: {
        title,
        body,
        ...(imageUrl && { imageUrl }),
      },
      data: {
        type: type || "general",
        ...(dramaId && { drama_id: dramaId }),
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
      android: {
        notification: {
          channelId: getChannelId(type),
          priority: "high",
          sound: "default",
          ...(imageUrl && { imageUrl }),
        },
        priority: "high",
      },
    };

    let response;
    let recipientCount = 0;

    if (sendToAll) {
      // Send to topic "all_users" — devices must subscribe to this topic
      message.topic = "all_users";
      response = await admin.messaging().send(message);
      recipientCount = -1; // unknown count for topic
    } else if (tokens && tokens.length > 0) {
      // Send to specific tokens (multicast)
      const multicastMessage = {
        ...message,
        tokens: tokens,
      };
      delete multicastMessage.topic;
      response = await admin.messaging().sendEachForMulticast(multicastMessage);
      recipientCount = response.successCount;
    } else {
      return res.status(400).json({ error: "Provide tokens or set sendToAll=true" });
    }

    // Save to history
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
    case "vip": return "tosmer_vip";
    case "checkin": return "tosmer_checkin";
    default: return "tosmer_main";
  }
}

// Export history for the history endpoint
module.exports.notificationHistory = notificationHistory;
