/* Restore — theme initialization (inline script replacement for strict CSP).
   This script runs immediately to set the HTML lang/dir/theme attributes
   before the first paint, avoiding a flash of incorrect theme/language. */
(() => {
  "use strict";

  const LS_LANG = "restore_lang_v1";
  const LS_THEME = "restore_theme_v1";

  // Read persisted preferences
  const lang = localStorage.getItem(LS_LANG) === "fr" ? "fr" : "ar";
  const theme =
    localStorage.getItem(LS_THEME) || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === "ar" ? "rtl" : "ltr";
  html.dataset.lang = lang;
  html.dataset.theme = theme;

  // Expose for other scripts
  window.RESTORE_THEME_INIT = { lang, theme };
})();
