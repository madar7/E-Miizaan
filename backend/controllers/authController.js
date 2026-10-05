const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const SystemSettings = require("../models/SystemSettings");
const { sendPasswordResetEmail } = require("../utils/mailer");
const { success, fail } = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");
const audit = require("../services/auditService");

const USERNAME_RE = /^[a-z0-9_.-]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCOUNT_TYPES = ["individual", "small_business"];
const LANGUAGES = ["en", "so", "ar"];
const THEMES = ["light", "dark", "system"];
const CURRENCIES = ["USD", "SOS", "EUR", "GBP", "KES", "ETB"];

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// POST /api/auth/register  { name, username, email, password, accountType?, language?, theme?, currency? }
// Note: `role` is never read from the body here — self-registration is always role "user".
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const username = String(req.body.username || "").trim().toLowerCase();

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

  const optional = {};
  if (req.body.accountType !== undefined) {
    if (!ACCOUNT_TYPES.includes(req.body.accountType)) return fail(res, { status: 400, message: "Invalid account type" });
    optional.accountType = req.body.accountType;
  }
  if (req.body.language !== undefined) {
    if (!LANGUAGES.includes(req.body.language)) return fail(res, { status: 400, message: "Invalid language" });
    optional.language = req.body.language;
  }
  if (req.body.theme !== undefined) {
    if (!THEMES.includes(req.body.theme)) return fail(res, { status: 400, message: "Invalid theme" });
    optional.theme = req.body.theme;
  }
  if (req.body.currency !== undefined) {
    if (!CURRENCIES.includes(req.body.currency)) return fail(res, { status: 400, message: "Invalid currency" });
    optional.currency = req.body.currency;
  }

  const settings = await SystemSettings.getSettings();
  if (!settings.allowUserRegistration) {
    return fail(res, { status: 403, message: "Self-registration is currently disabled. Ask an administrator to create your account." });
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

  const approvalStatus = settings.requireAdminApproval ? "pending" : "approved";
  const user = await User.create({ name, username, email, password, ...optional, approvalStatus });
  await audit.record(user._id, "register", { targetType: "User", targetId: user._id, meta: { approvalStatus } });

  if (approvalStatus === "pending") {
    return success(res, {
      status: 201,
      message: "Account created. An administrator must approve it before you can sign in.",
      data: { user, pendingApproval: true },
    });
  }

  const token = signToken(user._id);
  return success(res, { status: 201, message: "Account created", data: { token, user } });
});

// POST /api/auth/login  { username, password }  (username may also be the account's email)
const login = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const identifier = String(req.body.username || req.body.email || "").trim().toLowerCase();

  if (!identifier || !password) {
    return fail(res, { status: 400, message: "Username and password are required" });
  }

  const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
  if (!user || !(await user.comparePassword(password))) {
    return fail(res, { status: 401, message: "Invalid username or password" });
  }
  if (user.approvalStatus === "pending") {
    return fail(res, { status: 403, message: "Your account is awaiting administrator approval." });
  }
  if (user.approvalStatus === "rejected") {
    return fail(res, { status: 403, message: "This account's registration was not approved. Contact an administrator." });
  }
  if (!user.isActive) {
    return fail(res, { status: 403, message: "This account has been deactivated. Contact the administrator." });
  }

  const token = signToken(user._id);
  await audit.record(user._id, "login", { targetType: "User", targetId: user._id });

  return success(res, { message: "Signed in", data: { token, user } });
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  return success(res, { data: { user: req.user } });
});

// POST /api/auth/forgot-password
// Always answers with the same message so it can't be used to discover registered emails.
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return fail(res, { status: 400, message: "Email is required" });
  }

  const genericMessage = "If an account with that email exists, a reset link has been sent.";
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return success(res, { message: genericMessage });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = Date.now() + 30 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const resetUrl = `${clientUrl}/reset-password.html?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
  await sendPasswordResetEmail(user.email, resetUrl);

  return success(res, { message: genericMessage });
});

// POST /api/auth/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { email, token, password } = req.body;

  if (!email || !token || !password) {
    return fail(res, { status: 400, message: "Email, token and new password are required" });
  }
  if (password.length < 6) {
    return fail(res, { status: 400, message: "Password must be at least 6 characters" });
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    email: email.toLowerCase(),
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  }).select("+resetPasswordToken +resetPasswordExpires");

  if (!user) {
    return fail(res, { status: 400, message: "This reset link is invalid or has expired" });
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  const jwtToken = signToken(user._id);
  return success(res, { message: "Password updated successfully", data: { token: jwtToken, user } });
});

module.exports = { register, login, getMe, forgotPassword, resetPassword };
