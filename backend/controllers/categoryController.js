const Category = require("../models/Category");
const Transaction = require("../models/Transaction");
const User = require("../models/User");

const DEFAULTS = {
  income: ["Salary", "Business", "Gifts", "Other Income"],
  expense: ["Rent", "Food", "Transport", "Utilities", "Health", "Education", "Other"],
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
async function listCategories(req, res) {
  try {
    await seedIfNeeded(req.user);
    const filter = { user: req.user._id };
    if (["income", "expense"].includes(req.query.type)) filter.type = req.query.type;
    const categories = await Category.find(filter).sort({ name: 1 });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch categories", error: err.message });
  }
}

// POST /api/categories  { name, type }
async function createCategory(req, res) {
  try {
    const name = String(req.body.name || "").trim();
    const { type } = req.body;
    if (!name) return res.status(400).json({ message: "Category name is required" });
    if (!["income", "expense"].includes(type)) {
      return res.status(400).json({ message: "Type must be 'income' or 'expense'" });
    }
    if (name.length > 40) return res.status(400).json({ message: "Category name is too long (max 40)" });

    const dup = await Category.findOne({ user: req.user._id, type, name: nameMatcher(name) });
    if (dup) return res.status(409).json({ message: `"${name}" already exists in ${type} categories` });

    const category = await Category.create({ user: req.user._id, name, type });
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ message: "Failed to create category", error: err.message });
  }
}

// PUT /api/categories/:id  { name }  — renames and updates matching transactions
async function updateCategory(req, res) {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Category name is required" });
    if (name.length > 40) return res.status(400).json({ message: "Category name is too long (max 40)" });

    const category = await Category.findOne({ _id: req.params.id, user: req.user._id });
    if (!category) return res.status(404).json({ message: "Category not found" });

    const dup = await Category.findOne({
      user: req.user._id,
      type: category.type,
      name: nameMatcher(name),
      _id: { $ne: category._id },
    });
    if (dup) return res.status(409).json({ message: `"${name}" already exists in ${category.type} categories` });

    const oldName = category.name;
    category.name = name;
    await category.save();

    if (oldName !== name) {
      await Transaction.updateMany(
        { user: req.user._id, type: category.type, category: oldName },
        { $set: { category: name } }
      );
    }
    res.json(category);
  } catch (err) {
    res.status(500).json({ message: "Failed to update category", error: err.message });
  }
}

// DELETE /api/categories/:id — refused while transactions still use it
async function deleteCategory(req, res) {
  try {
    const category = await Category.findOne({ _id: req.params.id, user: req.user._id });
    if (!category) return res.status(404).json({ message: "Category not found" });

    const used = await Transaction.countDocuments({
      user: req.user._id,
      type: category.type,
      category: category.name,
    });
    if (used > 0) {
      return res.status(409).json({
        message: `"${category.name}" is used by ${used} transaction${used === 1 ? "" : "s"}. Change or delete those first.`,
      });
    }

    await category.deleteOne();
    res.json({ message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete category", error: err.message });
  }
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
