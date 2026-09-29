const $ = (id) => document.getElementById(id);

const INCOME_TILES = [
  ["today", "Today's Income", "cashUp"],
  ["yesterday", "Yesterday's Income", "coin"],
  ["month", "This Month Income", "chart"],
  ["year", "This Year Income", "bag"],
];
const EXPENSE_TILES = [
  ["today", "Today's Expenses", "receipt"],
  ["yesterday", "Yesterday's Expenses", "ledger"],
  ["month", "This Month Expenses", "wallet"],
  ["year", "This Year Expenses", "card"],
];

function tile(icon, amount, label, extra = "") {
  return `
    <div class="tile ${extra}">
      <div class="tile-icon">${ICONS[icon]}</div>
      <div class="tile-body">
        <div class="tile-amount">${money(amount)}</div>
        ${label ? `<div class="tile-label">${label}</div>` : ""}
      </div>
    </div>`;
}

async function loadDashboard() {
  try {
    const d = await apiRequest("/transactions/dashboard?today=" + localDateStr());
    hideMsg($("pageMsg"));

    $("incomeTiles").innerHTML = INCOME_TILES.map(([key, label, icon]) => tile(icon, d.income[key], label)).join("");
    $("expenseTiles").innerHTML = EXPENSE_TILES.map(([key, label, icon]) => tile(icon, d.expense[key], label)).join("");
    $("totalIncome").innerHTML = tile("bag", d.income.total, "", "big");
    $("totalExpense").innerHTML = tile("card", d.expense.total, "", "big");
    $("totalBalance").innerHTML = tile("scale", d.balance, "", d.balance < 0 ? "big negative" : "big");
  } catch (err) {
    if (err.status === 401 || err.status === 403) return logout();
    showMsg($("pageMsg"), err.message);
  }
}

loadDashboard();
// Keep the numbers fresh when the user comes back to this tab.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadDashboard();
});
