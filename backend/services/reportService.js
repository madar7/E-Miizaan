const Transaction = require("../models/Transaction");
const finance = require("./financeService");

const VALID_PRESETS = ["daily", "weekly", "monthly", "yearly", "custom"];

// Resolves a named preset (relative to `refStr`, the caller's own YYYY-MM-DD)
// or an explicit custom range into concrete { from, to } Date boundaries.
function resolveRange({ preset, refDate, startDate, endDate }) {
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(refDate || "") ? refDate : new Date().toISOString().slice(0, 10);
  const [y, m, d] = ref.split("-").map(Number);
  const DAY = 24 * 60 * 60 * 1000;

  switch (preset) {
    case "daily": {
      const from = Date.UTC(y, m - 1, d);
      return { from: new Date(from), to: new Date(from + DAY) };
    }
    case "weekly": {
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
      const mondayOffset = (dow + 6) % 7;
      const from = Date.UTC(y, m - 1, d - mondayOffset);
      return { from: new Date(from), to: new Date(from + 7 * DAY) };
    }
    case "monthly":
      return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
    case "yearly":
      return { from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y + 1, 0, 1)) };
    case "custom":
    default: {
      const from = startDate ? new Date(startDate) : undefined;
      const to = endDate ? new Date(new Date(endDate).getTime() + DAY - 1) : undefined; // inclusive end-of-day
      return { from, to };
    }
  }
}

async function buildReport(userId, params) {
  const { from, to } = resolveRange(params);
  const summary = await finance.rangeReport(userId, from, to);
  return { range: { from: from || null, to: to || null, preset: params.preset || "custom" }, ...summary };
}

// Full transaction list for the same range, used by CSV export (not paginated —
// a report export is expected to contain everything in the window).
async function listForExport(userId, params) {
  const { from, to } = resolveRange(params);
  const match = { user: userId };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = from;
    if (to) match.date.$lte = to;
  }
  return Transaction.find(match).sort({ date: 1 });
}

function toCSV(transactions) {
  const header = ["Date", "Type", "Category", "Description", "Amount"];
  const escapeCell = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = transactions.map((t) => [
    new Date(t.date).toISOString().slice(0, 10),
    t.type,
    t.category,
    t.description || "",
    t.amount.toFixed(2),
  ]);
  return [header, ...rows].map((r) => r.map(escapeCell).join(",")).join("\n");
}

module.exports = { VALID_PRESETS, resolveRange, buildReport, listForExport, toCSV };
