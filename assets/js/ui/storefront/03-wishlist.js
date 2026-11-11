// @ts-check
/* app.js → Wishlist
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { readWish, toggleWish, syncBadges });
  function readWish() {
    try {
      const v = JSON.parse(localStorage.getItem(ctx.WISH_KEY) || "[]");
      return new Set(Array.isArray(v) ? v : []);
    } catch {
      return new Set();
    }
  }

  function toggleWish(handle) {
    const set = readWish();
    if (set.has(handle)) {
      set.delete(handle);
      ctx.toast(ctx.t("removedWish"));
    } else {
      set.add(handle);
      ctx.toast(ctx.t("savedWish"));
    }
    localStorage.setItem(ctx.WISH_KEY, JSON.stringify([...set]));
    if (ctx.R.getCustomer()) ctx.R.customerSyncWishlist([...set]);
    syncBadges();
    document.querySelectorAll("[data-wish]").forEach((node) => {
      const button = /** @type {HTMLElement} */ (node);
      button.classList.toggle("active", set.has(button.dataset.wish || ""));
    });
    if (document.body.dataset.page === "wishlist") ctx.renderWishlist();
  }

  function syncBadges() {
    const n = ctx.cartCount();
    document.querySelectorAll(".cart-count-n").forEach((node) => {
      const badge = /** @type {HTMLElement} */ (node);
      badge.textContent = String(n);
      badge.hidden = n === 0;
    });
    const w = readWish().size;
    document.querySelectorAll(".wish-count").forEach((node) => {
      const badge = /** @type {HTMLElement} */ (node);
      badge.textContent = String(w);
      badge.hidden = w === 0;
    });
  }
}
