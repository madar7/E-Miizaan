const $ = (id) => document.getElementById(id);

function incomeTileDefs() {
  return [
    ["today", t("todaysIncome"), "cashUp"],
    ["yesterday", t("yesterdaysIncome"), "coin"],
    ["month", t("thisMonthIncome"), "chart"],
    ["year", t("thisYearIncome"), "bag"],
  ];
}
function expenseTileDefs() {
  return [
    ["today", t("todaysExpenses"), "receipt"],
    ["yesterday", t("yesterdaysExpenses"), "ledger"],
    ["month", t("thisMonthExpenses"), "wallet"],
    ["year", t("thisYearExpenses"), "card"],
  ];
}

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

function isBusiness() {
  const user = getUser() || {};
  return user.accountType === "small_business";
}

async function loadDashboard() {
  // Section 1/12: small-business accounts see revenue/profit wording on the summary cards.
  $("incomeSectionTitle") && ($("incomeSectionTitle").textContent = t("incomesData"));
  $("totalIncomeLabel") && ($("totalIncomeLabel").textContent = isBusiness() ? t("totalRevenue") : t("totalIncome"));
  $("totalExpenseLabel") && ($("totalExpenseLabel").textContent = t("totalExpenses"));
  $("totalBalanceLabel") && ($("totalBalanceLabel").textContent = isBusiness() ? t("netProfit") : t("balance"));

  skeletonTiles($("incomeTiles"), 4);
  skeletonTiles($("expenseTiles"), 4);
  skeletonTiles($("totalIncome"), 1);
  skeletonTiles($("totalExpense"), 1);
  skeletonTiles($("totalBalance"), 1);

  try {
    const d = await apiRequest("/transactions/dashboard?today=" + localDateStr());
    hideMsg($("pageMsg"));

    $("incomeTiles").innerHTML = incomeTileDefs().map(([key, label, icon]) => tile(icon, d.income[key], label)).join("");
    $("expenseTiles").innerHTML = expenseTileDefs().map(([key, label, icon]) => tile(icon, d.expense[key], label)).join("");
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
// Re-render immediately if the user changes language from the profile dropdown mid-session.
document.addEventListener("i18n:changed", loadDashboard);
