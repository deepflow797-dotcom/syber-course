// @ts-check
/* app.js → Storefront click handlers (extracted verbatim from 15-global-events.js)
   The document click listener is a lookup table: entries are tested in order and the first match wins.
   Entries flagged `passthrough: true` are side effects that must run on every click without consuming it.
   Behaviour is identical to the former if/return chain; see tests/events-dispatchers.test.mjs. */

/** @param {any} ctx Shared storefront context (see app.js). */

/** Closest ancestor matching `selector`, or null. */
function pick(e, selector) {
  const target = /** @type {any} */ (e.target);
  if (!target || typeof target.closest !== "function") return null;
  return target.closest(selector);
}

/* ---------- header / account ---------- */

function accountToggle(ctx, e) {
  e.stopPropagation();
  document.querySelector(".account-dropdown")?.classList.toggle("open");
}

function closeAccountDropdowns(ctx, e) {
  document.querySelectorAll(".account-dropdown.open").forEach((dropdown) => {
    if (!dropdown.contains(/** @type {any} */ (e.target))) dropdown.classList.remove("open");
  });
}

function customerLogout(ctx) {
  ctx.R.customerLogout();
  ctx.renderCustomerAccount();
  ctx.toast(ctx.t("signedOut"), "good");
  if (document.body.dataset.page === "account") ctx.renderAccount();
}

function setLang(ctx, e, el) {
  e.preventDefault();
  if (el.dataset.setLang === ctx.R.lang) return;
  ctx.R.setLang(el.dataset.setLang);
  location.reload();
}

function toggleTheme(ctx, e) {
  e.preventDefault();
  const next = ctx.R.theme === "dark" ? "light" : "dark";
  ctx.R.setTheme(next);
  const label = next === "dark" ? ctx.t("light") : ctx.t("dark");
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    const suffix = button.closest(".menu-preferences") ? ` ${label}` : "";
    button.innerHTML = `${next === "dark" ? ctx.ICON.sun : ctx.ICON.moon}${suffix}`;
  });
}

function showCountry(ctx) {
  ctx.toast(`${ctx.L(ctx.SET.country.name)} · ${ctx.L(ctx.SET.country.currencyName)}`);
}

function closeLangSwitch() {
  document.querySelector(".lang-switch")?.classList.remove("open");
}

function videoSoon(ctx) {
  ctx.toast(ctx.R.lang === "ar" ? "فيديوهات المجتمع ستُضاف قريبًا" : "Les vidéos de la communauté arrivent bientôt");
}

/* ---------- reviews ---------- */

function reviewError(ctx) {
  return (error) => {
    if (String(error?.message) === "loginRequired") {
      ctx.toast(ctx.t("loginRequired"), "error");
      setTimeout(() => {
        location.href = "account.html";
      }, 1200);
      return;
    }
    ctx.toast(error?.message || ctx.t("reviewIncomplete"), "error");
  };
}

function reviewDraft() {
  const rating = Number(/** @type {any} */ (document.querySelector(".rating-input"))?.dataset.rating || 0);
  const title = /** @type {HTMLInputElement} */ (document.getElementById("review-title"))?.value.trim() || "";
  const body = /** @type {HTMLTextAreaElement} */ (document.getElementById("review-body"))?.value.trim() || "";
  const handle = new URLSearchParams(location.search).get("handle");
  return { rating, title, body, handle };
}

function isCompleteReview(draft) {
  return Boolean(draft.rating && draft.title && draft.body && draft.handle);
}

function submitReview(ctx) {
  const draft = reviewDraft();
  if (!isCompleteReview(draft)) {
    ctx.toast(ctx.t("reviewIncomplete"), "error");
    return;
  }
  const { handle, rating, title, body } = draft;
  ctx.R.submitReview({ productHandle: handle, rating, title, body })
    .then(() => {
      ctx.toast(ctx.t("reviewSubmitted"), "good");
      setTimeout(() => location.reload(), 1200);
    })
    .catch(reviewError(ctx));
}

function pickRating(e, el) {
  const val = Number(el.dataset.star);
  const input = el.closest(".rating-input");
  input.dataset.rating = val;
  input.querySelectorAll("button").forEach((b, i) => {
    b.classList.toggle("active", i < val);
  });
}

/* ---------- cart ---------- */

function findLine(ctx, el, datasetKey) {
  const variant = el.dataset[datasetKey];
  return ctx.readCart().find((x) => x.handle === el.dataset.handle && String(x.variantId) === String(variant));
}

function cartIncrement(ctx, e, el) {
  const item = findLine(ctx, el, "cartInc");
  if (item) ctx.setQty(el.dataset.cartInc, el.dataset.handle, item.qty + 1);
}

function cartDecrement(ctx, e, el) {
  const item = findLine(ctx, el, "cartDec");
  if (item) ctx.setQty(el.dataset.cartDec, el.dataset.handle, item.qty - 1);
}

