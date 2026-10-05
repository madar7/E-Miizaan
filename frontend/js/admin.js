const $ = (id) => document.getElementById(id);
const els = {
  msg: $("pageMsg"),
  denied: $("accessDenied"),
  content: $("adminContent"),
  body: $("userTableBody"),
  empty: $("emptyState"),
  search: $("searchInput"),
  role: $("roleFilter"),
  approval: $("approvalFilter"),
  addUserBtn: $("addUserBtn"),
  addUserForm: $("addUserForm"),
  newRoleField: $("newRoleField"),
  cancelAddUser: $("cancelAddUser"),
  settingsPanel: $("systemSettingsPanel"),
  auditBody: $("auditTableBody"),
  auditEmpty: $("auditEmpty"),
  auditPageInfo: $("auditPageInfo"),
  auditPrev: $("auditPrev"),
  auditNext: $("auditNext"),
  auditAction: $("auditActionFilter"),
  exportUsersBtn: $("exportUsersBtn"),
  exportAuditBtn: $("exportAuditBtn"),
  overviewTiles: $("overviewTiles"),
  recentSignups: $("recentSignups"),
  userPageInfo: $("userPageInfo"),
  userPrev: $("userPrev"),
  userNext: $("userNext"),
  editModal: $("editUserModal"),
  editForm: $("editUserForm"),
  cancelEditUser: $("cancelEditUser"),
};

const me = getUser() || {};
const myId = me._id || me.id;
const auditState = { page: 1, pages: 1 };
const userState = { page: 1, pages: 1 };
let usersCache = [];

// ---------- Edit user (name/email/phone) ----------
function openEditModal(user) {
  $("editUserId").value = user._id;
  $("editName").value = user.name || "";
  $("editEmail").value = user.email || "";
  $("editPhone").value = user.phone || "";
  els.editModal.style.display = "flex";
}
function closeEditModal() {
  els.editModal.style.display = "none";
  els.editForm.reset();
}
els.cancelEditUser.addEventListener("click", closeEditModal);
els.editModal.addEventListener("click", (e) => { if (e.target === els.editModal) closeEditModal(); });

els.editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(els.msg);
  const id = $("editUserId").value;
  try {
    await apiRequest(`/admin/users/${id}`, {
      method: "PATCH",
      body: { name: $("editName").value.trim(), email: $("editEmail").value.trim(), phone: $("editPhone").value.trim() },
    });
    closeEditModal();
    showMsg(els.msg, "User updated successfully.", "success");
    loadUsers();
  } catch (err) {
    showMsg(els.msg, err.message);
  }
});

