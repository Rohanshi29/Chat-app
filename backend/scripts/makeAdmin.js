// One-off CLI script to promote a user to admin.
// Usage: node scripts/makeAdmin.js user@example.com
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/makeAdmin.js <email>");
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOneAndUpdate(
    { email },
    { role: "admin" },
    { new: true }
  );
  if (!user) {
    console.error(`No user found with email ${email}`);
  } else {
    console.log(`${user.username} (${user.email}) is now an admin.`);
  }
  await mongoose.disconnect();
})();