function cartRemove(ctx, e, el) {
  ctx.removeLine(el.dataset.handle, el.dataset.cartRemove);
}

function toggleWishlist(ctx, e, el) {
  e.preventDefault();
  ctx.toggleWish(el.dataset.wish);
}

/* ---------- product cards ---------- */

function paintCardTint(card, swatch, isFirst) {
  const tint = card.querySelector("[data-card-tint]");
  if (!tint) return;
  const image = card.querySelector("[data-card-main]");
  tint.style.background = swatch.dataset.colorHex || "transparent";
  tint.style.opacity = isFirst || (image && swatch.dataset.colorImg !== image.dataset.initialSrc) ? "0" : ".18";
  if (swatch.dataset.colorHex) tint.style.opacity = isFirst ? "0" : ".16";
}

function pickSwatch(ctx, e, swatch) {
  e.preventDefault();
  const card = swatch.closest(".product-card");
  if (!card) return;
  card.querySelectorAll(".swatch").forEach((x) => x.classList.remove("selected"));
  swatch.classList.add("selected");
  const image = card.querySelector("[data-card-main]");
  if (image && swatch.dataset.colorImg) image.src = swatch.dataset.colorImg;
  paintCardTint(card, swatch, card.querySelector(".swatch") === swatch);
}

function scrollTrack(e, el) {
  const track = el.closest(".carousel-wrap")?.querySelector(".track") || el.closest(".video-panel");
  if (!track) return;
  track.scrollBy({
    left: (el.dataset.scroll === "next" ? 1 : -1) * track.clientWidth * 0.8,
    behavior: "smooth"
  });
}

/* ---------- product page ---------- */

function addToCart(ctx) {
  if (!ctx.PDP.p) return false;
  const variant = ctx.pdpVariant();
  if (!variant) return false;
  ctx.addToCart(ctx.PDP.p.handle, variant.id, ctx.PDP.qty, ctx.PDP.specs);
  return true;
}

function addToCartAndOpen(ctx) {
  if (addToCart(ctx)) ctx.openCart();
}

function buyNow(ctx) {
  if (addToCart(ctx)) location.href = "checkout.html";
}

const SPEC_KEYS = (product) => (product?.options || []).map((option) => option.name);

function variantForSpecs(product, selected) {
  const keys = SPEC_KEYS(product);
  return (product.variants || []).find((x) => keys.every((key, i) => x[`o${i + 1}`] === selected[key]));
}

function fallbackVariant(product, name, value) {
  const options = product.options || [];
  const index = options.findIndex((option) => option.name === name);
  const variants = product.variants || [];
  return (
    variants.find((x) => x.available && x[`o${index + 1}`] === value) ||
    variants.find((x) => x[`o${index + 1}`] === value)
  );
}

/** Selects `name=value` and completes the rest of the selection from the variant that owns it. */
function selectOption(ctx, name, value) {
  const product = ctx.PDP.p;
  ctx.PDP.sel[name] = value;
  if (variantForSpecs(product, ctx.PDP.sel)) return;
  const variant = fallbackVariant(product, name, value);
  if (!variant) return;
  (product.options || []).forEach((option, i) => {
    if (variant[`o${i + 1}`]) ctx.PDP.sel[option.name] = variant[`o${i + 1}`];
  });
}

function paintTint(tint, colorHex, isFirstColor) {
  if (!tint) return;
  tint.style.background = colorHex || "transparent";
  tint.style.opacity = isFirstColor ? "0" : ".18";
}

function paintGallery(ctx, name, value, colorHex) {
  if (!/color|colour/i.test(name)) return;
  const main = /** @type {HTMLImageElement} */ (document.getElementById("gallery-main-img"));
  const image = ctx.PDP.p.colorImages?.[value] || ctx.PDP.p.image;
  if (main && image) main.src = image;
  paintTint(document.getElementById("gallery-tint"), colorHex, ctx.PDP.p.colors?.[0]?.name === value);
  document.querySelectorAll("[data-thumb]").forEach((node) => {
    const thumb = /** @type {HTMLElement} */ (node);
    thumb.classList.toggle("active", thumb.dataset.thumb === image);
  });
}

function pickOption(ctx, e, el) {
  if (!ctx.PDP.p) return;
  selectOption(ctx, el.dataset.opt, el.dataset.value);
  const info = document.getElementById("product-info");
  if (info) info.outerHTML = ctx.pdpInfoHTML();
  paintGallery(ctx, el.dataset.opt, el.dataset.value, el.dataset.colorHex);
  ctx.hydrateIcons();
}

function changeQty(ctx, e, el) {
  ctx.PDP.qty = Math.max(1, Math.min(ctx.MAX_QTY, ctx.PDP.qty + Number(el.dataset.qty)));
  const span = document.getElementById("qty-val");
  if (span) span.textContent = ctx.PDP.qty;
}

