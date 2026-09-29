const $ = (id) => document.getElementById(id);
const els = {
  msg: $("pageMsg"),
  form: $("catForm"),
  title: $("formTitle"),
  name: $("catName"),
  type: $("catType"),
  save: $("saveBtn"),
  cancel: $("cancelEdit"),
};

let categories = [];
let editingId = null;

function handleError(err) {
  if (err.status === 401 || err.status === 403) return logout();
  showMsg(els.msg, err.message);
}

function rows(list) {
  if (!list.length) return `<tr><td colspan="2" class="empty-state">No categories yet.</td></tr>`;
  return list.map((c) => `
    <tr>
      <td>${escapeHtml(c.name)}</td>
      <td class="actions">
        <button class="link-btn" data-action="edit" data-id="${c._id}">Edit</button>
        <button class="link-btn danger" data-action="delete" data-id="${c._id}">Delete</button>
      </td>
    </tr>`).join("");
}

function render() {
  $("incomeCats").innerHTML = rows(categories.filter((c) => c.type === "income"));
  $("expenseCats").innerHTML = rows(categories.filter((c) => c.type === "expense"));
}

async function load() {
  try {
    const data = await apiRequest("/categories");
    categories = data.categories;
    render();
  } catch (err) {
    handleError(err);
  }
}

function resetForm() {
  editingId = null;
  els.form.reset();
  els.type.disabled = false;
  els.title.textContent = "Add Category";
  els.save.textContent = "Add Category";
  els.cancel.hidden = true;
}

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(els.msg);
  els.save.disabled = true;
  try {
    const name = els.name.value.trim();
    const editing = Boolean(editingId);
    if (editing) {
      await apiRequest(`/categories/${editingId}`, { method: "PUT", body: { name } });
    } else {
      await apiRequest("/categories", { method: "POST", body: { name, type: els.type.value } });
    }
    resetForm();
    await load();
    showMsg(els.msg, `Category ${editing ? "updated" : "added"}.`, "success");
  } catch (err) {
    handleError(err);
  } finally {
    els.save.disabled = false;
  }
});

els.cancel.addEventListener("click", () => {
  resetForm();
  hideMsg(els.msg);
});

document.querySelector("main").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const cat = categories.find((c) => c._id === btn.dataset.id);
  if (!cat) return;

  if (btn.dataset.action === "edit") {
    editingId = cat._id;
    els.name.value = cat.name;
    els.type.value = cat.type;
    els.type.disabled = true; // a category's type can't change once created
    els.title.textContent = "Edit Category";
    els.save.textContent = "Update Category";
    els.cancel.hidden = false;
    els.name.focus();
    els.form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (btn.dataset.action === "delete") {
    if (!confirm(`Delete the "${cat.name}" category?`)) return;
    hideMsg(els.msg);
    try {
      await apiRequest(`/categories/${cat._id}`, { method: "DELETE" });
      if (editingId === cat._id) resetForm();
      await load();
      showMsg(els.msg, "Category deleted.", "success");
    } catch (err) {
      handleError(err);
    }
  }
});

load();