function downloadCsv(path, filename) {
  const url = (window.API_BASE_URL || "http://localhost:5000") + "/api" + path;
  fetch(url, { headers: { Authorization: "Bearer " + getToken() } })
    .then((res) => { if (!res.ok) throw new Error("Export failed"); return res.blob(); })
    .then((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch((err) => showMsg(els.msg, err.message || "Export failed"));
}
els.exportUsersBtn.addEventListener("click", () => downloadCsv("/admin/users/export", "e-miizaan-users.csv"));
els.exportAuditBtn.addEventListener("click", () => downloadCsv("/admin/audit-logs/export" + (els.auditAction.value ? "?action=" + els.auditAction.value : ""), "e-miizaan-audit-log.csv"));

// ---------- Overview ----------
async function loadOverview() {
  skeletonTiles(els.overviewTiles, 4);
  try {
    const data = await apiRequest("/admin/overview");
    els.overviewTiles.innerHTML = [
      ["Total Users", data.users.total],
      ["Admins", data.users.admins],
      ["Pending Approval", data.users.pending],
      ["Net Balance (all users)", money(data.transactions.netBalance)],
    ].map(([label, value]) => `
      <div class="tile big"><div class="tile-body"><div class="tile-amount">${value}</div><div class="tile-label">${label}</div></div></div>
    `).join("");

    if (data.recentUsers && data.recentUsers.length) {
      els.recentSignups.innerHTML = "Recent sign-ups: " + data.recentUsers.map((u) => escapeHtml(u.name)).join(", ");
    }
  } catch (err) {
    if (err.status === 401) return logout();
    // Overview is a secondary panel — don't block the rest of the page if it fails.
  }
}

function handleError(err) {
  if (err.status === 401) return logout();
  if (err.status === 403) {
    els.content.hidden = true;
    els.denied.hidden = false;
    return;
  }
  showMsg(els.msg, err.message);
}

const DEFAULT_AVATAR_SMALL = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#d9ddd9"/><circle cx="16" cy="12" r="6" fill="#9aa69d"/><path d="M5 28c1-7 5.5-11 11-11s10 4 11 11" fill="#9aa69d"/></svg>'
);

// ---------- Add User (policy-gated: admin always, non-admin only if allowed) ----------
async function loadPolicyAndWireAddUser() {
  try {
    const policy = await apiRequest("/users/policy");
    els.addUserBtn.hidden = !policy.canCreateUsers;
    els.newRoleField.hidden = !policy.canCreateAdmins;
  } catch (err) {
    // If this fails, just leave the button hidden — the POST itself is the real
    // enforcement point, this is only so the UI doesn't dangle a button that 403s.
  }
}
els.addUserBtn.addEventListener("click", () => { els.addUserForm.hidden = false; els.addUserBtn.hidden = true; });
els.cancelAddUser.addEventListener("click", () => { els.addUserForm.hidden = true; els.addUserBtn.hidden = false; els.addUserForm.reset(); });

els.addUserForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(els.msg);
  try {
    await apiRequest("/users", {
      method: "POST",
      body: {
        name: $("newName").value.trim(),
        username: $("newUsername").value.trim(),
        email: $("newEmail").value.trim(),
        password: $("newPassword").value,
        role: $("newRole") ? $("newRole").value : "user",
      },
    });
    els.addUserForm.reset();
    els.addUserForm.hidden = true;
    els.addUserBtn.hidden = false;
    showMsg(els.msg, "User created successfully.", "success");
    loadUsers();
  } catch (err) {
    showMsg(els.msg, err.message);
  }
});

// ---------- System settings (admin-only; hidden entirely for non-admins) ----------
async function loadSystemSettings() {
  if (me.role !== "admin") return;
  try {
    const { settings } = await apiRequest("/admin/settings");
    els.settingsPanel.hidden = false;
    $("setAllowRegistration").checked = settings.allowUserRegistration;
    $("setAllowUsersCreateUsers").checked = settings.allowUsersToCreateUsers;
    $("setRequireApproval").checked = settings.requireAdminApproval;
    $("setAllowSelfDeactivate").checked = settings.allowUsersToDeactivateOwnAccount;
    $("setMaxUsers").value = settings.maxUsers;
  } catch (err) {
    // non-fatal: the rest of the page still works without this panel
  }
}

$("saveSettingsBtn") && $("saveSettingsBtn").addEventListener("click", async () => {
  try {
    await apiRequest("/admin/settings", {
      method: "PATCH",
      body: {
        allowUserRegistration: $("setAllowRegistration").checked,
        allowUsersToCreateUsers: $("setAllowUsersCreateUsers").checked,
        requireAdminApproval: $("setRequireApproval").checked,
        allowUsersToDeactivateOwnAccount: $("setAllowSelfDeactivate").checked,
        maxUsers: parseInt($("setMaxUsers").value, 10) || 0,
      },
    });
    showMsg(els.msg, "System settings updated.", "success");
    loadPolicyAndWireAddUser(); // the Add User button's visibility may have just changed for this admin's own view too
  } catch (err) {
    showMsg(els.msg, err.message);
  }
});

// ---------- Users table ----------
function accountTypeBadge(u) {
  return u.accountType === "small_business" ? "Business" : "Individual";
}

function approvalBadge(u) {
  if (u.approvalStatus === "pending") return '<span class="badge inactive">Pending</span>';
  if (u.approvalStatus === "rejected") return '<span class="badge inactive">Rejected</span>';
  return "";
}

