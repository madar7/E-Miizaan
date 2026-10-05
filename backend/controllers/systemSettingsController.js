const SystemSettings = require("../models/SystemSettings");
const { success, fail } = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");
const audit = require("../services/auditService");

const EDITABLE = [
  "allowUserRegistration",
  "allowUsersToCreateUsers",
  "requireAdminApproval",
  "allowUsersToDeactivateOwnAccount",
  "maxUsers",
];

// GET /api/admin/settings — admin only (route-gated)
const getSystemSettings = asyncHandler(async (req, res) => {
  const settings = await SystemSettings.getSettings();
  return success(res, { data: { settings } });
});

// PATCH /api/admin/settings — admin only
const updateSystemSettings = asyncHandler(async (req, res) => {
  const update = {};
  for (const field of EDITABLE) {
    if (req.body[field] !== undefined) update[field] = req.body[field];
  }
  if (update.maxUsers !== undefined && (!Number.isInteger(update.maxUsers) || update.maxUsers < 0)) {
    return fail(res, { status: 400, message: "maxUsers must be a non-negative integer (0 = unlimited)" });
  }

  const settings = await SystemSettings.findByIdAndUpdate("system", { $set: update }, { new: true, upsert: true, runValidators: true });
  await audit.record(req.user._id, "settings.updated", { targetType: "SystemSettings", targetId: settings._id, meta: update });

  return success(res, { message: "System settings updated", data: { settings } });
});

module.exports = { getSystemSettings, updateSystemSettings };
