// Translation loader. Applies [data-i18n] (textContent), [data-i18n-placeholder]
// (input placeholder) on DOM ready, and exposes window.t(key) for JS-generated
// strings (toasts, dynamically built tile labels, etc).
(function () {
  const RTL_LANGS = ["ar"];

  function dict(lang) {
    return { en: window.I18N_EN, so: window.I18N_SO, ar: window.I18N_AR }[lang];
  }

  function readStoredUser() {
    try {
      const raw = localStorage.getItem("emiizaan_user");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function currentLang() {
    const user = readStoredUser();
    return localStorage.getItem("emiizaan_lang") || (user && user.language) || "en";
  }

  function t(key, fallback) {
    const d = dict(currentLang()) || window.I18N_EN || {};
    return d[key] || (window.I18N_EN && window.I18N_EN[key]) || fallback || key;
  }

  function applyDirection(lang) {
    const dir = RTL_LANGS.includes(lang) ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
  }

  function applyTranslations() {
    const lang = currentLang();
    applyDirection(lang);
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
  }

  function setLanguage(lang) {
    localStorage.setItem("emiizaan_lang", lang);
    applyTranslations();
    document.dispatchEvent(new CustomEvent("i18n:changed", { detail: { lang } }));
  }

  // Apply as early as possible (dir/lang), then again once the DOM has the
  // page's static markup and once more after layout.js/page scripts finish
  // building dynamic content (nav, tiles) later in the same tick.
  applyDirection(currentLang());
  document.addEventListener("DOMContentLoaded", applyTranslations);

  window.t = t;
  window.setLanguage = setLanguage;
  window.getCurrentLanguage = currentLang;
  window.applyTranslations = applyTranslations;
})();
