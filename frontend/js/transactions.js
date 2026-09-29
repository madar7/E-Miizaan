// Shared by income.html and expenses.html — the page's <body data-type> decides which.
const $ = (id) => document.getElementById(id);
const TYPE = document.body.dataset.type; // "income" | "expense"
const LABEL = TYPE === "income" ? "Income" : "Expense";

const state = { page: 1, limit: 10, pages: 1, editingId: null, rows: [] };

const els = {
  msg: $("pageMsg"),
  form: $("txnForm"),
  formTitle: $("formTitle"),
  category: $("txnCategory"),
  amount: $("txnAmount"),
  date: $("txnDate"),
  description: $("txnDescription"),
  saveBtn: $("saveBtn"),
  cancelEdit: $("cancelEdit"),
  search: $("searchInput"),
  filterCategory: $("filterCategory"),
  startDate: $("startDate"),
  endDate: $("endDate"),
  body: $("txnTableBody"),
  empty: $("emptyState"),
  pageInfo: $("pageInfo"),
  prev: $("prevPage"),
  next: $("nextPage"),
};

function handleError(err) {
  if (err.status === 401 || err.status === 403) return logout();
  showMsg(els.msg, err.message);
}

async function loadCategories(selected) {
  try {
    const data = await apiRequest("/categories?type=" + TYPE);
    const names = data.categories.map((c) => c.name);
    const formNames = selected && !names.includes(selected) ? [...names, selected] : names;

    els.category.innerHTML = formNames.length
      ? formNames.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("")
      : `<option value="">No categories — add one first</option>`;
    if (selected) els.category.value = selected;

    const current = els.filterCategory.value;
    els.filterCategory.innerHTML =
      `<option value="">All categories</option>` +
      names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
    els.filterCategory.value = names.includes(current) ? current : "";
  } catch (err) {
    handleError(err);
  }
}

function buildQuery() {
  const p = new URLSearchParams({ type: TYPE, page: state.page, limit: state.limit });
  if (els.search.value.trim()) p.set("search", els.search.value.trim());
  if (els.filterCategory.value) p.set("category", els.filterCategory.value);
  if (els.startDate.value) p.set("startDate", els.startDate.value);
  if (els.endDate.value) p.set("endDate", els.endDate.value + "T23:59:59.999Z");
  return p.toString();
}

function renderRow(t) {
  return `
    <tr>
      <td>${formatDate(t.date)}</td>
      <td>${escapeHtml(t.category)}</td>
      <td>${escapeHtml(t.description || "—")}</td>
      <td class="num amt-${TYPE}">${money(t.amount)}</td>
      <td class="actions">
        <button class="link-btn" data-action="edit" data-id="${t._id}">Edit</button>
        <button class="link-btn danger" data-action="delete" data-id="${t._id}">Delete</button>
      </td>
    </tr>`;
}

async function loadTransactions() {
  try {
    const data = await apiRequest("/transactions?" + buildQuery());

    // Deleted the last row of a later page — step back one page.
    if (!data.transactions.length && state.page > 1) {
      state.page -= 1;
      return loadTransactions();
    }

    state.rows = data.transactions;
    state.pages = data.pagination.pages;
    els.body.innerHTML = data.transactions.map(renderRow).join("");
    els.empty.hidden = data.transactions.length > 0;
    els.pageInfo.textContent = `Page ${data.pagination.page} of ${data.pagination.pages} (${data.pagination.total} total)`;
    els.prev.disabled = state.page <= 1;
    els.next.disabled = state.page >= state.pages;
  } catch (err) {
    handleError(err);
  }
}

function resetForm() {
  state.editingId = null;
  els.form.reset();
  els.date.value = localDateStr();
  els.formTitle.textContent = "Add " + LABEL;
  els.saveBtn.textContent = "Add " + LABEL;
  els.cancelEdit.hidden = true;
}

async function startEdit(id) {
  const t = state.rows.find((r) => r._id === id);
  if (!t) return;
  state.editingId = id;
  await loadCategories(t.category);
  els.amount.value = t.amount;
  els.date.value = String(t.date).slice(0, 10);
  els.description.value = t.description || "";
  els.formTitle.textContent = "Edit " + LABEL;
  els.saveBtn.textContent = "Update " + LABEL;
  els.cancelEdit.hidden = false;
  els.form.scrollIntoView({ behavior: "smooth", block: "center" });
}

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(els.msg);
  if (!els.category.value) {
    return showMsg(els.msg, "Add a category first on the Add Category page.");
  }

  const payload = {
    type: TYPE,
    amount: parseFloat(els.amount.value),
    category: els.category.value,
    description: els.description.value.trim(),
    date: els.date.value,
  };

  els.saveBtn.disabled = true;
  try {
    const editing = Boolean(state.editingId);
    if (editing) {
      await apiRequest(`/transactions/${state.editingId}`, { method: "PUT", body: payload });
    } else {
      await apiRequest("/transactions", { method: "POST", body: payload });
    }
    resetForm();
    await loadCategories();
    await loadTransactions();
    showMsg(els.msg, `${LABEL} ${editing ? "updated" : "added"}.`, "success");
  } catch (err) {
    handleError(err);
  } finally {
    els.saveBtn.disabled = false;
  }
});

els.cancelEdit.addEventListener("click", () => {
  resetForm();
  hideMsg(els.msg);
});

els.body.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;

  if (btn.dataset.action === "edit") return startEdit(id);

  if (btn.dataset.action === "delete") {
    if (!confirm(`Delete this ${TYPE} entry?`)) return;
    try {
      await apiRequest(`/transactions/${id}`, { method: "DELETE" });
      if (state.editingId === id) resetForm();
      await loadTransactions();
      showMsg(els.msg, `${LABEL} deleted.`, "success");
    } catch (err) {
      handleError(err);
    }
  }
});

let debounce;
els.search.addEventListener("input", () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => { state.page = 1; loadTransactions(); }, 300);
});
[els.filterCategory, els.startDate, els.endDate].forEach((el) =>
  el.addEventListener("change", () => { state.page = 1; loadTransactions(); })
);
els.prev.addEventListener("click", () => { if (state.page > 1) { state.page -= 1; loadTransactions(); } });
els.next.addEventListener("click", () => { if (state.page < state.pages) { state.page += 1; loadTransactions(); } });

resetForm();
loadCategories();
loadTransactions();
