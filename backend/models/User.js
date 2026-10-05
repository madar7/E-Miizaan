const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const SUPPORTED_CURRENCIES = ["USD", "SOS", "EUR", "GBP", "KES", "ETB"];
const SUPPORTED_LANGUAGES = ["en", "so", "ar"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: {
      type: String,
      unique: true,
      sparse: true, // older accounts created before usernames existed have none
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_.-]{3,30}$/, "Username must be 3-30 characters: letters, numbers, . _ -"],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true, maxlength: 30 },
    country: { type: String, trim: true, maxlength: 60 },
    timezone: { type: String, trim: true, maxlength: 60 },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isActive: { type: Boolean, default: true },

    // Section 1: account type (individual vs small business) shapes dashboard wording and settings.
    accountType: { type: String, enum: ["individual", "small_business"], default: "individual" },

    // Section 29: registration can require admin sign-off before a new user can log in.
    approvalStatus: { type: String, enum: ["approved", "pending", "rejected"], default: "approved" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // who created this account, if an admin/user did (not self-registered)

    // Section 3: profile image stored as a data URL. Real deployments should swap this for
    // an object-storage URL (S3/Cloudinary/etc) via STORAGE_PROVIDER — see utils/imageStorage.js.
    profileImage: { type: String, default: null },

    // Section 2/4/7: per-user preferences.
    theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
    language: { type: String, enum: SUPPORTED_LANGUAGES, default: "en" },
    currency: { type: String, enum: SUPPORTED_CURRENCIES, default: "USD" },

    // Section 7: notification preferences — stored, not yet wired to an actual delivery
    // channel (no email/push infra exists in this project); see README for scope notes.
    notifications: {
      transactions: { type: Boolean, default: true },
      account: { type: Boolean, default: true },
      system: { type: Boolean, default: true },
      userManagement: { type: Boolean, default: true },
    },

    onboardingCompleted: { type: Boolean, default: false },

    categoriesSeeded: { type: Boolean, default: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.resetPasswordToken;
    delete ret.resetPasswordExpires;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
module.exports.SUPPORTED_CURRENCIES = SUPPORTED_CURRENCIES;
module.exports.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
