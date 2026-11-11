// @ts-check
/* app.js → Wishlist page
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { renderWishlist });
  function renderWishlist() {
    const grid = document.getElementById("wishlist-grid");
    if (!grid) return;
    document.title = `${ctx.t("wishlist")} | ${ctx.L(ctx.SET.storeName)}`;
    const heading = document.querySelector(".collection-head h1");
    if (heading) heading.textContent = ctx.t("wishlist");
    const items = ctx.ALL_PRODUCTS.filter((p) => ctx.readWish().has(p.handle));
    grid.innerHTML = items.length
      ? items.map(ctx.cardHTML).join("")
      : `<div class="empty-state" style="grid-column:1/-1"><h2>${ctx.esc(ctx.t("emptyWish"))}</h2><p>${ctx.esc(ctx.t("emptyWishText"))}</p><a class="btn btn-primary" href="collection.html?handle=all">${ctx.esc(ctx.t("browseAll"))}</a></div>`;
    ctx.observeReveals();
    ctx.hydrateIcons(grid);
  }
}
