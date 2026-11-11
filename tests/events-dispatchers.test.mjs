/* Unit tests for the storefront click dispatcher (ui/storefront/15a-click-handlers.js) and the SEO helpers
   (ui/storefront/15b-seo.js). They run in jsdom against the real modules — no storefront boot, no network. */
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { dispatchClick, install as installClicks } from "../assets/js/ui/storefront/15a-click-handlers.js";
import { install as installSeo } from "../assets/js/ui/storefront/15b-seo.js";

/** Boots a jsdom document and points the globals the handlers touch at it. */
function bootDom(html, url = "https://shop.example/product.html?handle=phone-x") {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.Node = dom.window.Node;
  return dom.window.document;
}

/** Minimal storefront context: records calls instead of rendering. */
function fakeCtx(extra = {}) {
  const calls = [];
  const record =
    (name) =>
    (...args) =>
      calls.push([name, ...args]);
  const ctx = {
    calls,
    R: {
      lang: "fr",
      theme: "light",
      customerLogout: record("customerLogout"),
      setLang: record("setLang"),
      setTheme: record("setTheme"),
      submitReview: async () => {}
    },
    SET: { country: { name: "MR", currencyName: "MRU" } },
    PDP: { p: { handle: "phone-x", options: [], variants: [] }, qty: 1, specs: {}, sel: {} },
    MAX_QTY: 10,
    ICON: { sun: "<i-sun>", moon: "<i-moon>" },
    t: (key) => `t:${key}`,
    L: (value) => String(value),
    toast: record("toast"),
    readCart: () => [],
    setQty: record("setQty"),
    removeLine: record("removeLine"),
    toggleWish: record("toggleWish"),
    closeSearch: record("closeSearch"),
    closeCart: record("closeCart"),
    openCart: record("openCart"),
    addToCart: record("addToCart"),
    pdpVariant: () => ({ id: "v1" }),
    hydrateIcons: record("hydrateIcons"),
    pdpInfoHTML: () => "<div id='product-info'></div>",
    renderCustomerAccount: record("renderCustomerAccount"),
    renderAccount: record("renderAccount"),
    ...extra
  };
  return ctx;
}

/** Fires a bubbling click on the first element matching `selector`. */
function click(document, selector) {
  const el = document.querySelector(selector);
  assert.ok(el, `fixture is missing ${selector}`);
  let prevented = false;
  const event = { target: el, stopPropagation() {}, preventDefault: () => (prevented = true) };
  return { event, prevented: () => prevented };
}

test("dispatchClick: the first non-passthrough match consumes the click and stops the chain", () => {
  const seen = [];
  const handlers = [
    { match: () => null, run: () => seen.push("a") },
    { match: () => "el", run: () => seen.push("b") },
    { match: () => "el", run: () => seen.push("c") }
  ];
  assert.equal(dispatchClick(handlers, { target: null }), true);
  assert.deepEqual(seen, ["b"]);
});

test("dispatchClick: passthrough entries run but let the chain continue", () => {
  const seen = [];
  const handlers = [
    { match: () => "el", run: () => seen.push("side-effect"), passthrough: true },
    { match: () => "el", run: () => seen.push("consumer") },
    { match: () => "el", run: () => seen.push("never") }
  ];
  dispatchClick(handlers, { target: null });
  assert.deepEqual(seen, ["side-effect", "consumer"]);
});

test("dispatchClick: no match reports false and runs nothing", () => {
  let ran = false;
  assert.equal(dispatchClick([{ match: () => null, run: () => (ran = true) }], { target: null }), false);
  assert.equal(ran, false);
});

test("install() exposes the table and the dispatcher on ctx", () => {
  bootDom("<body></body>");
  const ctx = fakeCtx();
  installClicks(ctx);
  assert.equal(typeof ctx.dispatchClick, "function");
  assert.equal(ctx.clickHandlers.length, 24);
});

test("click table: theme toggle flips the theme and rewrites the button label", () => {
  const document = bootDom("<body><button data-theme-toggle><span>x</span></button></body>");
  const ctx = fakeCtx();
  installClicks(ctx);
  const { event } = click(document, "[data-theme-toggle]");
  assert.equal(ctx.dispatchClick(ctx.clickHandlers, event), true);
  assert.deepEqual(ctx.calls[0], ["setTheme", "dark"]);
  assert.match(document.querySelector("[data-theme-toggle]").innerHTML, /i-sun/);
});

test("click table: language switch reloads only when the language actually changes", () => {
  const document = bootDom('<body><a data-set-lang="fr">fr</a><a data-set-lang="ar">ar</a></body>');
  const ctx = fakeCtx();
  installClicks(ctx);
  ctx.dispatchClick(ctx.clickHandlers, click(document, '[data-set-lang="fr"]').event);
  assert.deepEqual(ctx.calls, [], "same language must not call setLang");
  ctx.dispatchClick(ctx.clickHandlers, click(document, '[data-set-lang="ar"]').event);
  assert.deepEqual(ctx.calls[0], ["setLang", "ar"]);
});

test("click table: cart increment uses the matching line's quantity", () => {
  const document = bootDom('<body><button data-cart-inc="v9" data-handle="phone-x">+</button></body>');
  const ctx = fakeCtx({
    readCart: () => [
      { handle: "phone-x", variantId: "v9", qty: 2 },
      { handle: "other", variantId: "v1", qty: 7 }
    ]
  });
  installClicks(ctx);
  ctx.dispatchClick(ctx.clickHandlers, click(document, "[data-cart-inc]").event);
  assert.deepEqual(ctx.calls[0], ["setQty", "v9", "phone-x", 3]);
});