function renderRow(u) {
  const isSelf = u._id === myId;
  const dis = isSelf ? "disabled" : "";
  const isPending = u.approvalStatus === "pending";
  return `
    <tr>
      <td><img src="${u.profileImage || DEFAULT_AVATAR_SMALL}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;display:block;" /></td>
      <td>${escapeHtml(u.name)}${isSelf ? " (you)" : ""}</td>
      <td>${escapeHtml(u.username || "—")}</td>
      <td>${escapeHtml(u.email)}</td>
      <td>${accountTypeBadge(u)}</td>
      <td><span class="badge ${u.role}">${u.role}</span></td>
      <td><span class="badge ${u.isActive ? "active" : "inactive"}">${u.isActive ? "Active" : "Deactivated"}</span> ${approvalBadge(u)}</td>
      <td>${u.createdBy ? escapeHtml(u.createdBy.name) : "Self-registered"}</td>
      <td class="num">${u.transactionCount}</td>
      <td>${new Date(u.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
      <td class="actions">
        ${isPending
          ? `<button class="link-btn" data-action="approve" data-id="${u._id}">Approve</button>
             <button class="link-btn danger" data-action="reject" data-id="${u._id}">Reject</button>`
          : `${u.role === "admin"
              ? `<button class="link-btn" data-action="demote" data-id="${u._id}" ${dis}>Remove admin</button>`
              : `<button class="link-btn" data-action="promote" data-id="${u._id}">Make admin</button>`}
             ${u.isActive
              ? `<button class="link-btn" data-action="deactivate" data-id="${u._id}" ${dis}>Deactivate</button>`
              : `<button class="link-btn" data-action="activate" data-id="${u._id}">Activate</button>`}`}
        <button class="link-btn" data-action="edit" data-id="${u._id}">Edit</button>
        <button class="link-btn danger" data-action="delete" data-id="${u._id}" ${dis}>Delete</button>
      </td>
    </tr>`;
}

async function loadUsers() {
  skeletonRows(els.body, 11, 4);
  try {
    const params = new URLSearchParams({ page: userState.page, limit: 20 });
    if (els.search.value.trim()) params.set("search", els.search.value.trim());
    if (els.role.value) params.set("role", els.role.value);
    if (els.approval.value) params.set("approvalStatus", els.approval.value);

    const data = await apiRequest("/admin/users?" + params.toString());

    // Deleted the last row of a later page — step back one page.
    if (!data.users.length && userState.page > 1) {
      userState.page -= 1;
      return loadUsers();
    }

    usersCache = data.users;
    els.body.innerHTML = data.users.map(renderRow).join("");
    els.empty.hidden = data.users.length > 0;

    userState.pages = data.pagination.pages;
    userState.page = data.pagination.page;
    els.userPageInfo.textContent = `Page ${data.pagination.page} of ${data.pagination.pages} (${data.pagination.total} total)`;
    els.userPrev.disabled = userState.page <= 1;
    els.userNext.disabled = userState.page >= userState.pages;
  } catch (err) {
    handleError(err);
  }
}

let debounce;
els.search.addEventListener("input", () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => { userState.page = 1; loadUsers(); }, 300);
});
els.role.addEventListener("change", () => { userState.page = 1; loadUsers(); });
els.approval.addEventListener("change", () => { userState.page = 1; loadUsers(); });
els.userPrev.addEventListener("click", () => { if (userState.page > 1) { userState.page -= 1; loadUsers(); } });
els.userNext.addEventListener("click", () => { if (userState.page < userState.pages) { userState.page += 1; loadUsers(); } });

els.body.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn || btn.disabled) return;
  const { id, action } = btn.dataset;
  hideMsg(els.msg);

  if (action === "edit") {
    const user = usersCache.find((u) => u._id === id);
    if (user) openEditModal(user);
    return;
  }

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
    } else if (action === "approve") {
      await apiRequest(`/admin/users/${id}/approve`, { method: "PATCH" });
    } else if (action === "reject") {
      if (!confirm("Reject this registration? The account will be deactivated.")) return;
      await apiRequest(`/admin/users/${id}/reject`, { method: "PATCH" });
    } else if (action === "delete") {
      if (!confirm("Permanently delete this user and all of their transactions? This cannot be undone.")) return;
      await apiRequest(`/admin/users/${id}`, { method: "DELETE" });
    }
    loadUsers();
  } catch (err) {
    showMsg(els.msg, err.message);
  }
});

