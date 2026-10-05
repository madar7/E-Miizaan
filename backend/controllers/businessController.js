const BusinessProfile = require("../models/BusinessProfile");
const { success, fail } = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");
const { validateAndStore } = require("../utils/imageStorage");
const audit = require("../services/auditService");

// GET /api/business
const getBusiness = asyncHandler(async (req, res) => {
  const profile = await BusinessProfile.findOne({ user: req.user._id });
  return success(res, { data: { business: profile } }); // null if not created yet — the frontend prompts for it
});

// PATCH /api/business — creates on first save (upsert), updates after.
const updateBusiness = asyncHandler(async (req, res) => {
  const { businessName, ownerName, businessType, phone, email, address, website, logo } = req.body;

  if (businessName !== undefined && !String(businessName).trim()) {
    return fail(res, { status: 400, message: "Business name is required" });
  }

  const update = {};
  for (const [key, val] of Object.entries({ businessName, ownerName, businessType, phone, email, address, website })) {
    if (val !== undefined) update[key] = val;
  }
  if (logo !== undefined) {
    if (logo === null) {
      update.logo = null;
    } else {
      try {
        update.logo = validateAndStore(logo);
      } catch (err) {
        return fail(res, { status: err.status || 400, message: err.message });
      }
    }
  }

  const existing = await BusinessProfile.findOne({ user: req.user._id });
  if (!existing && !update.businessName) {
    return fail(res, { status: 400, message: "Business name is required to create a business profile" });
  }

  const profile = await BusinessProfile.findOneAndUpdate(
    { user: req.user._id },
    { $set: update, $setOnInsert: { user: req.user._id } },
    { new: true, upsert: true, runValidators: true }
  );

  await audit.record(req.user._id, "business_profile.updated", { targetType: "BusinessProfile", targetId: profile._id });
  return success(res, { message: "Business profile saved", data: { business: profile } });
});

module.exports = { getBusiness, updateBusiness };
