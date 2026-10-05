const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { success, fail } = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");
const { validateAndStore } = require("../utils/imageStorage");
const audit = require("../services/auditService");

const EDITABLE_FIELDS = ["name", "phone", "country", "timezone", "language", "theme", "currency"];

// GET /api/profile
const getProfile = asyncHandler(async (req, res) => {
  return success(res, { data: { user: req.user } });
});

// PATCH /api/profile — never accepts role, accountType changes here are allowed
// (a user choosing individual/business is self-service), but role/isActive/
// approvalStatus are deliberately not in EDITABLE_FIELDS, so no payload can touch them.
const updateProfile = asyncHandler(async (req, res) => {
  const update = {};
  for (const field of EDITABLE_FIELDS) {
    if (req.body[field] !== undefined) update[field] = req.body[field];
  }
  if (req.body.accountType !== undefined) {
    if (!["individual", "small_business"].includes(req.body.accountType)) {
      return fail(res, { status: 400, message: "accountType must be 'individual' or 'small_business'" });
    }
    update.accountType = req.body.accountType;
  }
  if (req.body.notifications !== undefined && typeof req.body.notifications === "object") {
    const allowed = ["transactions", "account", "system", "userManagement"];
    for (const key of allowed) {
      if (req.body.notifications[key] !== undefined) {
        update[`notifications.${key}`] = Boolean(req.body.notifications[key]);
      }
    }
  }

  const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true, runValidators: true });
  await audit.record(req.user._id, "profile.updated", { targetType: "User", targetId: user._id, meta: Object.keys(update) });

  // Settings endpoints (language/theme/currency) log their own, more specific action too,
  // so other users of this controller (profile.html) still get a clear audit trail.
  if (update.language) await audit.record(req.user._id, "language.changed", { targetType: "User", targetId: user._id, meta: { language: update.language } });
  if (update.theme) await audit.record(req.user._id, "theme.changed", { targetType: "User", targetId: user._id, meta: { theme: update.theme } });

  return success(res, { message: "Profile updated successfully", data: { user } });
});

// PATCH /api/profile/password  { currentPassword, newPassword }
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return fail(res, { status: 400, message: "Current and new password are required" });
  }
  if (newPassword.length < 6) {
    return fail(res, { status: 400, message: "New password must be at least 6 characters" });
  }

  const user = await User.findById(req.user._id);
  if (!(await user.comparePassword(currentPassword))) {
    return fail(res, { status: 401, message: "Current password is incorrect" });
  }

  user.password = newPassword;
  await user.save();
  await audit.record(req.user._id, "password.changed", { targetType: "User", targetId: user._id });

  return success(res, { message: "Password changed successfully" });
});

// POST /api/profile/image  { image: "data:image/png;base64,..." }
const uploadProfileImage = asyncHandler(async (req, res) => {
  let stored;
  try {
    stored = validateAndStore(req.body.image);
  } catch (err) {
    return fail(res, { status: err.status || 400, message: err.message });
  }

  const user = await User.findByIdAndUpdate(req.user._id, { $set: { profileImage: stored } }, { new: true });
  await audit.record(req.user._id, "profile_image.updated", { targetType: "User", targetId: user._id });

  return success(res, { message: "Profile image updated successfully", data: { user } });
});

// DELETE /api/profile/image
const removeProfileImage = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user._id, { $set: { profileImage: null } }, { new: true });
  await audit.record(req.user._id, "profile_image.updated", { targetType: "User", targetId: user._id, meta: { removed: true } });
  return success(res, { message: "Profile image removed", data: { user } });
});

// PATCH /api/profile/deactivate — self-service deactivation, gated by SystemSettings
const deactivateOwnAccount = asyncHandler(async (req, res) => {
  const SystemSettings = require("../models/SystemSettings");
  const settings = await SystemSettings.getSettings();
  if (!settings.allowUsersToDeactivateOwnAccount) {
    return fail(res, { status: 403, message: "Self-deactivation is disabled. Contact an administrator." });
  }

  const user = await User.findByIdAndUpdate(req.user._id, { $set: { isActive: false } }, { new: true });
  await audit.record(req.user._id, "user.deactivated", { targetType: "User", targetId: user._id, meta: { self: true } });
  return success(res, { message: "Your account has been deactivated" });
});

module.exports = { getProfile, updateProfile, changePassword, uploadProfileImage, removeProfileImage, deactivateOwnAccount };
