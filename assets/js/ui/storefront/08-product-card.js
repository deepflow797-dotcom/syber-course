// @ts-check
/* app.js → Product card
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { cardHTML });
  const CONDITION_LABELS = {
    New: { ar: "جديد", fr: "Neuf" },
    "Like New": { ar: "كالجديد", fr: "Comme neuf" },
    Excellent: { ar: "ممتاز", fr: "Excellent" },
    "Very Good": { ar: "جيد جدًا", fr: "Très bon" },
    Good: { ar: "جيد", fr: "Bon" },
    Fair: { ar: "مقبول", fr: "Correct" }
  };
  const conditionLabel = (value) => CONDITION_LABELS[value]?.[ctx.R.lang] || value || "";

  function cardHTML(p) {
    const badge = p.discount > 0 ? `<span class="badge">-${p.discount}%</span>` : "";
    const colors = (p.colors || []).slice(0, 4);
    const firstColor = p.colors?.[0];
    const initialImage = (firstColor && p.colorImages?.[firstColor.name]) || p.image;
    const swatches = colors
      .map(
        (c, i) =>
          `<button class="swatch${i === 0 ? " selected" : ""} u-tint" type="button" data-sv="bg:${ctx.esc(c.hex)}" data-color="${ctx.esc(c.name)}" data-color-img="${ctx.esc(p.colorImages?.[c.name] || p.image)}" data-color-hex="${ctx.esc(c.hex)}" title="${ctx.esc(c.name)}" aria-label="${ctx.esc(c.name)}"></button>`
      )
      .join("");
    const more = (p.colors || []).length > 4 ? `<span class="swatch-more">+${p.colors.length - 4}</span>` : "";
    const wished = ctx.readWish().has(p.handle) ? " active" : "";
    return `
      <article class="product-card" data-handle="${ctx.esc(p.handle)}">
        <a class="card-media" href="product.html?handle=${encodeURIComponent(p.handle)}" aria-label="${ctx.esc(p.title)}">
          ${badge}<img src="${initialImage}" alt="${ctx.esc(p.title)}" width="300" height="300" loading="lazy" decoding="async" data-card-main>
          <span class="card-tint" data-card-tint aria-hidden="true"></span>
          ${Number(p.stock) <= 0 ? `<span class="sold-out-badge">${ctx.esc(ctx.t("soldOut"))}</span>` : ""}
        </a>
        <button class="wish${wished}" type="button" data-wish="${ctx.esc(p.handle)}" aria-label="${ctx.esc(ctx.t("addToWishlist"))}">${ctx.ICON.heart}</button>
        <a class="card-title" href="product.html?handle=${encodeURIComponent(p.handle)}">${ctx.esc(p.title)}</a>
        <div class="card-meta">
          ${p.battery ? `<span class="card-battery">${ctx.ICON.bolt}${p.battery}%</span>` : ""}
          <span class="card-condition">${ctx.esc(conditionLabel(p.condition))}</span>
        </div>
        <div class="swatches">${swatches}${more}</div>
        <div class="card-price">${ctx.money(p.price)} ${p.compare > p.price ? `<s>${ctx.money(p.compare)}</s>` : ""}</div>
      </article>`;
  }
  Object.assign(ctx, { CONDITION_LABELS, conditionLabel });
}