test("click table: quantity stepper clamps to 1..MAX_QTY and repaints the value", () => {
  const document = bootDom(
    '<body><button data-qty="-1">-</button><button data-qty="1">+</button><span id="qty-val">1</span></body>'
  );
  const ctx = fakeCtx();
  installClicks(ctx);
  ctx.dispatchClick(ctx.clickHandlers, click(document, '[data-qty="-1"]').event);
  assert.equal(ctx.PDP.qty, 1, "never below 1");
  ctx.PDP.qty = 10;
  ctx.dispatchClick(ctx.clickHandlers, click(document, '[data-qty="1"]').event);
  assert.equal(ctx.PDP.qty, 10, "never above MAX_QTY");
  ctx.PDP.qty = 9;
  ctx.dispatchClick(ctx.clickHandlers, click(document, '[data-qty="1"]').event);
  assert.equal(ctx.PDP.qty, 10);
  assert.equal(document.getElementById("qty-val").textContent, "10");
});

test("click table: add-to-cart opens the cart with the chosen variant", () => {
  const document = bootDom("<body><button data-add-cart>add</button></body>");
  const ctx = fakeCtx();
  installClicks(ctx);
  ctx.dispatchClick(ctx.clickHandlers, click(document, "[data-add-cart]").event);
  assert.deepEqual(ctx.calls[0], ["addToCart", "phone-x", "v1", 1, {}]);
  assert.deepEqual(ctx.calls[1], ["openCart"]);
});

test("click table: an empty product (no PDP) makes add-to-cart a no-op", () => {
  const document = bootDom("<body><button data-add-cart>add</button></body>");
  const ctx = fakeCtx({ PDP: { p: null, qty: 1, specs: {}, sel: {} } });
  installClicks(ctx);
  ctx.dispatchClick(ctx.clickHandlers, click(document, "[data-add-cart]").event);
  assert.deepEqual(ctx.calls, []);
});

test("click table: swatch selection repaints the card image and tint", () => {
  const document = bootDom(
    '<body><div class="product-card"><button class="swatch" data-color-img="b.webp" data-color-hex="#123456">b</button>' +
      "<img data-card-main><div data-card-tint></div></div></body>"
  );
  const ctx = fakeCtx();
  installClicks(ctx);
  ctx.dispatchClick(ctx.clickHandlers, click(document, ".swatch").event);
  assert.equal(document.querySelector("[data-card-main]").getAttribute("src"), "b.webp");
  assert.equal(document.querySelector(".swatch").classList.contains("selected"), true);
  assert.equal(document.querySelector("[data-card-tint]").style.background, "rgb(18, 52, 86)");
});

test("SEO: setMeta creates the tag once and updates it afterwards", () => {
  const document = bootDom("<head></head><body></body>");
  const ctx = fakeCtx();
  installSeo(ctx);
  ctx.setMeta("property", "og:title", "First");
  ctx.setMeta("property", "og:title", "Second");
  const tags = document.head.querySelectorAll('meta[property="og:title"]');
  assert.equal(tags.length, 1);
  assert.equal(tags[0].getAttribute("content"), "Second");
});

test("SEO: absoluteUrl resolves relative paths and tolerates garbage", () => {
  bootDom("<body></body>", "https://shop.example/product.html");
  const ctx = fakeCtx();
  installSeo(ctx);
  assert.equal(ctx.absoluteUrl("assets/a.webp"), "https://shop.example/assets/a.webp");
  assert.equal(ctx.absoluteUrl(""), "");
});

test("SEO: setCanonical and setJsonLd keep a single tag each", () => {
  const document = bootDom("<head></head><body></body>");
  const ctx = fakeCtx();
  installSeo(ctx);
  ctx.setCanonical("https://shop.example/one");
  ctx.setCanonical("https://shop.example/two");
  ctx.setJsonLd({ "@type": "Store" });
  ctx.setJsonLd({ "@type": "Product" });
  assert.equal(document.head.querySelectorAll('link[rel="canonical"]').length, 1);
  assert.match(document.head.querySelector('link[rel="canonical"]').getAttribute("href"), /two$/);
  const ld = document.head.querySelectorAll("script[data-seo-jsonld]");
  assert.equal(ld.length, 1);
  assert.equal(JSON.parse(ld[0].textContent)["@type"], "Product");
});

test("SEO: product JSON-LD carries the offer, price and stock availability", () => {
  const document = bootDom("<head></head><body></body>");
  const ctx = fakeCtx({
    SET: { storeName: "Shop", baseUrl: "https://shop.example", colors: { primary: "#000" } },
    productRating: () => 0,
    productReviews: () => [],
    R: { lang: "fr", theme: "light" }
  });
  installSeo(ctx);
  ctx.applyProductSeo({ handle: "phone-x", title: "Phone", price: 1200, stock: 0, image: "p.webp", description: "d" });
  const data = JSON.parse(document.head.querySelector("script[data-seo-jsonld]").textContent);
  assert.equal(data["@type"], "Product");
  assert.equal(data.offers.price, 1200);
  assert.equal(data.offers.availability, "https://schema.org/OutOfStock");
  assert.equal(data.aggregateRating, undefined, "no rating means no aggregateRating node");
});
