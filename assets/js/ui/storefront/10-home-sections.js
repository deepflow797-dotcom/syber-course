// @ts-check
/* app.js → Home sections
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, {
    heroHTML,
    trustBarHTML,
    renewedHTML,
    categoriesHTML,
    offerHTML,
    productSectionHTML,
    productSectionsHTML,
    sustainHTML,
    serviceHTML,
    videoHTML,
    starsHTML,
    reviewsHTML,
    pressHTML,
    renderCollection,
    drawCollectionGrid,
    bindCollectionOnce
  });
  function heroHTML() {
    const slides = (ctx.SET.heroSlides || []).filter((s) => s.visible !== false);
    if (!slides.length) return "";
    return `<section class="hero" id="hero" aria-label="${ctx.esc(ctx.L(ctx.SET.tagline))}">
      ${slides
        .map((slide, i) => {
          const image = slide.image || "assets/products/smartphone-pro-128.svg";
          const light = slide.dark === false;
          return `<div class="hero-slide hero-banner ${light ? "hero-light" : "hero-dark"}${i === 0 ? " active" : ""}" style="background:${ctx.esc(slide.bg || "linear-gradient(135deg,#1f1f2e,#39255b)")}">
          <div class="container hero-inner">
            <div class="hero-copy">
              <span class="hero-eyebrow">${ctx.esc(ctx.L(ctx.SET.storeName))} · ${ctx.esc(ctx.L(ctx.SET.city))}</span>
              <h1>${ctx.esc(ctx.L(slide.title))}</h1>
              <p>${ctx.esc(ctx.L(slide.subtitle))}</p>
              <a class="btn ${light ? "btn-dark" : "btn-primary"}" href="${ctx.esc(ctx.R.safeHref(slide.href || "collection.html?handle=all"))}">${ctx.esc(ctx.L(slide.cta) || ctx.t("shopNow"))} ${ctx.ICON.arrowRight}</a>
              <div class="hero-pills">
                <span>${ctx.ICON.shield} ${ctx.esc(ctx.t("warranty"))}</span>
                <span>${ctx.ICON.truck} ${ctx.esc(ctx.t("freeDelivery"))}</span>
                <span>${ctx.ICON.badgeCheck} ${ctx.esc(ctx.t("checked"))}</span>
              </div>
            </div>
            <div class="hero-visual">
              <div class="hero-glow"></div>
              <img src="${ctx.esc(image)}" alt="${ctx.esc(ctx.L(slide.title))}" loading="${i === 0 ? "eager" : "lazy"}">
            </div>
          </div>
        </div>`;
        })
        .join("")}
      ${
        slides.length > 1
          ? `<button class="hero-arrow prev" type="button" aria-label="Previous">${ctx.ICON.chevronLeft}</button>
        <button class="hero-arrow next" type="button" aria-label="Next">${ctx.ICON.chevronRight}</button>
        <div class="hero-dots">${slides.map((_, i) => `<button type="button" class="${i === 0 ? "active" : ""}" aria-label="Slide ${i + 1}"></button>`).join("")}</div>`
          : ""
      }
    </section>`;
  }

  function trustBarHTML() {
    return `<div class="trust-bar home-trust reveal">
      <div class="container trust-inner">
        <ul class="trust-list">
          ${(ctx.SET.trustBar || []).map((item) => `<li><span class="trust-ico" data-icon="${ctx.esc(item.icon)}"></span>${ctx.esc(ctx.L(item.label))}</li>`).join("")}
        </ul>
        <a class="bnpl" href="checkout.html">${ctx.ICON.bolt} ${ctx.esc(ctx.L(ctx.SET.paymentOffer))}</a>
      </div>
    </div>`;
  }

  function renewedHTML() {
    return `<a class="renewed reveal" href="page.html?slug=renewed">
      <span class="info">i</span>
      ${ctx.esc(ctx.L(ctx.SET.renewalText))}
      <span data-icon="chevronRight" aria-hidden="true"></span>
    </a>`;
  }

  function categoriesHTML() {
    return `<section class="categories reveal" aria-labelledby="cat-heading">
      <div class="container">
        <h2 id="cat-heading">${ctx.esc(ctx.L(ctx.SET.categoriesTitle))}</h2>
        <div class="cat-wrap">
          <div class="cat-track" id="cat-track">
            ${(ctx.S.theme?.categories || [])
              .map(
                (c) => `
              <a class="cat-card" href="collection.html?handle=${encodeURIComponent(c.handle)}">
                <img src="${c.image}" alt="${ctx.esc(ctx.L(c.label))}" loading="lazy"><span>${ctx.esc(ctx.L(c.label))}</span>
              </a>`
              )
              .join("")}
          </div>
          <button class="cat-arrow" type="button" aria-label="${ctx.esc(ctx.t("seeAll"))}"><span data-icon="chevronRight"></span></button>
        </div>
      </div>
    </section>`;
  }

  function offerHTML() {
    const offer = (ctx.SET.offers || []).find((o) => o.active !== false);
    if (!offer) return "";
    const ends = offer.endsAt ? Date.parse(offer.endsAt) : 0;
    return `<section class="offer-banner reveal">
      <div class="container">
        <div class="offer-card">
          <div class="offer-copy">
            <span class="offer-tag">${ctx.ICON.bolt} ${ctx.esc(ctx.t("paymentOfferShort"))}</span>
            <h2>${ctx.esc(ctx.L(offer.title))}</h2>
            <p>${ctx.esc(ctx.L(offer.subtitle))}</p>
            ${ends ? `<div class="countdown" data-countdown="${ctx.esc(offer.endsAt)}"></div>` : ""}
          </div>
          <div class="offer-side">
            <div class="offer-code"><small>${ctx.R.lang === "ar" ? "استخدم الكود" : "Code"}</small><strong>${ctx.esc(offer.code || "BANKILY10")}</strong></div>
            <a class="btn btn-primary" href="${ctx.esc(ctx.R.safeHref(offer.href || "collection.html?handle=all"))}">${ctx.esc(ctx.t("shopNow"))} ${ctx.ICON.arrowRight}</a>
          </div>
        </div>
      </div>
    </section>`;
  }

  function productSectionHTML(section) {
    let items = (section.handles || []).map((h) => ctx.BY_HANDLE.get(h)).filter((p) => p && ctx.PRODUCTS.includes(p));
    if (!items.length) {
      items = ctx.PRODUCTS.filter((p) => (p.collections || []).includes(section.collection)).slice(0, 10);
    }
    if (!items.length) return "";
    const cards = items.slice(0, 12).map(ctx.cardHTML).join("");
    const head = `
      <div class="section-head">
        <h2>${ctx.esc(ctx.L(section.title))}${section.flame ? '<span class="flame" data-icon="flame" aria-hidden="true"></span>' : ""}</h2>
        <a class="see-all" href="collection.html?handle=${encodeURIComponent(section.collection || "all")}">${ctx.esc(ctx.t("seeAll"))}</a>
      </div>`;
    if (section.layout === "plain") {
      return `<section class="product-section reveal"><div class="container">${head}
        <div class="carousel-wrap">
          <div class="track-clip"><div class="track">${cards}</div></div>
          <button class="carousel-arrow next" type="button" data-scroll="next" aria-label="${ctx.esc(ctx.t("seeAll"))}">${ctx.ICON.chevronRight}</button>
        </div></div></section>`;
    }
    const promo = section.promo
      ? `<a class="promo" href="collection.html?handle=${encodeURIComponent(section.collection || "all")}"><img src="${ctx.esc(section.promo)}" alt="${ctx.esc(ctx.L(section.title))}" loading="lazy"></a>`
      : "";
    const panel = `<div class="carousel-wrap"><div class="carousel-panel"><div class="track">${cards}</div></div>
      <button class="carousel-arrow next" type="button" data-scroll="next" aria-label="${ctx.esc(ctx.t("seeAll"))}">${ctx.ICON.chevronRight}</button></div>`;
    return `<section class="product-section reveal"><div class="container">${head}
      <div class="blocks with-${section.layout || "left"}">${section.layout === "right" ? panel + promo : promo + panel}</div></div></section>`;
  }

  function productSectionsHTML() {
    return (ctx.SET.homeSections || [])
      .filter((s) => s.visible !== false)
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .map(productSectionHTML)
      .join("");
  }

  const SUSTAIN_CARDS = [
    {
      id: "green",
      icon: "recycle",
      title: { ar: "تقنية تدوم أطول", fr: "Une tech qui dure plus longtemps" },
      text: {
        ar: "كل جهاز مجدد يقلل النفايات الإلكترونية ويؤخر الحاجة إلى جهاز جديد.",
        fr: "Chaque appareil reconditionné réduit les déchets électroniques et repousse l’achat d’un appareil neuf."
      }
    },
    {
      id: "orange",
      icon: "leaf",
      title: { ar: "أثر بيئي أقل", fr: "Moins d’impact environnemental" },
      text: {
        ar: "نستخدم تغليفًا بسيطًا ونقلل الموارد المستهلكة في كل عملية تجديد.",
        fr: "Nous utilisons un emballage simple et réduisons les ressources consommées à chaque reconditionnement."
      }
    },
    {
      id: "purple",
      icon: "shield",
      title: { ar: "قيمة حقيقية", fr: "Une vraie valeur" },
      text: {
        ar: "أجهزة موثوقة بأسعار عادلة، مع ضمان واضح ودعم محلي في موريتانيا.",
        fr: "Des appareils fiables à prix juste, avec une garantie claire et un support local en Mauritanie."
      }
    }
  ];
  function sustainHTML() {
    return `<section class="sustain reveal" aria-label="${ctx.R.lang === "ar" ? "الاستدامة" : "Durabilité"}">
      <div class="container">
        <div class="sustain-track">
          ${SUSTAIN_CARDS.map(
            (card) => `<article class="sustain-card sustain-${card.id}">
            <span class="sustain-ico" data-icon="${card.icon}"></span>
            <h3>${ctx.esc(ctx.L(card.title))}</h3>
            <p>${ctx.esc(ctx.L(card.text))}</p>
          </article>`
          ).join("")}
        </div>
        <div class="sustain-dots" aria-hidden="true">
          ${SUSTAIN_CARDS.map((_, i) => `<button class="${i === 0 ? "active" : ""}" type="button"></button>`).join("")}
        </div>
      </div>
    </section>`;
  }

  function serviceHTML() {
    const items = ctx.SET.serviceItems || [];
    const feature = (item) => `<div class="feature">
      <span class="ico" data-icon="${ctx.esc(item.icon)}" aria-hidden="true"></span>
      <h3>${ctx.esc(ctx.L(item.title))}</h3>
      <p>${ctx.esc(ctx.L(item.text))}</p>
    </div>`;
    return `<div class="container">
      <section class="service reveal" aria-labelledby="service-heading">
        <h2 id="service-heading">${ctx.esc(ctx.L(ctx.SET.serviceTitle))}</h2>
        <div class="service-grid">
          <div>${items.slice(0, 2).map(feature).join("")}</div>
          <img class="service-img" src="assets/img/service-phones.svg" alt="${ctx.esc(ctx.L(ctx.SET.storeName))}" loading="lazy">
          <div>${items.slice(2, 4).map(feature).join("")}</div>
        </div>
      </section>
    </div>`;
  }

  function videoHTML() {
    const socials = (ctx.SET.social || [])
      .map(
        (s) =>
          `<a href="${ctx.esc(ctx.R.safeHref(s.href, ""))}" target="_blank" rel="noopener" aria-label="${ctx.esc(s.id)}">${ctx.ICON[s.icon] || ctx.ICON.instagram}</a>`
      )
      .join("");
    const images = [
      "assets/img/restore/video-1.svg",
      "assets/img/restore/video-2.svg",
      "assets/img/restore/video-3.svg",
      "assets/img/restore/video-4.svg",
      "assets/img/restore/video-5.svg"
    ];
    return `<section class="video-section reveal" aria-labelledby="video-heading">
      <div class="container">
        <h2 id="video-heading">${ctx.esc(ctx.L(ctx.SET.trustTitle))}</h2>
        <div class="video-panel">
          <div class="community">
            <h3>${ctx.esc(ctx.L(ctx.SET.communityTitle))}</h3>
            <div class="socials">${socials}</div>
          </div>
          ${images
            .map(
              (
                src
              ) => `<a class="video-card" href="#" data-video aria-label="${ctx.R.lang === "ar" ? "قصة عميل" : "Témoignage client"}">
            <img src="${src}" alt="" loading="lazy"><span class="play" data-icon="play" aria-hidden="true"></span>
          </a>`
            )
            .join("")}
          <button class="carousel-arrow" type="button" data-scroll="next" aria-label="${ctx.esc(ctx.t("seeAll"))}"><span data-icon="chevronRight"></span></button>
        </div>
      </div>
    </section>`;
  }

  function starsHTML(rating, className = "review-stars") {
    return `<div class="${className}" aria-label="${rating} / 5">${[1, 2, 3, 4, 5].map((n) => `<span class="tp-star${n > rating ? " off" : ""}" data-icon="star"></span>`).join("")}</div>`;
  }

  function reviewsHTML() {
    const reviews = ctx.S.homeReviews || [];
    return `<section class="reviews reveal" aria-labelledby="reviews-heading">
      <div class="container">
        <div class="reviews-head">
          <h2 id="reviews-heading">${ctx.esc(ctx.L(ctx.SET.reviewsTitle))}</h2>
          <div class="reviews-meta">
            <span>${ctx.esc(ctx.L(ctx.SET.trustTitle))}</span>
            <span class="sep">|</span>
            <span>${ctx.esc(ctx.t("excellent"))}</span>
            <span class="tp-stars" aria-label="5 / 5">${[1, 2, 3, 4, 5].map(() => `<span class="tp-star" data-icon="star"></span>`).join("")}</span>
            <span class="tp-logo"><span class="mark" data-icon="star"></span>${ctx.esc(ctx.L(ctx.SET.storeName))}</span>
          </div>
        </div>
        <div class="reviews-track">
          ${reviews
            .map(
              (review) => `<article class="review-card">
            <span class="review-avatar" style="background:${ctx.esc(review.color || "#2e7d6f")}">${ctx.esc((review.name || "R").slice(0, 1))}</span>
            <div class="review-name">${ctx.esc(review.name)}</div>
            ${starsHTML(Number(review.rating) || 5)}
            <div class="review-title">${ctx.esc(ctx.L(review.title))}</div>
            <p class="review-body">${ctx.esc(ctx.L(review.body))}</p>
          </article>`
            )
            .join("")}
        </div>
        <div class="reviews-dots" aria-hidden="true">${reviews.map((_, i) => `<button class="${i === 0 ? "active" : ""}" type="button"></button>`).join("")}</div>
      </div>
    </section>`;
  }

  function pressHTML() {
    const items = ctx.S.press || [];
    return `<section class="press reveal" aria-label="${ctx.esc(ctx.L(ctx.SET.pressTitle))}">
      <div class="container">
        <h2 class="press-title">${ctx.esc(ctx.L(ctx.SET.pressTitle))}</h2>
        <div class="press-grid">
          ${items
            .map(
              (item) => `<div>
            <div class="press-outlet">${ctx.esc(ctx.L(item.outlet))}</div>
            <p>“${ctx.esc(ctx.L(item.quote))}”</p>
          </div>`
            )
            .join("")}
        </div>
        <div class="press-dots" aria-hidden="true"><button class="active" type="button"></button><button type="button"></button></div>
      </div>
    </section>`;
  }

  const COL = { handle: "all", q: "", brand: "all", sale: false, sort: "featured", shown: 10, items: [] };

  function renderCollection() {
    const params = new URLSearchParams(location.search);
    COL.handle = params.get("handle") || "all";
    COL.q = (params.get("q") || "").trim();
    const col = ctx.S.collections.find((c) => c.handle === COL.handle);
    const list =
      COL.handle === "all"
        ? ctx.PRODUCTS.slice()
        : ctx.PRODUCTS.filter((p) => (p.collections || []).includes(COL.handle));
    COL.items = COL.q ? list.filter((p) => ctx.R.matchesQuery(p, COL.q)) : list;

    const title = COL.q
      ? `${ctx.t("searchResults")}: “${COL.q}”`
      : col
        ? ctx.L(col.title)
        : COL.handle === "all"
          ? ctx.t("allProducts")
          : ctx.t("collection");
    document.title = `${title} | ${ctx.L(ctx.SET.storeName)}`;
    document.getElementById("col-title").textContent = title;
    document.getElementById("col-count").textContent =
      `${COL.items.length} ${COL.items.length === 1 ? ctx.t("product") : ctx.t("products")}`;
    const sortLabel = document.querySelector(".sort-wrap label");
    if (sortLabel) sortLabel.textContent = ctx.t("sortBy");

    const crumb = document.getElementById("col-crumb");
    if (crumb)
      crumb.innerHTML = `<a href="index.html">${ctx.esc(ctx.t("homeCrumb"))}</a><span>/</span><span>${ctx.esc(title)}</span>`;

    const vendors = [...new Set(COL.items.map((p) => p.vendor).filter(Boolean))].sort();
    const filters = document.getElementById("col-filters");
    filters.innerHTML = `
      <button class="chip ${COL.brand === "all" && !COL.sale ? "active" : ""}" type="button" data-brand="all">${ctx.esc(ctx.t("all"))}</button>
      ${vendors.map((v) => `<button class="chip ${COL.brand === v ? "active" : ""}" type="button" data-brand="${ctx.esc(v)}">${ctx.esc(v)}</button>`).join("")}
      <button class="chip ${COL.sale ? "active" : ""}" type="button" data-sale="1">${ctx.esc(ctx.t("onSale"))}</button>`;

    const sort = document.getElementById("col-sort");
    if (sort) {
      const labels = [
        ["featured", "featured"],
        ["price-asc", "priceLow"],
        ["price-desc", "priceHigh"],
        ["discount", "biggestDiscount"],
        ["title", "nameAZ"]
      ];
      sort.innerHTML = labels
        .map(([value, key]) => `<option value="${value}">${ctx.esc(ctx.t(key))}</option>`)
        .join("");
      /** @type {HTMLSelectElement} */ (sort).value = COL.sort;
    }
    drawCollectionGrid();
    bindCollectionOnce();
  }

  function drawCollectionGrid() {
    let items = COL.items.slice();
    if (COL.brand !== "all") items = items.filter((p) => p.vendor === COL.brand);
    if (COL.sale) items = items.filter((p) => p.discount > 0);
    if (COL.sort === "price-asc") items.sort((a, b) => ctx.R.effectivePrice(a) - ctx.R.effectivePrice(b));
    else if (COL.sort === "price-desc") items.sort((a, b) => ctx.R.effectivePrice(b) - ctx.R.effectivePrice(a));
    else if (COL.sort === "discount") items.sort((a, b) => b.discount - a.discount);
    else if (COL.sort === "title") items.sort((a, b) => a.title.localeCompare(b.title));

    const grid = document.getElementById("col-grid");
    const shown = items.slice(0, COL.shown);
    grid.innerHTML = shown.length
      ? shown.map(ctx.cardHTML).join("")
      : `<div class="empty-state" style="grid-column:1/-1"><h2>${ctx.esc(ctx.t("noProducts"))}</h2><p>${ctx.esc(ctx.t("tryFilter"))}</p><a class="btn btn-primary" href="collection.html?handle=all">${ctx.esc(ctx.t("browseAll"))}</a></div>`;
    const count = document.querySelector(".collection-head .count");
    if (count) count.textContent = `${items.length} ${items.length === 1 ? ctx.t("product") : ctx.t("products")}`;
    const more = document.getElementById("load-more");
    if (more) {
      more.style.display = items.length > COL.shown ? "" : "none";
      more.textContent = ctx.t("loadMore");
    }
    ctx.observeReveals();
    ctx.hydrateIcons(grid);
  }

  ctx.collectionBound = false;
  function bindCollectionOnce() {
    if (ctx.collectionBound) return;
    ctx.collectionBound = true;
    document.getElementById("col-sort")?.addEventListener("change", (event) => {
      COL.sort = /** @type {HTMLSelectElement} */ (event.target).value;
      COL.shown = 10;
      drawCollectionGrid();
    });
    document.getElementById("load-more")?.addEventListener("click", () => {
      COL.shown += 10;
      drawCollectionGrid();
    });
    document.addEventListener("click", (event) => {
      const e = /** @type {any} */ (event);
      const b = e.target.closest("[data-brand]");
      if (b) {
        COL.brand = b.dataset.brand;
        COL.shown = 10;
        document.querySelectorAll("[data-brand]").forEach((x) => x.classList.toggle("active", x === b));
        drawCollectionGrid();
      }
      const s = e.target.closest("[data-sale]");
      if (s) {
        COL.sale = !COL.sale;
        s.classList.toggle("active", COL.sale);
        COL.shown = 10;
        drawCollectionGrid();
      }
    });
  }
  Object.assign(ctx, { SUSTAIN_CARDS, COL });
}
