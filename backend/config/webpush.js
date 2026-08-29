const webpush = require("web-push");

const isConfigured = Boolean(
  process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
);

if (isConfigured) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL || "admin@example.com"}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Sends a push notification to a saved subscription. Silently no-ops (and
// logs) if push isn't configured or the subscription has expired/is invalid
// - a failed push should never break sending a chat message.
const sendPushNotification = async (subscription, payload) => {
  if (!isConfigured || !subscription) return;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (error) {
    console.error("Push notification failed:", error.message);
  }
};

module.exports = { sendPushNotification, isConfigured };
