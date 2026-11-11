// @ts-check
/* app.js → Product page markup blocks (extracted verbatim from renderProduct)
   Pure template builders: each takes the data it needs and returns an HTML string. No DOM access. */

/**
 * Gallery: main image, colour tint layer and the thumbnail strip.
 * `makeInfo` is the product-info builder, injected so this module stays free of page state.
 * @param {any} ctx @param {any} p @param {string[]} images @param {string} initialImage @param {() => string} makeInfo
 */
export function galleryHTML(ctx, p, images, initialImage, makeInfo) {
  return `
      <div class="gallery">
        <div class="gallery-main">
          <img id="gallery-main-img" src="${initialImage}" alt="${ctx.esc(p.title)}" width="600" height="600" decoding="async">
          <span class="color-tint" id="gallery-tint" aria-hidden="true"></span>
        </div>
        <div class="thumbs">
          ${images.map((src, i) => `<button type="button" class="${src === initialImage ? "active" : ""}" data-thumb="${src}" aria-label="${ctx.esc(p.title)} ${i + 1}"><img src="${src}" alt="" width="150" height="150" loading="lazy" decoding="async"></button>`).join("")}
        </div>
      </div>
      ${makeInfo()}`;
}

/**
 * FAQ + review grid shown under the product.
 * @param {any} ctx @param {any} p @param {any[]} reviews @param {(p: any) => string} productRating
 */
export function productExtraHTML(ctx, p, reviews, productRating) {
  return `<div class="container">
        <section class="product-faq reveal" aria-labelledby="faq-heading">
          <div class="section-head"><h2 id="faq-heading">${ctx.esc(ctx.t("faqs"))}</h2></div>
          <div class="accordion faq-accordion">
            ${(ctx.S.faqs || ctx.SET.faqs || []).map((faq) => `<details><summary>${ctx.esc(ctx.L(faq.q))}</summary><div class="acc-body"><p>${ctx.esc(ctx.L(faq.a))}</p></div></details>`).join("")}
          </div>
        </section>
        <section class="product-reviews reveal" aria-labelledby="product-reviews-heading">
          <div class="reviews-head">
            <h2 id="product-reviews-heading">${ctx.esc(ctx.t("reviews"))} <span class="reviews-count">(${reviews.length})</span></h2>
            <div class="reviews-meta">${[1, 2, 3, 4, 5].map((n) => `<span class="tp-star${n > Math.round(Number(productRating(p))) ? " off" : ""}" data-icon="star"></span>`).join("")} <strong>${productRating(p)}</strong> · ${ctx.esc(ctx.t("verifiedBuyer"))}</div>
          </div>
          <div class="review-grid">
            ${reviews
              .map(
                (review) => `<article class="review-card">
              <span class="review-avatar u-tint" data-sv="bg:${ctx.esc(review.color || "#2e7d6f")}">${ctx.esc((review.name || "R").slice(0, 1))}</span>
              <div class="review-name">${ctx.esc(review.name)} ${review.verified ? `<i>${ctx.esc(ctx.t("verifiedBuyer"))}</i>` : ""}</div>
              ${ctx.starsHTML(Number(review.rating) || 5)}
              <div class="review-title">${ctx.esc(ctx.L(review.title))}</div>
              <p class="review-body">${ctx.esc(ctx.L(review.body))}</p>
            </article>`
              )
              .join("")}
          </div>
        </section>
      </div>`;
}

/**
 * Related products strip.
 * @param {any} ctx @param {any[]} items
 */
export function relatedHTML(ctx, items) {
  return `<div class="container"><section class="related reveal"><h2>${ctx.esc(ctx.t("related"))}</h2><div class="grid">${items.map(ctx.cardHTML).join("")}</div></section></div>`;
}

/** Empty state when the handle does not resolve to a product. */
export function productNotFoundHTML(ctx) {
  return `<div class="empty-state u-span-full">
        <h2>${ctx.esc(ctx.t("productNotFound"))}</h2>
        <p>${ctx.esc(ctx.t("productNotFoundText"))}</p>
        <a class="btn btn-primary" href="collection.html?handle=all">${ctx.esc(ctx.t("browseAll"))}</a>
      </div>`;
}
