const mongoose = require("mongoose");

// One business profile per small_business user. Kept separate from User
// (rather than embedded) so individual accounts carry zero business fields,
// and so this can grow (e.g. multiple staff per business) without reshaping User.
const businessProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    businessName: { type: String, required: true, trim: true, maxlength: 120 },
    logo: { type: String, default: null }, // data URL, same storage approach as User.profileImage
    ownerName: { type: String, trim: true, maxlength: 120 },
    businessType: { type: String, trim: true, maxlength: 60 },
    phone: { type: String, trim: true, maxlength: 30 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    address: { type: String, trim: true, maxlength: 240 },
    website: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BusinessProfile", businessProfileSchema);
