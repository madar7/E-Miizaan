const $ = (id) => document.getElementById(id);
const els = {
  msg: $("pageMsg"),
  denied: $("accessDenied"),
  content: $("adminContent"),
  body: $("userTableBody"),
  empty: $("emptyState"),
  search: $("searchInput"),
  role: $("roleFilter"),
};

const me = getUser() || {};
const myId = me._id || me.id;

function renderRow(u) {
  const isSelf = u._id === myId;
  const dis = isSelf ? "disabled" : "";
  return `
    <tr>
      <td>${escapeHtml(u.name)}${isSelf ? " (you)" : ""}</td>
      <td>${escapeHtml(u.username || "—")}</td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="badge ${u.role}">${u.role}</span></td>
      <td><span class="badge ${u.isActive ? "active" : "inactive"}">${u.isActive ? "Active" : "Deactivated"}</span></td>
      <td class="num">${u.transactionCount}</td>
      <td>${new Date(u.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
      <td class="actions">
        ${u.role === "admin"
          ? `<button class="link-btn" data-action="demote" data-id="${u._id}" ${dis}>Remove admin</button>`
          : `<button class="link-btn" data-action="promote" data-id="${u._id}">Make admin</button>`}
        ${u.isActive
          ? `<button class="link-btn" data-action="deactivate" data-id="${u._id}" ${dis}>Deactivate</button>`
          : `<button class="link-btn" data-action="activate" data-id="${u._id}">Activate</button>`}
        <button class="link-btn danger" data-action="delete" data-id="${u._id}" ${dis}>Delete</button>
      </td>
    </tr>`;
}

async function loadUsers() {
  try {
    const params = new URLSearchParams();
    if (els.search.value.trim()) params.set("search", els.search.value.trim());
    if (els.role.value) params.set("role", els.role.value);

    const data = await apiRequest("/admin/users?" + params.toString());
    els.body.innerHTML = data.users.map(renderRow).join("");
    els.empty.hidden = data.users.length > 0;
  } catch (err) {
    if (err.status === 401) return logout();
    if (err.status === 403) {
      els.content.hidden = true;
      els.denied.hidden = false;
      return;
    }
    showMsg(els.msg, err.message);
  }
}

let debounce;
els.search.addEventListener("input", () => {
  clearTimeout(debounce);
  debounce = setTimeout(loadUsers, 300);
});
els.role.addEventListener("change", loadUsers);

els.body.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn || btn.disabled) return;
  const { id, action } = btn.dataset;
  hideMsg(els.msg);

  try {
    if (action === "promote") {
      await apiRequest(`/admin/users/${id}`, { method: "PATCH", body: { role: "admin" } });
    } else if (action === "demote") {
      await apiRequest(`/admin/users/${id}`, { method: "PATCH", body: { role: "user" } });
    } else if (action === "deactivate") {
      if (!confirm("Deactivate this user? They can't sign in until reactivated.")) return;
      await apiRequest(`/admin/users/${id}`, { method: "PATCH", body: { isActive: false } });
    } else if (action === "activate") {
      await apiRequest(`/admin/users/${id}`, { method: "PATCH", body: { isActive: true } });
    } else if (action === "delete") {
      if (!confirm("Permanently delete this user and all of their transactions? This cannot be undone.")) return;
      await apiRequest(`/admin/users/${id}`, { method: "DELETE" });
    }
    loadUsers();
  } catch (err) {
    showMsg(els.msg, err.message);
  }
});

loadUsers();
