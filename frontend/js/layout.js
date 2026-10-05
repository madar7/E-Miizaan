// Builds the title bar + sidebar on every signed-in page and guards access.
// Desktop nav stays flat and unchanged; mobile gets a hamburger + collapsible
// accordion menu built from MOBILE_NAV_ITEMS (Income/Expenses grouped under
// "Transactions", since those are real existing pages).
function navItems(user) {
  const items = [
    { page: "dashboard", href: "dashboard.html", labelKey: "dashboard", icon: "dashboard" },
    { page: "categories", href: "categories.html", labelKey: "categories", icon: "category" },
    { page: "income", href: "income.html", labelKey: "income", icon: "income" },
    { page: "expenses", href: "expenses.html", labelKey: "expenses", icon: "expenses" },
    { page: "reports", href: "reports.html", labelKey: "reports", icon: "reports" },
  ];
  if (user.accountType === "small_business") {
    items.push({ page: "business", href: "business.html", labelKey: "business", icon: "category" });
  }
  items.push({ page: "settings", href: "settings.html", labelKey: "settings", icon: "settings" });
  items.push({ page: "users", href: "admin.html", labelKey: "users", icon: "users", admin: true });
  return items;
}

function mobileNavItems(user) {
  const items = [{ page: "dashboard", href: "dashboard.html", labelKey: "dashboard", icon: "dashboard" }];
  items.push({
    group: "transactions",
    labelKey: "transactions",
    icon: "income",
    children: [
      { page: "income", href: "income.html", labelKey: "income" },
      { page: "expenses", href: "expenses.html", labelKey: "expenses" },
    ],
  });
  items.push({ page: "categories", href: "categories.html", labelKey: "categories", icon: "category" });
  items.push({ page: "reports", href: "reports.html", labelKey: "reports", icon: "reports" });
  if (user.accountType === "small_business") {
    items.push({ page: "business", href: "business.html", labelKey: "business", icon: "category" });
  }
  items.push({ page: "settings", href: "settings.html", labelKey: "settings", icon: "settings" });
  items.push({ page: "users", href: "admin.html", labelKey: "users", icon: "users", admin: true });
  return items;
}

function logout() {
  clearSession();
  window.location.href = "index.html";
}

function avatarMarkup(user, sizeClass) {
  if (user.profileImage) {
    return `<img src="${user.profileImage}" alt="" class="avatar-img ${sizeClass || ""}" />`;
  }
  return ICONS.avatar;
}

function buildDesktopNav(user, page) {
  return navItems(user)
    .filter((i) => !i.admin || user.role === "admin")
    .map((i) => `<a href="${i.href}" class="${i.page === page ? "active" : ""}"><span class="ico">${ICONS[i.icon]}</span>${t(i.labelKey)}</a>`)
    .join("");
}

// A group renders as a <button> (accordion header) + a collapsible list of
// child links; a plain item renders as a normal link — both touch-sized.
function buildMobileNav(user, page) {
  return mobileNavItems(user)
    .filter((i) => !i.admin || user.role === "admin")
    .map((item) => {
      if (item.group) {
        const childActive = item.children.some((c) => c.page === page);
        const panelId = `mnav-panel-${item.group}`;
        const children = item.children
          .map((c) => `<a href="${c.href}" class="mobile-nav-sublink ${c.page === page ? "active" : ""}">${t(c.labelKey)}</a>`)
          .join("");
        return `
          <div class="mobile-nav-group">
            <button type="button" class="mobile-nav-toggle ${childActive ? "active" : ""}" aria-expanded="${childActive}" aria-controls="${panelId}">
              <span class="ico">${ICONS[item.icon]}</span>
              <span class="mobile-nav-label">${t(item.labelKey)}</span>
              <span class="chevron" aria-hidden="true">${ICONS.chevron}</span>
            </button>
            <div class="mobile-nav-subpanel ${childActive ? "open" : ""}" id="${panelId}">
              <div class="mobile-nav-sublist">${children}</div>
            </div>
          </div>`;
      }
      return `<a href="${item.href}" class="mobile-nav-link ${item.page === page ? "active" : ""}"><span class="ico">${ICONS[item.icon]}</span>${t(item.labelKey)}</a>`;
    })
    .join("");
}

function accountTypeLabel(user) {
  return user.accountType === "small_business" ? t("business") : t("individual");
}

