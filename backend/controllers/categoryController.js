const Category = require("../models/Category");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { success, fail } = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");
const { escapeRegex } = require("../utils/regex");
const audit = require("../services/auditService");

const DEFAULTS = {
  income: ["Salary", "Business", "Gifts", "Other Income"],
  expense: ["Rent", "Food", "Transport", "Utilities", "Health", "Education", "Other"],
};

const nameMatcher = (name) => new RegExp("^" + escapeRegex(name) + "$", "i");

// Give each account a starter set of categories the first time it lists them.
async function seedIfNeeded(user) {
  if (user.categoriesSeeded) return;
  const existing = await Category.countDocuments({ user: user._id });
  if (existing === 0) {
    const docs = [];
    Object.entries(DEFAULTS).forEach(([type, names]) =>
      names.forEach((name) => docs.push({ user: user._id, type, name }))
    );
    await Category.insertMany(docs);
  }
  await User.updateOne({ _id: user._id }, { $set: { categoriesSeeded: true } });
  user.categoriesSeeded = true;
}

// GET /api/categories?type=
const listCategories = asyncHandler(async (req, res) => {
  await seedIfNeeded(req.user);
  const filter = { user: req.user._id };
  if (["income", "expense"].includes(req.query.type)) filter.type = req.query.type;
  const categories = await Category.find(filter).sort({ name: 1 });
  return success(res, { data: { categories } });
});

// POST /api/categories  { name, type }
const createCategory = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const { type } = req.body;
  if (!name) return fail(res, { status: 400, message: "Category name is required" });
  if (!["income", "expense"].includes(type)) {
    return fail(res, { status: 400, message: "Type must be 'income' or 'expense'" });
  }
  if (name.length > 40) return fail(res, { status: 400, message: "Category name is too long (max 40)" });

  const dup = await Category.findOne({ user: req.user._id, type, name: nameMatcher(name) });
  if (dup) return fail(res, { status: 409, message: `"${name}" already exists in ${type} categories` });

  const category = await Category.create({ user: req.user._id, name, type });
  await audit.record(req.user._id, "category.create", { targetType: "Category", targetId: category._id, meta: { name, type } });

  return success(res, { status: 201, message: "Category created successfully", data: category });
});

// PUT /api/categories/:id  { name }  — renames and updates matching transactions
const updateCategory = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return fail(res, { status: 400, message: "Category name is required" });
  if (name.length > 40) return fail(res, { status: 400, message: "Category name is too long (max 40)" });

  const category = await Category.findOne({ _id: req.params.id, user: req.user._id });
  if (!category) return fail(res, { status: 404, message: "Category not found" });

  const dup = await Category.findOne({
    user: req.user._id,
    type: category.type,
    name: nameMatcher(name),
    _id: { $ne: category._id },
  });
  if (dup) return fail(res, { status: 409, message: `"${name}" already exists in ${category.type} categories` });

  const oldName = category.name;
  category.name = name;
  await category.save();

  if (oldName !== name) {
    await Transaction.updateMany(
      { user: req.user._id, type: category.type, category: oldName },
      { $set: { category: name } }
    );
  }

  await audit.record(req.user._id, "category.update", { targetType: "Category", targetId: category._id, meta: { from: oldName, to: name } });
  return success(res, { message: "Category updated successfully", data: category });
});

// DELETE /api/categories/:id — refused while transactions still use it
const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, user: req.user._id });
  if (!category) return fail(res, { status: 404, message: "Category not found" });

  const used = await Transaction.countDocuments({ user: req.user._id, type: category.type, category: category.name });
  if (used > 0) {
    return fail(res, {
      status: 409,
      message: `"${category.name}" is used by ${used} transaction${used === 1 ? "" : "s"}. Change or delete those first.`,
    });
  }

  await category.deleteOne();
  await audit.record(req.user._id, "category.delete", { targetType: "Category", targetId: category._id, meta: { name: category.name } });
  return success(res, { message: "Category deleted successfully" });
});

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
