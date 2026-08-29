// Run once to generate the VAPID key pair needed for push notifications.
// Usage: node scripts/generateVapidKeys.js
// Copy the output into backend/.env as VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY,
// and the public key into frontend/.env as VITE_VAPID_PUBLIC_KEY.
const webpush = require("web-push");
const keys = webpush.generateVAPIDKeys();
console.log("VAPID_PUBLIC_KEY=" + keys.publicKey);
console.log("VAPID_PRIVATE_KEY=" + keys.privateKey);