function buildProfileDropdown(user) {
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "profile-trigger";
  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-expanded", "false");
  trigger.innerHTML = `${avatarMarkup(user, "avatar-sm")}<span class="profile-trigger-name">${escapeHtml(String(user.name || "").split(" ")[0] || "")}</span>`;

  const menu = document.createElement("div");
  menu.className = "profile-menu";
  menu.hidden = true;
  menu.innerHTML = `
    <div class="profile-menu-header">
      ${avatarMarkup(user, "avatar-md")}
      <div>
        <div class="profile-menu-name">${escapeHtml(user.name || "")}</div>
        <div class="profile-menu-type">${accountTypeLabel(user)}</div>
      </div>
    </div>
    <a href="settings.html">${t("account")}</a>
    <a href="settings.html">${t("settings")}</a>
    <div class="profile-menu-row">
      <span>${t("appearance")}</span>
      <div class="theme-switch" role="group" aria-label="${t("appearance")}">
        <button type="button" data-theme-choice="light" title="${t("light")}">☀</button>
        <button type="button" data-theme-choice="dark" title="${t("dark")}">☾</button>
        <button type="button" data-theme-choice="system" title="${t("systemDefault")}">◐</button>
      </div>
    </div>
    <div class="profile-menu-row">
      <span>${t("language")}</span>
      <select class="lang-select" aria-label="${t("language")}">
        <option value="en">English</option>
        <option value="so">Soomaali</option>
        <option value="ar">العربية</option>
      </select>
    </div>
    <a href="#" class="profile-menu-logout">${t("logout")}</a>
  `;

  const wrap = document.createElement("div");
  wrap.className = "profile-dropdown";
  wrap.appendChild(trigger);
  wrap.appendChild(menu);

  function closeMenu() {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }
  function openMenu() {
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  }
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.hidden ? openMenu() : closeMenu();
  });
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !wrap.contains(e.target)) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) closeMenu();
  });

  menu.querySelectorAll("[data-theme-choice]").forEach((btn) => {
    if (btn.dataset.themeChoice === getCurrentTheme()) btn.classList.add("active");
    btn.addEventListener("click", () => {
      setTheme(btn.dataset.themeChoice);
      menu.querySelectorAll("[data-theme-choice]").forEach((b) => b.classList.toggle("active", b === btn));
      syncThemeToProfile(btn.dataset.themeChoice);
    });
  });

  const langSelect = menu.querySelector(".lang-select");
  langSelect.value = getCurrentLanguage();
  langSelect.addEventListener("change", () => {
    setLanguage(langSelect.value);
    syncLanguageToProfile(langSelect.value);
    // Re-render nav text immediately rather than requiring a reload.
    rebuildNavText(user);
  });

  menu.querySelector(".profile-menu-logout").addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });

  return wrap;
}

// Best-effort sync to the backend so the preference follows the user to
// another device; failure (e.g. offline) is silently ignored since the
// localStorage copy already took effect for this session.
function syncThemeToProfile(theme) {
  if (typeof apiRequest === "function") apiRequest("/profile", { method: "PATCH", body: { theme } }).catch(() => {});
}
function syncLanguageToProfile(language) {
  if (typeof apiRequest === "function") apiRequest("/profile", { method: "PATCH", body: { language } }).catch(() => {});
}

function rebuildNavText(user) {
  const page = document.body.dataset.page;
  const sidebarNav = document.querySelector("#sidebar nav");
  if (sidebarNav) sidebarNav.innerHTML = buildDesktopNav(user, page);
  const mobileNav = document.querySelector("#mobileNav nav");
  if (mobileNav) mobileNav.innerHTML = buildMobileNav(user, page);
}

(function initLayout() {
  if (!getToken()) {
    window.location.href = "index.html";
    return;
  }

  const user = getUser() || {};
  const page = document.body.dataset.page;
  const first = String(user.name || "User").split(" ")[0];

  const titlebar = document.getElementById("titlebar");
  if (titlebar) {
    titlebar.innerHTML = `
      <button type="button" class="hamburger" id="hamburgerBtn" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav">
        <span></span><span></span><span></span>
      </button>
      <span class="tb-icon">${ICONS.avatar}</span>
      <span class="tb-title">E-Miizaan — ${t("appTagline")}</span>`;
    titlebar.appendChild(buildProfileDropdown(user));
  }

  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="avatar">${avatarMarkup(user)}</div>
      <div class="welcome">Welcome, ${escapeHtml(first)}</div>
      <nav>${buildDesktopNav(user, page)}</nav>
      <a href="#" class="logout" id="logoutLink"><span class="ico">${ICONS.logout}</span>${t("logout")}</a>`;

    document.getElementById("logoutLink").addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }

  // Mobile dropdown/accordion menu — appended once per page, hidden on desktop via CSS.
  const mobileNav = document.createElement("div");
  mobileNav.className = "mobile-nav";
  mobileNav.id = "mobileNav";
  mobileNav.hidden = true;
  mobileNav.innerHTML = `
    <nav>${buildMobileNav(user, page)}</nav>
    <a href="#" class="mobile-nav-link logout" id="mobileLogoutLink"><span class="ico">${ICONS.logout}</span>${t("logout")}</a>`;
  document.body.appendChild(mobileNav);

  const hamburger = document.getElementById("hamburgerBtn");
  function closeMenu() {
    mobileNav.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.classList.remove("open");
    setTimeout(() => { if (!mobileNav.classList.contains("open")) mobileNav.hidden = true; }, 250);
  }
  function openMenu() {
    mobileNav.hidden = false;
    // Next frame, so the "hidden -> visible" change doesn't eat the slide-down transition.
    requestAnimationFrame(() => {
      mobileNav.classList.add("open");
      hamburger.setAttribute("aria-expanded", "true");
      hamburger.classList.add("open");
    });
  }
  hamburger.addEventListener("click", () => {
    mobileNav.classList.contains("open") ? closeMenu() : openMenu();
  });
  document.getElementById("mobileLogoutLink").addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });

  // Accordion: tapping a group toggles only that group; others stay as they are.
  mobileNav.querySelectorAll(".mobile-nav-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      const panel = document.getElementById(btn.getAttribute("aria-controls"));
      btn.setAttribute("aria-expanded", String(!expanded));
      panel.classList.toggle("open", !expanded);
    });
  });

  // Close the whole menu when tapping outside it (doesn't cover content unnecessarily).
  document.addEventListener("click", (e) => {
    if (!mobileNav.classList.contains("open")) return;
    if (mobileNav.contains(e.target) || hamburger.contains(e.target)) return;
    closeMenu();
  });

  // Close on Escape, for keyboard users.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mobileNav.classList.contains("open")) closeMenu();
  });
})();
