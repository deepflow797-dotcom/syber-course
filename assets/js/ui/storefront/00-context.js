// @ts-check
/* app.js → prelude
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  if (new URLSearchParams(location.search).get("preview") === "1") ctx.R.useDraft();
  const S = ctx.R.store;
  const SET = S.settings;
  const ALL_PRODUCTS = S.products;
  const PRODUCTS = ALL_PRODUCTS.filter((p) => p.active !== false && (!SET.autoHideOutOfStock || Number(p.stock) > 0));
  const BY_HANDLE = new Map(ALL_PRODUCTS.map((p) => [p.handle, p]));
  const CART_KEY = "restore_cart_v1";
  const WISH_KEY = "restore_wish_v1";
  const MAX_QTY = 10;
  const t = (key, vars) => ctx.R.t(key, vars);
  const L = (value) => ctx.R.L(value);
  Object.assign(ctx, { S, SET, ALL_PRODUCTS, PRODUCTS, BY_HANDLE, CART_KEY, WISH_KEY, MAX_QTY, t, L });
}
