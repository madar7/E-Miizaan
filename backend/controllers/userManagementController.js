const User = require("../models/User");
const SystemSettings = require("../models/SystemSettings");
const { success, fail } = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");
const audit = require("../services/auditService");

const USERNAME_RE = /^[a-z0-9_.-]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/users/policy — tells the frontend whether to show "+ Add User" at
// all; the POST below is the actual enforcement point, this is just so the
// UI doesn't dangle a button that will always 403.
const getCreationPolicy = asyncHandler(async (req, res) => {
  const settings = await SystemSettings.getSettings();
  const canCreate = req.user.role === "admin" || settings.allowUsersToCreateUsers;
  return success(res, { data: { canCreateUsers: canCreate, canCreateAdmins: req.user.role === "admin" } });
});

// POST /api/users — creation path usable by admins always, and by normal
// users only when the system setting allows it. SECURITY: role is never
// taken from the request body for a non-admin caller — it is hard-set to
// "user" — and maxUsers / approval rules are evaluated server-side only.
const createUser = asyncHandler(async (req, res) => {
  const settings = await SystemSettings.getSettings();
  const isAdmin = req.user.role === "admin";

  if (!isAdmin && !settings.allowUsersToCreateUsers) {
    return fail(res, { status: 403, message: "User creation by non-admins is currently disabled" });
  }

  const { name, email, password } = req.body;
  const username = String(req.body.username || "").trim().toLowerCase();
  let { role } = req.body;

  if (!name || !username || !email || !password) {
    return fail(res, { status: 400, message: "Name, username, email and password are required" });
  }
  if (!USERNAME_RE.test(username)) {
    return fail(res, { status: 400, message: "Username must be 3-30 characters: letters, numbers, . _ -" });
  }
  if (!EMAIL_RE.test(email)) {
    return fail(res, { status: 400, message: "Enter a valid email address" });
  }
  if (password.length < 6) {
    return fail(res, { status: 400, message: "Password must be at least 6 characters" });
  }

  // The security-critical line: a non-admin's requested role is simply discarded.
  if (!isAdmin) {
    role = "user";
  } else if (role && !["user", "admin"].includes(role)) {
    return fail(res, { status: 400, message: "Role must be 'user' or 'admin'" });
  } else {
    role = role || "user";
  }

  if (settings.maxUsers > 0) {
    const count = await User.countDocuments();
    if (count >= settings.maxUsers) {
      return fail(res, { status: 403, message: "The maximum number of user accounts has been reached" });
    }
  }

  if (await User.findOne({ username })) {
    return fail(res, { status: 409, message: "That username is already taken" });
  }
  if (await User.findOne({ email: email.toLowerCase() })) {
    return fail(res, { status: 409, message: "An account with this email already exists" });
  }

  // Admin-created accounts are implicitly vetted; everyone else's follow the approval setting.
  const approvalStatus = isAdmin ? "approved" : settings.requireAdminApproval ? "pending" : "approved";

  const user = await User.create({ name, username, email, password, role, approvalStatus, createdBy: req.user._id });
  await audit.record(req.user._id, "user.created", { targetType: "User", targetId: user._id, meta: { role, approvalStatus } });

  return success(res, { status: 201, message: "User created successfully", data: { user } });
});

module.exports = { getCreationPolicy, createUser };
