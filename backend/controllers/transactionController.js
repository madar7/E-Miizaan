const Transaction = require("../models/Transaction");

// POST /api/transactions
async function createTransaction(req, res) {
  try {
    const { type, amount, category, description, date } = req.body;

    if (!type || !["income", "expense"].includes(type)) {
      return res.status(400).json({ message: "Type must be 'income' or 'expense'" });
    }
    if (amount === undefined || Number(amount) <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }
    if (!category) {
      return res.status(400).json({ message: "Category is required" });
    }

    const transaction = await Transaction.create({
      user: req.user._id,
      type,
      amount,
      category,
      description,
      date: date || Date.now(),
    });

    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ message: "Failed to create transaction", error: err.message });
  }
}

// GET /api/transactions?type=&category=&startDate=&endDate=&search=&page=&limit=
async function getTransactions(req, res) {
  try {
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
      filter.$or = [
        { description: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
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

    res.json({
      transactions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch transactions", error: err.message });
  }
}

// GET /api/transactions/summary?startDate=&endDate=
async function getSummary(req, res) {
  try {
    const { startDate, endDate } = req.query;
    const match = { user: req.user._id };
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate);
    }

    const results = await Transaction.aggregate([
      { $match: match },
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]);

    const totals = { income: 0, expense: 0 };
    results.forEach((r) => {
      totals[r._id] = r.total;
    });

    const byCategory = await Transaction.aggregate([
      { $match: match },
      { $group: { _id: { type: "$type", category: "$category" }, total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
    ]);

    res.json({
      totalIncome: totals.income,
      totalExpense: totals.expense,
      balance: totals.income - totals.expense,
      byCategory: byCategory.map((c) => ({
        type: c._id.type,
        category: c._id.category,
        total: c.total,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to compute summary", error: err.message });
  }
}

// GET /api/transactions/:id
async function getTransaction(req, res) {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch transaction", error: err.message });
  }
}

// PUT /api/transactions/:id
async function updateTransaction(req, res) {
  try {
    const { type, amount, category, description, date } = req.body;

    if (type && !["income", "expense"].includes(type)) {
      return res.status(400).json({ message: "Type must be 'income' or 'expense'" });
    }
    if (amount !== undefined && Number(amount) <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { type, amount, category, description, date } },
      { new: true, runValidators: true, omitUndefined: true }
    );

    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ message: "Failed to update transaction", error: err.message });
  }
}

// DELETE /api/transactions/:id
async function deleteTransaction(req, res) {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    res.json({ message: "Transaction deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete transaction", error: err.message });
  }
}

// GET /api/transactions/summary/monthly?months=6
// Returns income/expense totals per calendar month, oldest first — powers the dashboard chart.
async function getMonthlySummary(req, res) {
  try {
    const months = Math.min(Math.max(parseInt(req.query.months, 10) || 6, 1), 24);

    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    start.setMonth(start.getMonth() - (months - 1));

    const results = await Transaction.aggregate([
      { $match: { user: req.user._id, date: { $gte: start } } },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" }, type: "$type" },
          total: { $sum: "$amount" },
        },
      },
    ]);

    // Build a zero-filled scaffold for every month in the range so gaps show as $0, not missing bars.
    const scaffold = [];
    const cursor = new Date(start);
    for (let i = 0; i < months; i++) {
      scaffold.push({
        year: cursor.getFullYear(),
        month: cursor.getMonth() + 1,
        label: cursor.toLocaleDateString(undefined, { month: "short" }),
        income: 0,
        expense: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    results.forEach((r) => {
      const bucket = scaffold.find((s) => s.year === r._id.year && s.month === r._id.month);
      if (bucket) bucket[r._id.type] = r.total;
    });

    res.json({ months: scaffold });
  } catch (err) {
    res.status(500).json({ message: "Failed to compute monthly summary", error: err.message });
  }
}

// GET /api/transactions/dashboard?today=YYYY-MM-DD
// Totals per type for today, yesterday, this month, this year and all time.
// The browser sends its own calendar date so "today" matches the user's timezone.
// Transaction dates are stored as UTC midnight of the chosen calendar day, so ranges use UTC midnights too.
async function getDashboard(req, res) {
  try {
    const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(req.query.today || "")
      ? req.query.today
      : new Date().toISOString().slice(0, 10);
    const [y, m, d] = todayStr.split("-").map(Number);

    const DAY = 24 * 60 * 60 * 1000;
    const today = Date.UTC(y, m - 1, d);
    const range = (from, to) => ({
      $sum: {
        $cond: [{ $and: [{ $gte: ["$date", new Date(from)] }, { $lt: ["$date", new Date(to)] }] }, "$amount", 0],
      },
    });

    const rows = await Transaction.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: "$type",
          today: range(today, today + DAY),
          yesterday: range(today - DAY, today),
          month: range(Date.UTC(y, m - 1, 1), Date.UTC(y, m, 1)),
          year: range(Date.UTC(y, 0, 1), Date.UTC(y + 1, 0, 1)),
          total: { $sum: "$amount" },
        },
      },
    ]);

    const empty = () => ({ today: 0, yesterday: 0, month: 0, year: 0, total: 0 });
    const out = { income: empty(), expense: empty() };
    rows.forEach((r) => {
      out[r._id] = { today: r.today, yesterday: r.yesterday, month: r.month, year: r.year, total: r.total };
    });

    res.json({ ...out, balance: out.income.total - out.expense.total });
  } catch (err) {
    res.status(500).json({ message: "Failed to load dashboard", error: err.message });
  }
}

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
