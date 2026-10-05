const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than 0"],
    },
    // Category is stored by name (not a categoryId reference) on purpose:
    // it keeps rename-and-cascade trivial (one updateMany) and the schema
    // easy to follow. Each name is still validated against the user's own
    // Category collection at write time in the controller.
    category: { type: String, required: true, trim: true },
    // Section 13/14: optional context fields. Payment method is a free string
    // (not a hard enum) so new methods (e.g. a new mobile-money provider) don't
    // require a migration — the frontend offers a curated list plus "Other".
    paymentMethod: { type: String, trim: true, maxlength: 40, default: "" },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    description: { type: String, trim: true, default: "" },
    date: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

// Every list/filter query is scoped by user first, so these compound
// indexes (both prefixed by user) cover the common query shapes: plain
// date-sorted listing, and type-filtered + date-sorted listing/aggregation.
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1, date: -1 });

module.exports = mongoose.model("Transaction", transactionSchema);
