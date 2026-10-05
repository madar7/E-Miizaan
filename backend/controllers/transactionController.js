const Transaction = require("../models/Transaction");
const Category = require("../models/Category");
const { success, fail } = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");
const { escapeRegex } = require("../utils/regex");
const finance = require("../services/financeService");
const audit = require("../services/auditService");

// A transaction's category must already exist (for this user, matching
// type) before it can be assigned — prevents typos silently creating
// orphaned category names that never show up in Add Category.
async function categoryExists(userId, type, name) {
  const pattern = new RegExp("^" + escapeRegex(String(name).trim()) + "$", "i");
  return Boolean(await Category.exists({ user: userId, type, name: pattern }));
}

// POST /api/transactions
const createTransaction = asyncHandler(async (req, res) => {
  const { type, amount, category, description, date, paymentMethod, notes } = req.body;

  if (!type || !["income", "expense"].includes(type)) {
    return fail(res, { status: 400, message: "Type must be 'income' or 'expense'" });
  }
  if (amount === undefined || Number(amount) <= 0) {
    return fail(res, { status: 400, message: "Amount must be a positive number" });
  }
  if (!category) {
    return fail(res, { status: 400, message: "Category is required" });
  }
  if (!(await categoryExists(req.user._id, type, category))) {
    return fail(res, { status: 400, message: `"${category}" is not one of your ${type} categories. Add it first.` });
  }

  const transaction = await Transaction.create({
    user: req.user._id,
    type,
    amount,
    category,
    description,
    date: date || Date.now(),
    paymentMethod,
    notes,
  });

  await audit.record(req.user._id, "transaction.create", {
    targetType: "Transaction",
    targetId: transaction._id,
    meta: { type, amount, category },
  });

  return success(res, { status: 201, message: "Transaction created successfully", data: transaction });
});

// GET /api/transactions?type=&category=&startDate=&endDate=&search=&page=&limit=
const getTransactions = asyncHandler(async (req, res) => {
  const { type, category, startDate, endDate, search, page = 1, limit = 20 } = req.query;

  const filter = { user: req.user._id };
  if (type && ["income", "expense"].includes(type)) filter.type = type;
  if (category) filter.category = category;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
  }
  if (search) {
    const pattern = escapeRegex(search);
    filter.$or = [
      { description: { $regex: pattern, $options: "i" } },
      { category: { $regex: pattern, $options: "i" } },
    ];
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Transaction.countDocuments(filter),
  ]);

  return success(res, {
    data: {
      transactions,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) || 1 },
    },
  });
});

// GET /api/transactions/summary?startDate=&endDate=
const getSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const report = await finance.rangeReport(req.user._id, startDate, endDate);

  // Keep the historical shape (byCategory as one merged list) for the existing dashboard chart.
  const byCategory = [
    ...report.incomeByCategory.map((c) => ({ type: "income", category: c.category, total: c.total })),
    ...report.expenseByCategory.map((c) => ({ type: "expense", category: c.category, total: c.total })),
  ].sort((a, b) => b.total - a.total);

  return success(res, {
    data: {
      totalIncome: report.totalIncome,
      totalExpense: report.totalExpense,
      balance: report.balance,
      byCategory,
    },
  });
});

// GET /api/transactions/summary/monthly?months=6
const getMonthlySummary = asyncHandler(async (req, res) => {
  const months = Math.min(Math.max(parseInt(req.query.months, 10) || 6, 1), 24);
  const series = await finance.monthlySeries(req.user._id, months);
  return success(res, { data: { months: series } });
});

// GET /api/transactions/dashboard?today=YYYY-MM-DD
const getDashboard = asyncHandler(async (req, res) => {
  const data = await finance.dashboardTotals(req.user._id, req.query.today);
  return success(res, { data });
});

// GET /api/transactions/:id
const getTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
  if (!transaction) return fail(res, { status: 404, message: "Transaction not found" });
  return success(res, { data: transaction });
});

// PUT /api/transactions/:id
const updateTransaction = asyncHandler(async (req, res) => {
  const { type, amount, category, description, date, paymentMethod, notes } = req.body;

  if (type && !["income", "expense"].includes(type)) {
    return fail(res, { status: 400, message: "Type must be 'income' or 'expense'" });
  }
  if (amount !== undefined && Number(amount) <= 0) {
    return fail(res, { status: 400, message: "Amount must be a positive number" });
  }

  if (category !== undefined) {
    // Validate against the transaction's (possibly also-updated) type.
    const existing = type === undefined ? await Transaction.findOne({ _id: req.params.id, user: req.user._id }) : null;
    const effectiveType = type || existing?.type;
    if (effectiveType && !(await categoryExists(req.user._id, effectiveType, category))) {
      return fail(res, { status: 400, message: `"${category}" is not one of your ${effectiveType} categories. Add it first.` });
    }
  }

  const transaction = await Transaction.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { $set: { type, amount, category, description, date, paymentMethod, notes } },
    { new: true, runValidators: true, omitUndefined: true }
  );

  if (!transaction) return fail(res, { status: 404, message: "Transaction not found" });

  await audit.record(req.user._id, "transaction.update", { targetType: "Transaction", targetId: transaction._id });
  return success(res, { message: "Transaction updated successfully", data: transaction });
});

// DELETE /api/transactions/:id
const deleteTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!transaction) return fail(res, { status: 404, message: "Transaction not found" });

  await audit.record(req.user._id, "transaction.delete", { targetType: "Transaction", targetId: transaction._id });
  return success(res, { message: "Transaction deleted successfully" });
});

module.exports = {
  createTransaction,
  getTransactions,
  getSummary,
  getMonthlySummary,
  getDashboard,
  getTransaction,
  updateTransaction,
  deleteTransaction,
};
