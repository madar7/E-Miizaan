// Builds the title bar + sidebar on every signed-in page and guards access.
const NAV_ITEMS = [
  { page: "dashboard", href: "dashboard.html", label: "Dashboard", icon: "dashboard" },
  { page: "categories", href: "categories.html", label: "Add Category", icon: "category" },
  { page: "income", href: "income.html", label: "Income", icon: "income" },
  { page: "expenses", href: "expenses.html", label: "Expenses", icon: "expenses" },
  { page: "users", href: "admin.html", label: "Users", icon: "users", admin: true },
];

function logout() {
  clearSession();
  window.location.href = "index.html";
}

(function initLayout() {
  if (!getToken()) {
    window.location.href = "index.html";
    return;
  }

  const user = getUser() || {};
  const page = document.body.dataset.page;

  const titlebar = document.getElementById("titlebar");
  if (titlebar) {
    titlebar.innerHTML = `<span class="tb-icon">${ICONS.avatar}</span><span>E-Miizaan — Income and Expenses Tracker</span>`;
  }

  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    const first = String(user.name || "User").split(" ")[0];
    const links = NAV_ITEMS
      .filter((i) => !i.admin || user.role === "admin")
      .map((i) => `<a href="${i.href}" class="${i.page === page ? "active" : ""}"><span class="ico">${ICONS[i.icon]}</span>${i.label}</a>`)
      .join("");

    sidebar.innerHTML = `
      <div class="avatar">${ICONS.avatar}</div>
      <div class="welcome">Welcome, ${escapeHtml(first)}</div>
      <nav>${links}</nav>
      <a href="#" class="logout" id="logoutLink"><span class="ico">${ICONS.logout}</span>Logout</a>`;

    document.getElementById("logoutLink").addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }
})();
