/* app.js → Boot
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

export function install(ctx) {
  Object.assign(ctx, { boot });
  function boot() {
    ctx.applySeo();
    ctx.renderHeader();
    ctx.renderCustomerAccount();
    ctx.renderFooter();
    ctx.mountCart();
    ctx.syncBadges();
    ctx.hydrateIcons();
    ctx.injectPixels();
    ctx.renderCustomerAccount();
    const page = document.body.dataset.page;
    if (page === "home") ctx.renderHome();
    else if (page === "collection") ctx.renderCollection();
    else if (page === "product") ctx.renderProduct();
    else if (page === "checkout") ctx.renderCheckout();
    else if (page === "wishlist") ctx.renderWishlist();
    else if (page === "page") ctx.renderPage();
    else if (page === "account") ctx.renderAccount();
    else if (page === "blog") ctx.renderBlog();
    else if (page === "post") ctx.renderBlogPost();
    ctx.renderCart();
    ctx.hydrateIcons();
    if (ctx.SET.pwa && "serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
