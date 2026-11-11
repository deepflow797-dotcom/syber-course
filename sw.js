/* Restore storefront service worker: fast repeat visits without stale prices. */
const CACHE = "restore-shell-v16";
const SHELL = [
  "./",
  "index.html",
  "collection.html",
  "product.html",
  "checkout.html",
  "wishlist.html",
  "account.html",
  "blog.html",
  "blog-post.html",
  "page.html",
  "manifest.webmanifest",
  "assets/css/styles.css",
  "assets/css/restore.css",
  "assets/vendor/purify.min.js",
  "assets/js/config.js",
  "assets/js/state.js",
  "assets/js/app.js",
  "assets/js/core/dom.js",
  "assets/js/core/utils.js",
  "assets/js/data/repositories/catalog.repo.js",
  "assets/js/data/repositories/products.repo.js",
  "assets/js/data/supabase-client.js",
  "assets/js/domain/catalog-mappers.js",
  "assets/js/domain/pricing.js",
  "assets/js/i18n/ar.js",
  "assets/js/i18n/fr.js",
  "assets/js/i18n/index.js",
  "assets/js/services/00-config.js",
  "assets/js/services/01-default-content.js",
  "assets/js/services/02-state-hydration.js",
  "assets/js/services/03-shared-utils.js",
  "assets/js/services/04-staff-auth.js",
  "assets/js/services/05-supabase-rest.js",
  "assets/js/services/06-orders.js",
  "assets/js/services/07-publish.js",
  "assets/js/services/08-catalog.js",
  "assets/js/services/09-customers.js",
  "assets/js/services/10-reviews.js",
  "assets/js/services/11-currency.js",
  "assets/js/services/12-pages-settings.js",
  "assets/js/services/13-store-utils.js",
  "assets/js/services/14-sync-events.js",
  "assets/js/ui/storefront/00-context.js",
  "assets/js/ui/storefront/01-utils.js",
  "assets/js/ui/storefront/02-cart.js",
  "assets/js/ui/storefront/03-wishlist.js",
  "assets/js/ui/storefront/04-header-footer.js",
  "assets/js/ui/storefront/05-cart-drawer.js",
  "assets/js/ui/storefront/06-search.js",
  "assets/js/ui/storefront/07-mobile-menu.js",
  "assets/js/ui/storefront/08-product-card.js",
  "assets/js/ui/storefront/09-home.js",
  "assets/js/ui/storefront/10-home-sections.js",
  "assets/js/ui/storefront/11-product-page.js",
  "assets/js/ui/storefront/12a-checkout-markup.js",
  "assets/js/ui/storefront/12b-checkout-flow.js",
  "assets/js/ui/storefront/12-checkout.js",
  "assets/js/ui/storefront/13-wishlist-page.js",
  "assets/js/ui/storefront/14-static-pages.js",
  "assets/js/ui/storefront/15a-click-handlers.js",
  "assets/js/ui/storefront/15b-seo.js",
  "assets/js/ui/storefront/15-global-events.js",
  "assets/js/ui/storefront/16-boot.js",
  "assets/js/data.js",
  "assets/js/brand.config.js",
  "assets/js/theme-init.js",
  "assets/js/pixels.js",
  "assets/img/favicon.svg",
  "assets/img/brand-logo.svg",
  "assets/img/brand-logo-white.svg",
  "assets/img/pwa-192.png",
  "assets/img/pwa-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch((error) => console.warn("Restore SW pre-cache:", error))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match("index.html"));
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/dashboard.html")) return;
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (/\.(?:css|js|webmanifest)$/.test(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.includes("/assets/")) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