// ---------- Audit log ----------
const ACTION_LABELS = {
  login: "Signed in", register: "Registered",
  "transaction.create": "Added a transaction", "transaction.update": "Edited a transaction", "transaction.delete": "Deleted a transaction",
  "category.create": "Added a category", "category.update": "Renamed a category", "category.delete": "Deleted a category",
  "user.role_change": "Changed a user's role", "user.status_change": "Changed a user's status", "user.delete": "Deleted a user",
  "profile.updated": "Updated profile", "profile_image.updated": "Updated profile image", "password.changed": "Changed password",
  "settings.updated": "Updated system settings", "language.changed": "Changed language", "theme.changed": "Changed theme",
  "business_profile.updated": "Updated business profile", "user.created": "Created a user", "user.updated": "Updated a user",
  "user.deactivated": "Deactivated account", "user.activated": "Activated account",
  "user.approved": "Approved a registration", "user.rejected": "Rejected a registration",
};

function auditDetail(log) {
  const m = log.meta || {};
  switch (log.action) {
    case "transaction.create":
      return `${m.type || ""} ${m.category ? "· " + escapeHtml(m.category) : ""} ${m.amount !== undefined ? money(m.amount) : ""}`.trim();
    case "category.create": return `${escapeHtml(m.name || "")} (${m.type || ""})`;
    case "category.update": return `${escapeHtml(m.from || "")} → ${escapeHtml(m.to || "")}`;
    case "category.delete": return escapeHtml(m.name || "");
    case "user.role_change": return `role → ${m.role || ""}`;
    case "user.status_change": return m.isActive ? "activated" : "deactivated";
    case "user.delete": return escapeHtml(m.email || "");
    case "user.created": return `role: ${m.role || "user"}${m.approvalStatus === "pending" ? " (pending approval)" : ""}`;
    case "language.changed": return m.language || "";
    case "theme.changed": return m.theme || "";
    default: return "—";
  }
}

function renderAuditRow(log) {
  const who = log.user ? `${escapeHtml(log.user.name)}${log.user.username ? " (" + escapeHtml(log.user.username) + ")" : ""}` : "Deleted user";
  return `<tr><td>${new Date(log.createdAt).toLocaleString()}</td><td>${who}</td><td>${ACTION_LABELS[log.action] || log.action}</td><td>${auditDetail(log)}</td></tr>`;
}

async function loadAuditLogs() {
  skeletonRows(els.auditBody, 4, 4);
  try {
    const params = new URLSearchParams({ page: auditState.page, limit: 20 });
    if (els.auditAction.value) params.set("action", els.auditAction.value);
    const data = await apiRequest("/admin/audit-logs?" + params.toString());
    els.auditBody.innerHTML = data.logs.map(renderAuditRow).join("");
    els.auditEmpty.hidden = data.logs.length > 0;
    auditState.pages = data.pagination.pages;
    els.auditPageInfo.textContent = `Page ${data.pagination.page} of ${data.pagination.pages} (${data.pagination.total} total)`;
    els.auditPrev.disabled = auditState.page <= 1;
    els.auditNext.disabled = auditState.page >= auditState.pages;
  } catch (err) {
    if (err.status === 401) return logout();
  }
}
els.auditPrev.addEventListener("click", () => { if (auditState.page > 1) { auditState.page -= 1; loadAuditLogs(); } });
els.auditNext.addEventListener("click", () => { if (auditState.page < auditState.pages) { auditState.page += 1; loadAuditLogs(); } });
els.auditAction.addEventListener("change", () => { auditState.page = 1; loadAuditLogs(); });

loadOverview();
loadUsers();
loadAuditLogs();
loadPolicyAndWireAddUser();
loadSystemSettings();