const DOT_SELECTOR = ".sustain-dots button, .reviews-dots button, .press-dots button";

function dotsTrack(dot) {
  return (
    dot.closest(".sustain")?.querySelector(".sustain-track") ||
    dot.closest(".reviews")?.querySelector(".reviews-track") ||
    dot.closest(".press")?.querySelector(".press-grid")
  );
}

function pickDot(ctx, e, dot) {
  const dots = [...dot.parentElement.children];
  const section = dot.closest("section") || dot.closest(".container");
  const track = dotsTrack(dot);
  if (!track || !section) return;
  const index = dots.indexOf(dot);
  const card = track.firstElementChild;
  const width = card ? card.getBoundingClientRect().width + 12 : track.clientWidth;
  track.scrollTo({ left: (ctx.R.lang === "ar" ? -1 : 1) * index * width, behavior: "smooth" });
  dots.forEach((item, i) => item.classList.toggle("active", i === index));
}

function pickThumb(ctx, e, thumb) {
  const main = /** @type {HTMLImageElement} */ (document.getElementById("gallery-main-img"));
  if (main) main.src = thumb.dataset.thumb;
  const tint = document.getElementById("gallery-tint");
  if (tint) tint.style.opacity = "0";
  document
    .querySelectorAll("[data-thumb]")
    .forEach((node) => /** @type {HTMLElement} */ (node).classList.toggle("active", node === thumb));
}

/** Builds the ordered click table for a storefront context. */
export function buildClickHandlers(ctx) {
  return [
    { match: (e) => pick(e, "[data-account-toggle]"), run: (e) => accountToggle(ctx, e) },
    {
      match: (e) => (pick(e, "[data-account-toggle]") ? null : e.target),
      run: (e) => closeAccountDropdowns(ctx, e),
      passthrough: true
    },
    { match: (e) => pick(e, "[data-customer-logout]"), run: () => customerLogout(ctx) },
    { match: (e) => (e.target?.matches?.("#submit-review") ? e.target : null), run: () => submitReview(ctx) },
    { match: (e) => pick(e, ".rating-input button"), run: (e, el) => pickRating(e, el) },
    { match: (e) => pick(e, "[data-set-lang]"), run: (e, el) => setLang(ctx, e, el) },
    { match: (e) => pick(e, "[data-theme-toggle]"), run: (e) => toggleTheme(ctx, e) },
    { match: (e) => pick(e, "[data-country]"), run: () => showCountry(ctx) },
    { match: (e) => (pick(e, ".lang-switch") ? null : e.target), run: () => closeLangSwitch(), passthrough: true },
    { match: (e) => pick(e, "[data-video]"), run: () => videoSoon(ctx) },
    { match: (e) => pick(e, "[data-cart-inc]"), run: (e, el) => cartIncrement(ctx, e, el) },
    { match: (e) => pick(e, "[data-cart-dec]"), run: (e, el) => cartDecrement(ctx, e, el) },
    { match: (e) => pick(e, "[data-cart-remove]"), run: (e, el) => cartRemove(ctx, e, el) },
    { match: (e) => pick(e, "[data-wish]"), run: (e, el) => toggleWishlist(ctx, e, el) },
    { match: (e) => pick(e, ".swatch"), run: (e, el) => pickSwatch(ctx, e, el) },
    { match: (e) => pick(e, "[data-scroll]"), run: (e, el) => scrollTrack(e, el) },
    { match: (e) => pick(e, "[data-close-search]"), run: () => ctx.closeSearch() },
    { match: (e) => pick(e, "[data-close-cart]"), run: () => ctx.closeCart() },
    { match: (e) => pick(e, "[data-add-cart]"), run: () => addToCartAndOpen(ctx) },
    { match: (e) => pick(e, "[data-buy-now]"), run: () => buyNow(ctx) },
    { match: (e) => pick(e, "[data-opt]"), run: (e, el) => pickOption(ctx, e, el) },
    { match: (e) => pick(e, "[data-qty]"), run: (e, el) => changeQty(ctx, e, el) },
    { match: (e) => pick(e, DOT_SELECTOR), run: (e, el) => pickDot(ctx, e, el) },
    { match: (e) => pick(e, "[data-thumb]"), run: (e, el) => pickThumb(ctx, e, el) }
  ];
}

/** Runs the table for one click. Returns true when an entry consumed the event. */
export function dispatchClick(handlers, event) {
  for (const entry of handlers) {
    const element = entry.match(event);
    if (!element) continue;
    entry.run(event, element);
    if (!entry.passthrough) return true;
  }
  return false;
}

/** @param {StorefrontCtx} ctx */
/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { clickHandlers: buildClickHandlers(ctx), dispatchClick });
}
