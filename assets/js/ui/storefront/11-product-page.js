/* app.js → Product page
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */
import { createProductsRepo } from "../../data/repositories/products.repo.js";

export function install(ctx) {
  Object.assign(ctx, {
    productSeed,
    productReviews,
    productRating,
    specKeysFor,
    pdpSpecsHTML,
    pdpVariant,
    pdpInfoHTML,
    renderProductReviews,
    renderRatingStars,
    hashColor,
    loadProductByHandle,
    renderProduct
  });
  const PDP = { p: null, sel: {}, qty: 1, specs: {} };

  const OPT_LABELS = {
    color: { ar: "اللون", fr: "Couleur" },
    colour: { ar: "اللون", fr: "Couleur" },
    storage: { ar: "التخزين", fr: "Stockage" },
    "storage/ram": { ar: "التخزين / الذاكرة", fr: "Stockage / RAM" },
    condition: { ar: "الحالة", fr: "État" },
    ram: { ar: "الذاكرة", fr: "RAM" },
    cpu: { ar: "المعالج", fr: "Processeur" },
    connectivity: { ar: "الاتصال", fr: "Connectivité" },
    "strap color": { ar: "لون السوار", fr: "Couleur du bracelet" }
  };
  const optLabel = (name) => OPT_LABELS[String(name).toLowerCase()]?.[ctx.R.lang] || name;
  const optValue = (name, value) => (/condition|état/i.test(name) ? ctx.conditionLabel(value) : value);

  function productSeed(p) {
    let h = 0;
    for (let i = 0; i < p.handle.length; i++) h = (h * 31 + p.handle.charCodeAt(i)) >>> 0;
    return h;
  }

  function productReviews(p) {
    const moderated = ctx.R.getProductReviews(p.handle).map((review) => ({
      ...review,
      handle: p.handle,
      name: review.customerName,
      date: review.createdAt
    }));
    const specific = (ctx.S.reviews || []).filter(
      (r) => (r.handle === p.handle || r.productHandle === p.handle) && r.approved !== false
    );
    if (moderated.length || specific.length) {
      const seen = new Set();
      return [...moderated, ...specific].filter((review) => {
        const key = review.id || `${review.name}:${ctx.L(review.title)}:${review.date}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    const seed = productSeed(p);
    const names = [
      ["أحمد ولد محمد", "Ahmed Ould Mohamed"],
      ["مريم بنت أحمد", "Mariem Mint Ahmed"],
      ["الشيخ ولد سيدي", "Cheikh Ould Sidi"],
      ["فاطمة بنت عبد الله", "Fatimetou Mint Abdallah"]
    ];
    const titles = [
      { ar: "جهاز مطابق للوصف", fr: "Conforme à la description" },
      { ar: "تغليف جيد وتوصيل سريع", fr: "Bien emballé et livraison rapide" },
      { ar: "قيمة ممتازة", fr: "Excellent rapport qualité-prix" }
    ];
    const bodies = [
      {
        ar: "وصل الجهاز بحالة ممتازة، البطارية جيدة والاتصال ممتاز. خدمة واتساب كانت سريعة.",
        fr: "L’appareil est arrivé en excellent état, batterie correcte et connectivité parfaite. Le service WhatsApp a été rapide."
      },
      {
        ar: "طلبت يوم الأحد ووصلني في نواكشوط يوم الاثنين. كل شيء يعمل كما هو مذكور.",
        fr: "Commandé dimanche, livré lundi à Nouakchott. Tout fonctionne comme annoncé."
      },
      {
        ar: "السعر أقل من الجديد والضمان أعطاني ثقة. أنصح به لمن يبحث عن جهاز موثوق.",
        fr: "Le prix est bien inférieur au neuf et la garantie inspire confiance. Je recommande."
      }
    ];
    return [0, 1, 2].map((i) => ({
      id: `${p.handle}-review-${i}`,
      handle: p.handle,
      name: ctx.R.lang === "ar" ? names[(seed + i) % names.length][0] : names[(seed + i) % names.length][1],
      rating: 4 + ((seed + i) % 2),
      title: titles[(seed + i) % titles.length],
      body: bodies[(seed + i) % bodies.length],
      verified: true,
      date: "2026-09-18"
    }));
  }

  function productRating(p) {
    const reviews = productReviews(p);
    return (reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / Math.max(1, reviews.length)).toFixed(1);
  }

  function specKeysFor(p) {
    if (p.type === "Macbook" || p.type === "Laptop")
      return ["cpu", "ram", "storage", "screen", "keyboard", "condition"];
    if (p.type === "Smartphone") return ["storage", "screen", "condition", "battery"];
    if (p.type === "Tablets") return ["storage", "screen", "condition", "battery"];
    if (p.type === "Apple Watch") return ["screen", "condition", "battery"];
    if (p.type === "Playstation") return ["storage", "condition"];
    return ["condition", "battery"];
  }

  function pdpSpecsHTML(p) {
    const specs = p.specs || {};
    const keys = specKeysFor(p).filter((key) => specs[key]);
    if (!keys.length) return "";
    return `<div class="specs-section">
      <div class="specs-head"><span>${ctx.esc(ctx.t("personalization"))}</span><small>${ctx.esc(ctx.t("chooseSpecs"))}</small></div>
      <div class="specs-grid">
        ${keys
          .map((key) => {
            const spec = specs[key];
            const value = PDP.specs[key] ?? spec.value;
            const choices = [...new Set((spec.choices || []).filter(Boolean))];
            const isBattery = key === "battery";
            if (!choices.length || isBattery) {
              return `<div class="spec-field static"><span>${ctx.esc(ctx.L(spec.label))}</span><strong dir="auto">${ctx.esc(value)}</strong>${isBattery ? `<em class="battery-pill">${ctx.ICON.bolt}${p.battery ? `${p.battery}%` : value}</em>` : ""}</div>`;
            }
            return `<div class="spec-field"><label>${ctx.esc(ctx.L(spec.label))}</label>
            <select dir="ltr" data-spec="${ctx.esc(key)}">${choices.map((choice) => `<option value="${ctx.esc(choice)}" ${String(choice) === String(value) ? "selected" : ""}>${ctx.esc(choice)}</option>`).join("")}</select>
          </div>`;
          })
          .join("")}
      </div>
    </div>`;
  }

  function pdpVariant() {
    const p = PDP.p;
    if (!p) return null;
    const keys = (p.options || []).map((o) => o.name);
    let v = (p.variants || []).find((x) => keys.every((k, i) => x["o" + (i + 1)] === PDP.sel[k]));
    if (!v) v = (p.variants || []).find((x) => x.available) || p.variants?.[0];
    return v;
  }

  function pdpInfoHTML() {
    const p = PDP.p;
    const v = pdpVariant();
    const price = Number(v?.price ?? p.price);
    const compare = v?.compare ?? p.compare;
    const disc = ctx.discountFor(price, compare);
    const rating = productRating(p);
    const reviewsCount = productReviews(p).length;
    const conditionOption = p.options?.find((o) => /condition|état/i.test(o.name));
    const currentCondition = ctx.conditionLabel(
      conditionOption?.values?.find((value) => value === PDP.sel[conditionOption.name]) || p.condition
    );
    const options = (p.options || [])
      .map((o) => {
        if (!o.values.length) return "";
        const isColor = /color|colour/i.test(o.name);
        const buttons = o.values
          .map((val) => {
            const active = PDP.sel[o.name] === val;
            if (isColor) {
              const c = (p.colors || []).find((x) => x.name === val);
              return `<button class="opt-btn color-opt ${active ? "active" : ""}" type="button" data-opt="${ctx.esc(o.name)}" data-value="${ctx.esc(val)}" data-color-hex="${ctx.esc(c?.hex || "")}"><span class="color-dot" style="background:${c ? c.hex : "#ccc"}"></span>${ctx.esc(val)}</button>`;
            }
            return `<button class="opt-btn ${active ? "active" : ""}" type="button" dir="auto" data-opt="${ctx.esc(o.name)}" data-value="${ctx.esc(val)}">${ctx.esc(optValue(o.name, val))}</button>`;
          })
          .join("");
        return `<div class="opt-label">${ctx.esc(optLabel(o.name))} <span dir="auto">${ctx.esc(optValue(o.name, PDP.sel[o.name] || ""))}</span></div><div class="opt-values">${buttons}</div>`;
      })
      .join("");

    const soldOut = Number(p.stock) <= 0 || !p.available || !v?.available;
    const whatsappText = `${ctx.R.lang === "ar" ? "مرحباً" : "Bonjour"} ${ctx.L(ctx.SET.storeName)}، ${ctx.R.lang === "ar" ? "أريد الاستفسار عن" : "je voudrais des informations sur"} ${p.title}${v?.title ? ` (${v.title})` : ""}.`;
    return `
      <div class="product-info" id="product-info">
        <div class="vendor">${ctx.esc(p.vendor || ctx.L(ctx.SET.storeName))}</div>
        <h1>${ctx.esc(p.title)}</h1>
        <div class="rating">${[1, 2, 3, 4, 5].map((n) => `<span class="tp-star${n > Math.round(Number(rating)) ? " off" : ""}" data-icon="star"></span>`).join("")}<span>${rating} · ${reviewsCount} ${ctx.esc(ctx.t("reviews"))}</span></div>
        <div class="product-badges">
          ${p.battery ? `<span class="product-badge battery">${ctx.ICON.bolt} ${ctx.esc(ctx.t("battery"))} ${p.battery}%</span>` : ""}
          <span class="product-badge">${ctx.esc(currentCondition)}</span>
          ${p.type === "Macbook" ? `<span class="product-badge">${ctx.ICON.apple} ${ctx.esc(ctx.t("macos"))}</span>` : ""}
        </div>
        <div class="price-row">
          <span class="price-now">${ctx.money(price)}</span>
          ${compare && compare > price ? `<span class="price-was">${ctx.money(compare)}</span><span class="price-badge">-${disc}%</span>` : ""}
        </div>
        <div class="payment-offer-line">${ctx.ICON.bolt}<span>${ctx.esc(ctx.L(ctx.SET.paymentOffer))}</span></div>
        ${options}
        ${pdpSpecsHTML(p)}
        <div class="opt-label">${ctx.esc(ctx.t("quantity"))}</div>
        <div class="qty">
          <button type="button" data-qty="-1" aria-label="-">−</button>
          <span id="qty-val">${PDP.qty}</span>
          <button type="button" data-qty="1" aria-label="+">+</button>
        </div>
        <div class="product-actions">
          <button class="btn btn-primary" type="button" data-add-cart ${soldOut ? "disabled" : ""}>${soldOut ? ctx.esc(ctx.t("soldOut")) : ctx.esc(ctx.t("addToCart"))}</button>
          <button class="btn btn-dark" type="button" data-buy-now ${soldOut ? "disabled" : ""}>${ctx.esc(ctx.t("buyNow"))}</button>
        </div>
        <a class="whatsapp-order" href="https://wa.me/${ctx.esc(ctx.SET.whatsapp)}?text=${encodeURIComponent(whatsappText)}" target="_blank" rel="noopener">${ctx.ICON.whatsapp} ${ctx.esc(ctx.t("orderWhatsApp"))}</a>
        <div class="trust-mini">
          <div>${ctx.ICON.truck}<span>${ctx.esc(ctx.t("freeDelivery"))}<small>${ctx.esc(ctx.t("freeDeliverySub"))}</small></span></div>
          <div>${ctx.ICON.shield}<span>${ctx.esc(ctx.t("warranty"))}<small>${ctx.esc(ctx.t("warrantySub"))}</small></span></div>
          <div>${ctx.ICON.return}<span>${ctx.esc(ctx.t("returns"))}<small>${ctx.esc(ctx.t("returnsSub"))}</small></span></div>
          ${p.type === "Macbook" ? `<div>${ctx.ICON.badgeCheck}<span>${ctx.esc(ctx.t("macos"))}<small>${ctx.esc(ctx.t("checkedSub"))}</small></span></div>` : `<div>${ctx.ICON.badgeCheck}<span>${ctx.esc(ctx.t("checked"))}<small>${ctx.esc(ctx.t("checkedSub"))}</small></span></div>`}
        </div>
        <div class="included-card">
          <h3>${ctx.esc(ctx.t("whatsIncluded"))}</h3>
          <ul>${(p.includes || []).map((item) => `<li>${ctx.ICON.check}<span>${ctx.esc(ctx.L(item))}</span></li>`).join("")}</ul>
        </div>
        <div class="accordion">
          <details open><summary>${ctx.esc(ctx.t("description"))}</summary><div class="acc-body"><p>${ctx.esc(ctx.L(p.description))}</p><p class="muted">${ctx.esc(ctx.L(ctx.SET.originalDevice))} · ${ctx.esc(ctx.t("warrantyMonths", { months: p.warrantyMonths || 12 }))}</p></div></details>
          <details><summary>${ctx.esc(ctx.t("shippingDelivery"))}</summary><div class="acc-body"><p>${ctx.esc(ctx.L(ctx.SET.shippingNote))}</p><p>${ctx.esc(ctx.R.lang === "ar" ? "نواكشوط: توصيل مجاني · باقي المدن: رسوم حسب الولاية." : "Nouakchott : livraison offerte · Autres villes : frais selon la wilaya.")}</p></div></details>
          <details><summary>${ctx.esc(ctx.t("warrantyReturns"))}</summary><div class="acc-body"><p>${ctx.esc(ctx.R.lang === "ar" ? "ضمان 12 شهرًا يغطي الأعطال التقنية، وإرجاع خلال 10 أيام في حال وجود مشكلة." : "Garantie 12 mois couvrant les pannes techniques et retour sous 10 jours en cas de problème.")}</p></div></details>
        </div>
      </div>
      ${renderProductReviews(p)}`;
  }

  function renderProductReviews(product) {
    const reviews = ctx.R.getProductReviews(product.handle);
    const cust = ctx.R.getCustomer();
    const pending = cust
      ? ctx.R.customerReviews().filter((r) => r.productHandle === product.handle && r.status === "pending")
      : [];
    const canReview = Boolean(cust) && !pending.length;
    const average = reviews.length ? reviews.reduce((sum, r) => sum + Number(r.rating || 5), 0) / reviews.length : 0;
    return `
      <section class="product-reviews reveal" aria-labelledby="reviews-heading">
        <div class="container">
          <div class="reviews-head">
            <h2 id="reviews-heading">${ctx.esc(ctx.t("reviews"))} <span class="reviews-count">(${reviews.length})</span></h2>
            ${reviews.length ? `<div class="reviews-summary">${renderRatingStars(average)} <span>${average.toFixed(1)} / 5 · ${reviews.length} ${ctx.esc(ctx.t("reviews"))}</span></div>` : ""}
          </div>
          ${pending.length ? `<div class="review-pending-note">${ctx.ICON.shield} ${ctx.esc(ctx.t("reviewPending"))}</div>` : ""}
          <div class="reviews-list">
            ${
              reviews.length
                ? reviews
                    .map(
                      (r) => `
              <article class="review-card">
                <div class="review-header">
                  <span class="review-avatar" style="background:${hashColor(String(r.customerName || "R"))}">${ctx.esc(String(r.customerName || "R").slice(0, 1))}</span>
                  <div>
                    <strong>${ctx.esc(r.customerName || "")}${r.verified ? ` <span class="verified-badge">${ctx.esc(ctx.t("verifiedBuyer"))}</span>` : ""}</strong>
                    <div class="review-meta">${renderRatingStars(Number(r.rating) || 5)} <time>${ctx.esc(ctx.R.formatDate(r.createdAt))}</time></div>
                  </div>
                </div>
                <h4>${ctx.esc(ctx.L(r.title))}</h4>
                <p>${ctx.esc(ctx.L(r.body))}</p>
              </article>`
                    )
                    .join("")
                : `<p class="muted">${ctx.esc(ctx.t("noReviews"))}</p>`
            }
          </div>
          ${
            canReview
              ? `
            <div class="review-form" id="review-form">
              <h3>${ctx.esc(ctx.t("writeReview"))}</h3>
              <div class="form-grid">
                <div class="field"><label>${ctx.esc(ctx.t("rating"))}</label>
                  <div class="rating-input" data-rating="0">
                    ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="${n} / 5">${ctx.ICON.star}</button>`).join("")}
                  </div>
                </div>
                <div class="field"><label>${ctx.esc(ctx.t("title"))}</label><input type="text" id="review-title" placeholder="${ctx.esc(ctx.t("reviewTitlePlaceholder"))}"></div>
                <div class="field span-2"><label>${ctx.esc(ctx.t("comment"))}</label><textarea id="review-body" rows="3" placeholder="${ctx.esc(ctx.t("reviewBodyPlaceholder"))}"></textarea></div>
                <div class="field span-2"><button class="btn btn-primary" type="button" id="submit-review">${ctx.esc(ctx.t("submitReview"))}</button></div>
              </div>
            </div>`
              : cust
                ? ""
                : `
            <p class="review-login-prompt"><a href="account.html">${ctx.esc(ctx.t("loginToReview"))}</a></p>`
          }
        </div>
      </section>`;
  }

  function renderRatingStars(rating) {
    const full = Math.round(rating);
    return [1, 2, 3, 4, 5]
      .map((n) => `<span class="tp-star${n > full ? " off" : ""}" data-icon="star"></span>`)
      .join("");
  }

  function hashColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 45%)`;
  }

  async function loadProductByHandle(handle) {
    const local = handle ? ctx.BY_HANDLE.get(handle) : null;
    if (!ctx.R.remote || !ctx.R.config?.supabaseUrl) return local;
    try {
      const repo = createProductsRepo(ctx.R.config);
      const row = await repo.getByHandle(handle);
      if (!row) return local;
      const variants = Array.isArray(row.restore_product_variants)
        ? row.restore_product_variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            color: v.color,
            storage: v.storage,
            price: Math.max(0, Number(row.price || 0) + Number(v.price_delta || 0)),
            stock: Number(v.stock || 0),
            available: Number(v.stock || 0) > 0
          }))
        : local?.variants || [];
      return Object.assign({}, local || {}, {
        handle: row.handle,
        title: row.title || local?.title,
        brand: row.brand || local?.brand,
        price: Number(row.price ?? local?.price ?? 0),
        compareAt: row.compare_at ?? local?.compareAt,
        stock: Number(row.stock ?? local?.stock ?? 0),
        condition: row.condition || local?.condition,
        specs: row.specs && Object.keys(row.specs).length ? row.specs : local?.specs || {},
        images: Array.isArray(row.images) && row.images.length ? row.images : local?.images || [],
        image: (Array.isArray(row.images) && row.images[0]) || local?.image,
        variants,
        options: local?.options || [],
        collections: local?.collections || [],
        description: local?.description || row.title,
        active: row.active !== false,
        _source: "restore_products"
      });
    } catch (e) {
      console.warn("restore_products repo fallback", e);
      return local;
    }
  }

  async function renderProduct() {
    const handle = new URLSearchParams(location.search).get("handle");
    const p = handle ? await loadProductByHandle(handle) : null;
    if (!p) {
      document.title = `${ctx.t("productNotFound")} | ${ctx.L(ctx.SET.storeName)}`;
      const crumb = document.getElementById("prod-crumb");
      if (crumb)
        crumb.innerHTML = `<a href="index.html">${ctx.esc(ctx.t("homeCrumb"))}</a><span>/</span><span>${ctx.esc(ctx.t("productNotFound"))}</span>`;
      const root = document.getElementById("product-root");
      if (root)
        root.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <h2>${ctx.esc(ctx.t("productNotFound"))}</h2>
        <p>${ctx.esc(ctx.t("productNotFoundText"))}</p>
        <a class="btn btn-primary" href="collection.html?handle=all">${ctx.esc(ctx.t("browseAll"))}</a>
      </div>`;
      ["product-extra", "product-related"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = "";
      });
      return;
    }
    PDP.p = p;
    PDP.qty = 1;
    PDP.sel = {};
    PDP.specs = {};
    Object.entries(p.specs || {}).forEach(([key, spec]) => {
      PDP.specs[key] = spec.value;
    });
    (p.options || []).forEach((o) => {
      if (o.values.length) PDP.sel[o.name] = o.values[0];
    });
    const v = pdpVariant();
    if (v)
      (p.options || []).forEach((o, i) => {
        if (v["o" + (i + 1)]) PDP.sel[o.name] = v["o" + (i + 1)];
      });

    ctx.applyProductSeo(p);
    const col = ctx.S.collections.find((c) => (p.collections || []).includes(c.handle));
    const crumb = document.getElementById("prod-crumb");
    if (crumb) {
      crumb.innerHTML = `<a href="index.html">${ctx.esc(ctx.t("homeCrumb"))}</a><span>/</span><a href="collection.html?handle=${encodeURIComponent(p.collections?.[0] || "all")}">${ctx.esc(col ? ctx.L(col.title) : ctx.t("shop"))}</a><span>/</span><span>${ctx.esc(p.title)}</span>`;
    }

    const images = [...new Set([p.image, ...(p.images || []), ...Object.values(p.colorImages || {})].filter(Boolean))];
    const initialImage = p.colorImages?.[p.colors?.[0]?.name] || images[0];
    const root = document.getElementById("product-root");
    root.innerHTML = `
      <div class="gallery">
        <div class="gallery-main">
          <img id="gallery-main-img" src="${initialImage}" alt="${ctx.esc(p.title)}">
          <span class="color-tint" id="gallery-tint" aria-hidden="true"></span>
        </div>
        <div class="thumbs">
          ${images.map((src, i) => `<button type="button" class="${src === initialImage ? "active" : ""}" data-thumb="${src}" aria-label="${ctx.esc(p.title)} ${i + 1}"><img src="${src}" alt="" loading="lazy"></button>`).join("")}
        </div>
      </div>
      ${pdpInfoHTML()}`;

    const reviews = productReviews(p);
    const extra = document.getElementById("product-extra");
    if (extra) {
      extra.innerHTML = `<div class="container">
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
              <span class="review-avatar" style="background:${ctx.esc(review.color || "#2e7d6f")}">${ctx.esc((review.name || "R").slice(0, 1))}</span>
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

    const related = document.getElementById("product-related");
    if (related) {
      const pool = ctx.PRODUCTS.filter(
        (x) => x.handle !== p.handle && (x.collections || []).some((c) => (p.collections || []).includes(c))
      );
      const items = (pool.length ? pool : ctx.PRODUCTS.filter((x) => x.handle !== p.handle)).slice(0, 5);
      related.innerHTML = `<div class="container"><section class="related reveal"><h2>${ctx.esc(ctx.t("related"))}</h2><div class="grid">${items.map(ctx.cardHTML).join("")}</div></section></div>`;
    }
    ctx.hydrateIcons(root);
    ctx.hydrateIcons(extra);
    ctx.hydrateIcons(related);
    ctx.observeReveals();
  }
  Object.assign(ctx, { PDP, OPT_LABELS, optLabel, optValue });
}
