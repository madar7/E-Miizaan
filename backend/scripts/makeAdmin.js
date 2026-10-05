// Promote an existing user to admin by username or email.
// Usage: node scripts/makeAdmin.js <username-or-email>
require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const User = require("../models/User");

async function run() {
  const id = (process.argv[2] || "").trim().toLowerCase();
  if (!id) {
    console.error("Usage: node scripts/makeAdmin.js <username-or-email>");
    console.error('Example: node scripts/makeAdmin.js ibrahim');
    process.exit(1);
  }

  // Diagnostic: is there even a .env file where this script expects one?
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    console.error(`No .env file found at ${envPath}`);
    console.error("Copy .env.example to .env in the backend folder and fill in MONGO_URI first.");
    process.exit(1);
  }

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set in your .env file.");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  try {
    await mongoose.connect(process.env.MONGO_URI);
  } catch (err) {
    console.error("Could not connect to MongoDB:", err.message);
    console.error("Check that MONGO_URI in .env is correct and reachable (e.g. your Atlas cluster is running and your IP is allowed).");
    process.exit(1);
  }
  console.log("Connected. Looking for:", id);

  const user = await User.findOneAndUpdate(
    { $or: [{ username: id }, { email: id }] },
    { $set: { role: "admin" } },
    { new: true }
  );

  if (!user) {
    console.error(`\nNo user found for "${id}".`);
    const allUsers = await User.find().select("username email role").limit(20);
    if (allUsers.length === 0) {
      console.error("In fact, there are NO users in this database at all.");
      console.error("That means either:");
      console.error("  1) You haven't registered an account on the frontend yet, or");
      console.error("  2) This script is connecting to a DIFFERENT database than your running server is.");
      console.error("     Double-check MONGO_URI here matches the one your backend server is actually using.");
    } else {
      console.log("\nAccounts that DO exist in this database:");
      allUsers.forEach((u) => console.log(`  - username: ${u.username || "(none)"}  email: ${u.email}  role: ${u.role}`));
      console.log('\nRun this script again using one of the exact values above.');
    }
  } else {
    console.log(`\nSuccess: ${user.username || user.email} is now an admin.`);
    console.log("Now log out and log back in on the website for this to take effect in your session.");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});