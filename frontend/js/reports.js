const $ = (id) => document.getElementById(id);
const els = {
  msg: $("pageMsg"),
  range: $("rangeSelect"),
  startField: $("startField"),
  endField: $("endField"),
  startDate: $("startDate"),
  endDate: $("endDate"),
  generate: $("generateBtn"),
  print: $("printBtn"),
  exportBtn: $("exportBtn"),
  panel: $("reportPanel"),
  header: $("reportHeader"),
  title: $("reportTitle"),
  tiles: $("reportTiles"),
  incomeCat: $("incomeCatBody"),
  expenseCat: $("expenseCatBody"),
  empty: $("emptyState"),
};

function isBusiness() {
  const user = getUser() || {};
  return user.accountType === "small_business";
}

// Section 15: printable/on-screen reports carry the business name+logo for
// business accounts, or the signed-in user's name for individual accounts.
async function renderReportHeader() {
  const user = getUser() || {};
  if (isBusiness()) {
    try {
      const { business } = await apiRequest("/business");
      if (business) {
        els.header.innerHTML = `
          ${business.logo ? `<img src="${business.logo}" alt="" style="width:40px;height:40px;border-radius:6px;object-fit:cover;" />` : ""}
          <div><strong>${escapeHtml(business.businessName)}</strong><div style="font-size:0.8125rem;color:var(--muted);">${escapeHtml(business.ownerName || "")}</div></div>`;
        return;
      }
    } catch (err) { /* fall through to the plain name below */ }
  }
  els.header.innerHTML = `<div><strong>${escapeHtml(user.name || "")}</strong></div>`;
}

function handleError(err) {
  if (err.status === 401 || err.status === 403) return logout();
  showMsg(els.msg, err.message);
}

function toggleCustomFields() {
  const isCustom = els.range.value === "custom";
  els.startField.hidden = !isCustom;
  els.endField.hidden = !isCustom;
}
els.range.addEventListener("change", toggleCustomFields);
toggleCustomFields();

function buildQuery() {
  const p = new URLSearchParams();
  if (els.range.value === "custom") {
    if (!els.startDate.value || !els.endDate.value) throw new Error("Pick both a start and end date for a custom range.");
    p.set("startDate", els.startDate.value);
    p.set("endDate", els.endDate.value);
  } else {
    p.set("range", els.range.value);
  }
  return p.toString();
}

function tile(label, amount, extra = "") {
  return `<div class="tile big ${extra}"><div class="tile-body"><div class="tile-amount">${money(amount)}</div><div class="tile-label">${escapeHtml(label)}</div></div></div>`;
}

function countTile(label, count) {
  return `<div class="tile big"><div class="tile-body"><div class="tile-amount">${count}</div><div class="tile-label">${label}</div></div></div>`;
}

function catRows(list) {
  if (!list.length) return `<tr><td colspan="2" class="empty-state">None</td></tr>`;
  return list.map((c) => `<tr><td>${escapeHtml(c.category)}</td><td class="num">${money(c.total)}</td></tr>`).join("");
}

async function generate() {
  hideMsg(els.msg);
  let query;
  try { query = buildQuery(); } catch (err) { return showMsg(els.msg, err.message); }

  els.empty.hidden = true;
  els.panel.hidden = false;
  skeletonTiles(els.tiles, 4);
  skeletonRows(els.incomeCat, 2, 3);
  skeletonRows(els.expenseCat, 2, 3);

  await renderReportHeader();

  try {
    const data = await apiRequest("/reports?" + query);
    els.title.textContent = `${t("reports")} — ${els.range.options[els.range.selectedIndex].text}`;
    els.tiles.innerHTML =
      tile(isBusiness() ? t("totalRevenue") : t("totalIncome"), data.totalIncome) +
      tile(t("totalExpenses"), data.totalExpense) +
      tile(isBusiness() ? t("netProfit") : t("balance"), data.balance, data.balance < 0 ? "negative" : "") +
      countTile("Transactions", data.transactionCount);
    els.incomeCat.innerHTML = catRows(data.incomeByCategory);
    els.expenseCat.innerHTML = catRows(data.expenseByCategory);
  } catch (err) {
    handleError(err);
  }
}
document.addEventListener("i18n:changed", () => { if (!els.panel.hidden) generate(); });

els.generate.addEventListener("click", generate);
els.print.addEventListener("click", () => window.print());

els.exportBtn.addEventListener("click", async () => {
  hideMsg(els.msg);
  let query;
  try { query = buildQuery(); } catch (err) { return showMsg(els.msg, err.message); }

  try {
    const res = await fetch((window.API_BASE_URL || "http://localhost:5000") + "/api/reports/export?" + query, {
      headers: { Authorization: "Bearer " + getToken() },
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `e-miizaan-report-${els.range.value}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showMsg(els.msg, err.message || "Export failed");
  }
});

generate();
