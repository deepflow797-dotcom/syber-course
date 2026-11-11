// @ts-check
/* state.js → Default content: demo products, buildState, hydrate, i18n helpers (texts live in 01-default-texts.js)
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */
import { t as tI18n, L as LI18n } from "../i18n/index.js";
import { createDefaultState } from "./01a-default-state.js";

export function install(ctx) {
  Object.assign(ctx, {
    hydrate,
    t,
    money,
    formatDate,
    setLang,
    setTheme
  });
  // Default state builders live in 01a-default-state.js; hydrate merges saved data over them.
  const defaultState = createDefaultState(ctx);

  function hydrate(saved) {
    const base = defaultState.buildState();
    if (!saved) return base;
    const out = ctx.merge(base, saved);
    const baseProducts = new Map(base.products.map((p) => [p.handle, p]));
    out.products = (saved.products || base.products).map((p) => ctx.merge(baseProducts.get(p.handle) || {}, p));
    out.collections = (saved.collections || base.collections).map((c) => {
      const merged = ctx.merge(base.collections.find((x) => x.handle === c.handle) || {}, c);
      if (typeof merged.title === "string") merged.title = defaultState.collectionTitle(merged);
      return merged;
    });
    out.pages = (saved.pages || base.pages).map((p) => ctx.merge(base.pages.find((x) => x.slug === p.slug) || {}, p));
    out.blog = (saved.blog || base.blog).map((b) => ctx.merge(base.blog.find((x) => x.slug === b.slug) || {}, b));
    out.settings.homeSections = (saved.settings?.homeSections || base.settings.homeSections).map((s) =>
      ctx.merge(base.settings.homeSections.find((x) => x.id === s.id) || {}, s)
    );
    out.settings.navigation = (saved.settings?.navigation || base.settings.navigation).map((n) =>
      ctx.merge(base.settings.navigation.find((x) => x.id === n.id) || {}, n)
    );
    out.settings.pageSections = (saved.settings?.pageSections || base.settings.pageSections).map((s) =>
      ctx.merge(base.settings.pageSections.find((x) => x.id === s.id) || {}, s)
    );
    out.products.forEach((p) => {
      if (!p.specs) p.specs = defaultState.specsFor(p, p.battery || 92);
      if (!p.includes) p.includes = defaultState.includesFor(p);
      if (!p.description) p.description = p.description || "";
      if (!p.colorImages) p.colorImages = {};
      if (!p.colorRemote) p.colorRemote = {};
    });
    return out;
  }
  // I18N moved to ./i18n/ar.js, ./i18n/fr.js (single source of truth)

  const LANG_KEY = "lang";
  ctx.lang = localStorage.getItem(ctx.LS_LANG) === "fr" ? "fr" : "ar";
  ctx.theme = localStorage.getItem(ctx.LS_THEME) === "dark" ? "dark" : "light";

  function t(key, vars = {}) {
    return tI18n(ctx.lang, key, vars);
  }
  const L = (value) => LI18n(ctx.lang, value);
  function money(n) {
    return ctx.formatCurrency(n);
  }
  /** @param {string | number | Date} value @param {Intl.DateTimeFormatOptions} [opts] */
  function formatDate(value, opts = { year: "numeric", month: "short", day: "numeric" }) {
    try {
      return new Intl.DateTimeFormat(ctx.lang === "ar" ? "ar-MR" : "fr-MR", opts).format(new Date(value));
    } catch {
      return String(value || "");
    }
  }

  function setLang(next) {
    ctx.lang = next === "fr" ? "fr" : "ar";
    localStorage.setItem(ctx.LS_LANG, ctx.lang);
    ctx.applyDocument();
    window.dispatchEvent(new CustomEvent("restore:lang", { detail: ctx.lang }));
  }
  function setTheme(next) {
    ctx.theme = next === "dark" ? "dark" : "light";
    localStorage.setItem(ctx.LS_THEME, ctx.theme);
    ctx.applyDocument();
  }
  Object.assign(ctx, { LANG_KEY, L });
}
