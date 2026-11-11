// @ts-check
/* app.js → Cart drawer
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { mountCart, openCart, closeCart, renderCart });
  function mountCart() {
    if (document.getElementById("cart-drawer")) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="overlay" id="cart-overlay"></div>
      <aside class="drawer" id="cart-drawer" aria-label="${ctx.esc(ctx.t("cart"))}" aria-hidden="true">
        <div class="drawer-head">
          <h3>${ctx.esc(ctx.t("cart"))} <span id="cart-title-count"></span></h3>
          <button class="drawer-close" type="button" data-close-cart aria-label="${ctx.esc(ctx.t("close"))}">${ctx.ICON.close}</button>
        </div>
        <div class="drawer-body" id="cart-body"></div>
        <div class="drawer-foot" id="cart-foot"></div>
      </aside>`;
    document.body.appendChild(wrap);
    document.getElementById("cart-overlay").addEventListener("click", closeCart);
    wrap.querySelector("[data-close-cart]").addEventListener("click", closeCart);
  }

  function openCart() {
    mountCart();
    renderCart();
    document.getElementById("cart-overlay").classList.add("open");
    const d = document.getElementById("cart-drawer");
    d.classList.add("open");
    d.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
  }

  function closeCart() {
    document.getElementById("cart-overlay")?.classList.remove("open");
    const d = document.getElementById("cart-drawer");
    if (d) {
      d.classList.remove("open");
      d.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("no-scroll");
  }

  function renderCart() {
    if (!document.getElementById("cart-drawer")) return;
    const items = ctx.cartDetails();
    const body = document.getElementById("cart-body");
    const foot = document.getElementById("cart-foot");
    const count = items.reduce((n, it) => n + it.qty, 0);
    const titleCount = document.getElementById("cart-title-count");
    if (titleCount) titleCount.textContent = count ? `(${count})` : "";
    if (!items.length) {
      body.innerHTML = `<div class="cart-empty">${ctx.ICON.bag}<p>${ctx.esc(ctx.t("emptyCart"))}</p><a class="btn btn-primary u-mt-16" href="collection.html?handle=all">${ctx.esc(ctx.t("shopNow"))}</a></div>`;
      foot.innerHTML = "";
      return;
    }
    body.innerHTML = items
      .map(
        (it) => `
      <div class="cart-item">
        <a class="cart-item-img" href="product.html?handle=${encodeURIComponent(it.handle)}"><img src="${it.product.image}" alt="${ctx.esc(it.product.title)}"></a>
        <div>
          <a class="cart-item-title" href="product.html?handle=${encodeURIComponent(it.handle)}">${ctx.esc(it.product.title)}</a>
          <div class="cart-item-var">${ctx.esc(ctx.variantLabel(it.variant) || "")}</div>
          ${it.specs && Object.keys(it.specs).length ? `<div class="cart-item-specs">${ctx.esc(ctx.specsText(it.specs))}</div>` : ""}
          <div class="qty">
            <button type="button" data-cart-dec="${ctx.esc(it.variant.id)}" data-handle="${ctx.esc(it.handle)}" aria-label="-">−</button>
            <span>${it.qty}</span>
            <button type="button" data-cart-inc="${ctx.esc(it.variant.id)}" data-handle="${ctx.esc(it.handle)}" aria-label="+">+</button>
          </div>
        </div>
        <div class="cart-item-right">
          <div class="cart-item-price">${ctx.money(it.line)}</div>
          <button class="cart-remove" type="button" data-cart-remove="${ctx.esc(it.variant.id)}" data-handle="${ctx.esc(it.handle)}" aria-label="${ctx.esc(ctx.t("close"))}">${ctx.ICON.trash}</button>
        </div>
      </div>`
      )
      .join("");
    foot.innerHTML = `
      <div class="cart-sub"><span>${ctx.esc(ctx.t("subtotal"))}</span><span>${ctx.money(ctx.cartSubtotal())}</span></div>
      <div class="cart-note">${ctx.esc(ctx.t("shippingCalc"))}</div>
      <a class="btn btn-primary btn-block" href="checkout.html">${ctx.esc(ctx.t("checkout"))}</a>`;
  }
}
