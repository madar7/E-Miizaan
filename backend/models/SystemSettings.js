const mongoose = require("mongoose");

// A single, admin-managed document holding system-wide user-management rules
// (section 9 of the spec). Enforced here are backend checks only — the
// frontend may hide a button, but the server is what actually decides.
const systemSettingsSchema = new mongoose.Schema({
  _id: { type: String, default: "system" },
  allowUserRegistration: { type: Boolean, default: true },
  allowUsersToCreateUsers: { type: Boolean, default: false },
  requireAdminApproval: { type: Boolean, default: false },
  allowUsersToDeactivateOwnAccount: { type: Boolean, default: true },
  defaultUserRole: { type: String, enum: ["user"], default: "user" }, // clamped: self-serve accounts can never default to admin
  maxUsers: { type: Number, default: 0 }, // 0 = unlimited
});

const SINGLETON_ID = "system";

async function getSettings() {
  let settings = await mongoose.model("SystemSettings").findById(SINGLETON_ID);
  if (!settings) {
    settings = await mongoose.model("SystemSettings").create({ _id: SINGLETON_ID });
  }
  return settings;
}

systemSettingsSchema.statics.getSettings = getSettings;

module.exports = mongoose.model("SystemSettings", systemSettingsSchema);
