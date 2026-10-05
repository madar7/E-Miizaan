// Theme (light/dark/system) application + toggle. Kept separate from i18n.js
// since theme has nothing to do with translation, but both are "apply before
// paint where possible" concerns.
(function () {
  function readStoredUser() {
    try {
      const raw = localStorage.getItem("emiizaan_user");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function currentTheme() {
    const user = readStoredUser();
    return localStorage.getItem("emiizaan_theme") || (user && user.theme) || "system";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function setTheme(theme) {
    localStorage.setItem("emiizaan_theme", theme);
    applyTheme(theme);
    document.dispatchEvent(new CustomEvent("theme:changed", { detail: { theme } }));
  }

  applyTheme(currentTheme());

  // If the user picked "system" and the OS theme changes mid-session, follow it
  // (the [data-theme="system"] CSS block already reacts to prefers-color-scheme;
  // nothing else to do here — this listener exists only for older engines where
  // the media query inside an attribute selector doesn't re-evaluate live).
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (currentTheme() === "system") applyTheme("system");
    });
  }

  window.getCurrentTheme = currentTheme;
  window.setTheme = setTheme;
})();
