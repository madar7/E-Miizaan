const mongoose = require("mongoose");

// A lightweight, append-only trail of sensitive actions. Financial systems
// should be able to answer "who did what, when" — this is that record.
const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: {
      type: String,
      required: true,
      enum: [
        "login",
        "register",
        "transaction.create",
        "transaction.update",
        "transaction.delete",
        "category.create",
        "category.update",
        "category.delete",
        "user.role_change",
        "user.status_change",
        "user.delete",
        // Section 22 additions:
        "profile.updated",
        "profile_image.updated",
        "password.changed",
        "settings.updated",
        "language.changed",
        "theme.changed",
        "business_profile.updated",
        "user.created",
        "user.updated",
        "user.deactivated",
        "user.activated",
        "user.approved",
        "user.rejected",
      ],
    },
    targetType: { type: String }, // e.g. "Transaction", "Category", "User"
    targetId: { type: mongoose.Schema.Types.ObjectId },
    meta: { type: mongoose.Schema.Types.Mixed }, // small, non-sensitive context (e.g. amount, category name)
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
