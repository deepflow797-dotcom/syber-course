// @ts-check
/* dashboard.js → prelude
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, {
    syncCatalogModel,
    catalogWrite,
    catalogBanner,
    toast,
    getPath,
    setPath,
    orderList,
    productList,
    newOrdersCount,
    orderStatusCount,
    revenueOfOrders,
    lowStockProducts,
    saveDraftSoon,
    saveDraftNow,
    updateDraftState,
    updateCounts
  });
  const app = document.getElementById("dash-app");
  const modalRoot = document.getElementById("dash-modal-root");
  const LS_DASH_LANG = "restore_dash_lang_v1";

  const clone = (value) => ctx.R.clone(value);
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
    );
  /**
   * First match of a selector. Callers cast to the concrete element type they know
   * (the dashboard only queries real elements), which is why this returns `any`.
   * @param {string} selector
   * @param {ParentNode} [root]
   */
  const $ = (selector, root = document) => /** @type {any} */ (root.querySelector(selector));
  /**
   * All matches of a selector, as a real array.
   * @param {string} selector
   * @param {ParentNode} [root]
   * @returns {any[]}
   */
  const $$ = (selector, root = document) => /** @type {any} */ ([...root.querySelectorAll(selector)]);
  const digits = (value) => String(value ?? "").replace(/\D/g, "");
  const money = (value) => ctx.R.money(value);
  const L = (value) => ctx.R.L(value);
  const fmtDate = (value) => ctx.R.formatDate(value);
  const fmtDateTime = (value) =>
    ctx.R.formatDate(value, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const nowIso = () => new Date().toISOString();

  ctx.dashLang = localStorage.getItem(LS_DASH_LANG) === "fr" ? "fr" : "ar";
  const dt = (ar, fr) => (ctx.dashLang === "ar" ? ar : fr);
  const lng = (value) => {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") return value[ctx.dashLang] ?? value.ar ?? value.fr ?? "";
    return String(value);
  };

  ctx.model = clone(ctx.R.draft || ctx.R.state);
  ctx.dirty = Boolean(ctx.R.draft);

  /* ---- Catalog source of truth (products / collections / coupons) ----
     In Supabase mode with migrations 0002+0003 applied, these entities are
     read from and written to the relational tables through R.catalog
     (data/repositories/catalog.repo.js). The draft/publish JSON flow is only
     used for theme/settings/pages — and for the local demo. */
  const CAT = ctx.R.catalog;
  const tablesMode = () => Boolean(CAT && CAT.enabled && CAT.source === "tables");
  function syncCatalogModel() {
    ctx.model.products = clone(ctx.R.state.products || []);
    ctx.model.collections = clone(ctx.R.state.collections || []);
    ctx.model.settings = ctx.model.settings || {};
    ctx.model.settings.coupons = clone(ctx.R.state.settings?.coupons || []);
  }
  async function catalogWrite(label, work) {
    try {
      await work();
      syncCatalogModel();
      toast(label, "good");
      return true;
    } catch (error) {
      toast(dt("فشل الحفظ في قاعدة البيانات: ", "Échec de l'enregistrement : ") + (error?.message || error), "error");
      return false;
    }
  }
  function catalogBanner() {
    if (!CAT || !CAT.enabled) return "";
    if (tablesMode())
      return `<div class="notice good u-mb-12">${dt("مصدر الحقيقة: الجداول العلائقية (restore_products / restore_collections / restore_coupons). كل تعديل هنا يُحفظ مباشرة في قاعدة البيانات مع تسجيل في سجل التدقيق.", "Source de vérité : tables relationnelles. Chaque modification est enregistrée directement en base avec audit.")}</div>`;
    return `<div class="notice warn u-mb-12">${dt("الجداول العلائقية فارغة أو لم تُطبَّق الهجرة 0002/0003. المنتجات تُقرأ حاليًا من JSON (مصدر قديم). طبّق الهجرات ثم انقل البيانات:", "Tables relationnelles vides ou migrations 0002/0003 non appliquées. Appliquez-les puis importez :")} <button class="btn btn-sm btn-primary" data-action="import-catalog">${dt("نقل الكتالوج إلى الجداول", "Importer le catalogue")}</button></div>`;
  }
  ctx.session = ctx.R.currentSession();
  ctx.route = (location.hash || "#overview").slice(1);
  ctx.currentTab = "";
  ctx.searchTerm = "";
  ctx.saveTimer = undefined;
  ctx.orderBadgeSeen = Number(localStorage.getItem("restore_orders_seen_v1") || 0);
  const openEditors = {};

  const ICONS = {
    overview:
      '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="4" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    orders: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2l2.4 11h11L21 7H6"/>',
    products: '<path d="M4 7l8-4 8 4-8 4-8-4z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/>',
    categories:
      '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    content: '<path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    palette:
      '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="9" r="1"/><circle cx="15.5" cy="9" r="1"/><circle cx="9" cy="15" r="1"/><path d="M12 21c-1.2-2.3 1-4 3-4 2 0 3.5 1.5 3.5 3.5 0 .5-2.5.5-6.5.5z"/>',
    marketing: '<path d="M4 9v6h4l8 4V5L8 9H4z"/><path d="M20 9a4 4 0 0 1 0 6"/>',
    payment: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/>',
    team: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="18" cy="9" r="2"/><path d="M17 14c2.5 0 4 1.5 4 4"/>',
    reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.9l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.9-.34 1.7 1.7 0 0 0-1 1.55V21h-3v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.9.34l-.06.06L4.2 17.6l.06-.06a1.7 1.7 0 0 0 .34-1.9A1.7 1.7 0 0 0 3.1 14H3v-3h.1a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.9L4.2 8l2.12-2.12.06.06a1.7 1.7 0 0 0 1.9.34A1.7 1.7 0 0 0 9.3 4.7V4.6h3v.1a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.9-.34l.06-.06L17.4 8l-.06.06a1.7 1.7 0 0 0-.34 1.9 1.7 1.7 0 0 0 1.55 1h.09v3h-.09a1.7 1.7 0 0 0-1.55 1z"/>',
    audit: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    abandoned: '<path d="M4 4h16v12H9l-5 4V4z"/><path d="M8 9h8M8 12h5"/>',
    reviews: '<path d="M12 3l2.7 5.5 6 .9-4.35 4.25 1.03 6L12 16.9l-5.38 2.8 1.03-6L3.3 9.4l6-.9L12 3z"/>',
    blog: '<path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/><path d="M16 16h.01"/>',
    pages: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/>',
    preview: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
    publish: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    logout: '<path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
    moon: '<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    whatsapp:
      '<path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.3-4.3a8.5 8.5 0 1 1 15.7-4.5z"/><path d="M8.4 7.8c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .5.4l.8 1.9c.1.2 0 .4-.1.6l-.6.7c-.2.2-.1.3 0 .5.7 1.2 1.7 2.2 2.9 2.9.2.1.4.2.5 0l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.3.1.4.3.4.5 0 1-.5 1.8-1.4 2.1-.6.2-1.4.3-2.3.1-3.6-.8-6.4-3.6-7.2-7.2-.2-1-.1-1.8.1-2.4z"/>',
    external: '<path d="M14 3h7v7M10 14L21 3"/><path d="M21 14v7H3V3h7"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M18 9l-6 6-6-6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    arrows: '<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    image:
      '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2"/><path d="M6 14h12v7H6z"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.4-2L20 9M4 15l2.5 2a7 7 0 0 0 11.4-2"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>'
  };
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.overview}</svg>`;

  /**
   * Shows the dashboard toast for 3.2 s. The hide timer is kept on the function object.
   * @type {ToastFn}
   */
  function toast(message, type = "") {
    const node = document.getElementById("dash-toast");
    if (!node) return;
    node.textContent = message;
    node.className = `toast show ${type}`;
    clearTimeout(/** @type {ToastFn} */ (toast).timer);
    /** @type {ToastFn} */ (toast).timer = setTimeout(() => {
      node.className = "toast";
    }, 3200);
  }

  function getPath(object, path) {
    return String(path)
      .split(".")
      .reduce((value, key) => value?.[key], object);
  }
  function setPath(object, path, value) {
    const parts = String(path).split(".");
    let cursor = object;
    parts.forEach((key, index) => {
      if (index === parts.length - 1) {
        cursor[key] = value;
        return;
      }
      if (cursor[key] == null || typeof cursor[key] !== "object")
        cursor[key] = /^\d+$/.test(parts[index + 1]) ? [] : {};
      cursor = cursor[key];
    });
  }

  function orderList() {
    return ctx.R.getOrders()
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  function productList() {
    return ctx.model.products || [];
  }
  function newOrdersCount() {
    return orderList().filter((order) => order.status === "new").length;
  }
  function orderStatusCount(status) {
    return orderList().filter((order) => order.status === status).length;
  }
  function revenueOfOrders(orders) {
    return orders
      .filter((order) => order.status !== "cancelled" && order.status !== "returned")
      .reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  }
  function lowStockProducts() {
    return productList().filter(
      (product) =>
        product.active !== false && Number(product.stock) <= Number(ctx.model.settings.lowStockThreshold || 2)
    );
  }

  function saveDraftSoon() {
    ctx.dirty = true;
    ctx.model.updatedAt = nowIso();
    clearTimeout(ctx.saveTimer);
    ctx.saveTimer = setTimeout(() => {
      ctx.R.saveDraft(ctx.model);
      updateDraftState();
    }, 500);
    updateDraftState();
  }
  function saveDraftNow() {
    clearTimeout(ctx.saveTimer);
    ctx.model.updatedAt = nowIso();
    ctx.R.saveDraft(ctx.model);
    ctx.dirty = true;
    updateDraftState();
  }
  function updateDraftState() {
    const node = $(".dash-save-state");
    if (!node) return;
    node.className = `dash-save-state ${ctx.dirty ? "dirty" : "published"}`;
    node.innerHTML = `<i></i>${ctx.dirty ? dt("تغييرات غير منشورة", "Modifications non publiées") : dt("متجر محدث", "Boutique à jour")}`;
  }

  function updateCounts() {
    const count = newOrdersCount();
    $$("[data-nav-count='orders']").forEach((node) => {
      node.textContent = String(count || "");
      /** @type {HTMLElement} */ (node).hidden = !count;
    });
    const badge = /** @type {HTMLElement | null} */ ($("[data-order-alert]"));
    if (badge) {
      const unseen = Math.max(0, count - ctx.orderBadgeSeen);
      badge.textContent = String(unseen || "");
      badge.hidden = !unseen;
    }
  }
  Object.assign(ctx, {
    app,
    modalRoot,
    LS_DASH_LANG,
    clone,
    esc,
    $,
    $$,
    digits,
    money,
    L,
    fmtDate,
    fmtDateTime,
    nowIso,
    dt,
    lng,
    CAT,
    tablesMode,
    openEditors,
    ICONS,
    icon
  });
}
