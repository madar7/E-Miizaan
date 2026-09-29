// Promote an existing user to admin by username or email.
// Usage: node scripts/makeAdmin.js <username-or-email>
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

async function run() {
  const id = (process.argv[2] || "").trim().toLowerCase();
  if (!id) {
    console.error("Usage: node scripts/makeAdmin.js <username-or-email>");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOneAndUpdate(
    { $or: [{ username: id }, { email: id }] },
    { $set: { role: "admin" } },
    { new: true }
  );

  if (!user) {
    console.error(`No user found for "${id}". Register the account first, then run this again.`);
  } else {
    console.log(`${user.username || user.email} is now an admin.`);
  }

  await mongoose.disconnect();
}

run();
