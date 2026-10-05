// Centralized financial calculations. All figures come from MongoDB
// aggregation over the Transaction collection — nothing here is hard-coded,
// and this is the single place dashboard/report totals are computed so the
// same numbers can't drift between endpoints.
const Transaction = require("../models/Transaction");

const DAY = 24 * 60 * 60 * 1000;

// Sum of amounts for `type`, matched to the given [from, to) window, as a
// $cond inside a single aggregation pipeline (avoids N separate queries).
function rangeSum(from, to) {
  return {
    $sum: {
      $cond: [{ $and: [{ $gte: ["$date", new Date(from)] }, { $lt: ["$date", new Date(to)] }] }, "$amount", 0],
    },
  };
}

// Tile totals for the dashboard: today / yesterday / this month / this year / all time,
// per transaction type, plus the overall balance. `todayStr` is the browser's own
// YYYY-MM-DD so "today" lines up with the user's timezone, not the server's.
async function dashboardTotals(userId, todayStr) {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(todayStr || "") ? todayStr : new Date().toISOString().slice(0, 10);
  const [y, m, d] = valid.split("-").map(Number);
  const today = Date.UTC(y, m - 1, d);

  const rows = await Transaction.aggregate([
    { $match: { user: userId } },
    {
      $group: {
        _id: "$type",
        today: rangeSum(today, today + DAY),
        yesterday: rangeSum(today - DAY, today),
        month: rangeSum(Date.UTC(y, m - 1, 1), Date.UTC(y, m, 1)),
        year: rangeSum(Date.UTC(y, 0, 1), Date.UTC(y + 1, 0, 1)),
        total: { $sum: "$amount" },
      },
    },
  ]);

  const empty = () => ({ today: 0, yesterday: 0, month: 0, year: 0, total: 0 });
  const out = { income: empty(), expense: empty() };
  rows.forEach((r) => {
    out[r._id] = { today: r.today, yesterday: r.yesterday, month: r.month, year: r.year, total: r.total };
  });

  return { ...out, balance: out.income.total - out.expense.total };
}

// Zero-filled income/expense totals per calendar month for the last `months` months.
async function monthlySeries(userId, months = 6) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (months - 1));

  const rows = await Transaction.aggregate([
    { $match: { user: userId, date: { $gte: start } } },
    { $group: { _id: { year: { $year: "$date" }, month: { $month: "$date" }, type: "$type" }, total: { $sum: "$amount" } } },
  ]);

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
  rows.forEach((r) => {
    const bucket = scaffold.find((s) => s.year === r._id.year && s.month === r._id.month);
    if (bucket) bucket[r._id.type] = r.total;
  });
  return scaffold;
}

// Totals + category breakdown for an arbitrary [from, to) window — the core
// of both /api/transactions/summary and the Reports module.
async function rangeReport(userId, from, to) {
  const match = { user: userId };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }

  const [totalsRows, byCategory, transactionCount] = await Promise.all([
    Transaction.aggregate([{ $match: match }, { $group: { _id: "$type", total: { $sum: "$amount" } } }]),
    Transaction.aggregate([
      { $match: match },
      { $group: { _id: { type: "$type", category: "$category" }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Transaction.countDocuments(match),
  ]);

  const totals = { income: 0, expense: 0 };
  totalsRows.forEach((r) => { totals[r._id] = r.total; });

  return {
    totalIncome: totals.income,
    totalExpense: totals.expense,
    balance: totals.income - totals.expense,
    transactionCount,
    incomeByCategory: byCategory.filter((c) => c._id.type === "income").map((c) => ({ category: c._id.category, total: c.total, count: c.count })),
    expenseByCategory: byCategory.filter((c) => c._id.type === "expense").map((c) => ({ category: c._id.category, total: c.total, count: c.count })),
  };
}

module.exports = { dashboardTotals, monthlySeries, rangeReport };
