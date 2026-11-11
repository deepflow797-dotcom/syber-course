/* app.js → Cart
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

export function install(ctx) {
  Object.assign(ctx, { readCart, writeCart, cartDetails, addToCart, setQty, removeLine });
  function readCart() {
    try {
      const v = JSON.parse(localStorage.getItem(ctx.CART_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  function writeCart(items) {
    localStorage.setItem(ctx.CART_KEY, JSON.stringify(items));
    ctx.syncBadges();
    ctx.renderCart();
  }

  function cartDetails() {
    return readCart()
      .map((it) => {
        const product = ctx.BY_HANDLE.get(it.handle);
        if (!product) return null;
        const variant = product.variants.find((v) => String(v.id) === String(it.variantId)) || product.variants[0];
        return { ...it, product, variant, line: (Number(variant?.price ?? product.price) || 0) * it.qty };
      })
      .filter(Boolean);
  }

  const cartCount = () => readCart().reduce((n, it) => n + (Number(it.qty) || 0), 0);
  const cartSubtotal = () => cartDetails().reduce((n, it) => n + it.line, 0);

  function addToCart(handle, variantId, qty = 1, specs = {}) {
    const product = ctx.BY_HANDLE.get(handle);
    if (!product) return;
    const cleanSpecs = Object.fromEntries(Object.entries(specs || {}).filter(([, v]) => v != null && v !== ""));
    const key = JSON.stringify(cleanSpecs);
    const items = readCart();
    const found = items.find(
      (it) =>
        it.handle === handle && String(it.variantId) === String(variantId) && JSON.stringify(it.specs || {}) === key
    );
    if (found) found.qty = Math.min(ctx.MAX_QTY, found.qty + qty);
    else items.push({ handle, variantId, qty: Math.min(ctx.MAX_QTY, qty), specs: cleanSpecs });
    writeCart(items);
    ctx.toast(ctx.t("addedToCart"));
  }

  function setQty(variantId, handle, qty) {
    const items = readCart();
    const it = items.find((x) => x.handle === handle && String(x.variantId) === String(variantId));
    if (!it) return;
    it.qty = Math.max(0, Math.min(ctx.MAX_QTY, qty));
    writeCart(items.filter((x) => x.qty > 0));
  }

  function removeLine(handle, variantId) {
    writeCart(readCart().filter((x) => !(x.handle === handle && String(x.variantId) === String(variantId))));
  }
  Object.assign(ctx, { cartCount, cartSubtotal });
}
