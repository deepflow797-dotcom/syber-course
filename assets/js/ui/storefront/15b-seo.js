// @ts-check
/* app.js → SEO helpers (meta tags, canonical, JSON-LD, theme-color)
   Extracted verbatim from 15-global-events.js so each function stays under the complexity budget and can be
   unit-tested against jsdom without booting the whole storefront. */
// @ts-check

/** @param {any} ctx Shared storefront context. */
/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  function setMeta(attribute, key, content) {
    if (!content) return;
    let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attribute, key);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", content);
  }

  function absoluteUrl(value) {
    if (!value) return "";
    try {
      return new URL(value, location.href).href;
    } catch {
      return value;
    }
  }

  function setJsonLd(data) {
    let script = /** @type {HTMLScriptElement|null} */ (document.head.querySelector("script[data-seo-jsonld]"));
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.seoJsonld = "true";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }

  function setCanonical(url) {
    let link = /** @type {HTMLLinkElement|null} */ (document.head.querySelector('link[rel="canonical"]'));
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = url;
  }

  const siteBase = () => String(ctx.SET.baseUrl || location.origin).replace(/\/$/, "");
  const socialImage = () => absoluteUrl(ctx.SET.seo.image || ctx.SET.logo);

  function applyHomeSeo() {
    const base = siteBase();
    const title = ctx.L(ctx.SET.seo.title) || `${ctx.L(ctx.SET.storeName)} | ${ctx.L(ctx.SET.tagline)}`;
    const description = ctx.L(ctx.SET.seo.description) || "";
    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", description);
    setCanonical(`${base}/`);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:url", `${base}/`);
    setMeta("property", "og:image", socialImage());
    setMeta("property", "og:locale", ctx.R.lang === "ar" ? "ar_MR" : "fr_FR");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", socialImage());
    setJsonLd(storeJsonLd(base, title, description));
  }

  function storeJsonLd(base, title, description) {
    /** @type {any} */
    const structured = {
      "@context": "https://schema.org",
      "@type": "Store",
      name: ctx.L(ctx.SET.storeName),
      description,
      url: base,
      image: socialImage(),
      telephone: ctx.SET.phoneDisplay || ctx.SET.phone,
      email: ctx.SET.email,
      address: {
        "@type": "PostalAddress",
        addressLocality: ctx.L(ctx.SET.city),
        addressCountry: ctx.SET.country?.code || "MR"
      },
      sameAs: (ctx.SET.social || []).map((item) => item.href).filter(Boolean)
    };
    if (ctx.SET.hours) {
      structured.openingHours = `${String(ctx.SET.hours.open || "09:00")}-${String(ctx.SET.hours.close || "19:00")}`;
    }
    return structured;
  }

  function applyThemeColor() {
    const found = document.querySelector('meta[name="theme-color"]');
    const themeColor = found || document.createElement("meta");
    themeColor.setAttribute("name", "theme-color");
    themeColor.setAttribute("content", ctx.R.theme === "dark" ? "#101014" : ctx.SET.colors.primary);
    if (!themeColor.parentNode) document.head.appendChild(themeColor);
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon && ctx.SET.favicon) favicon.setAttribute("href", ctx.SET.favicon);
  }

  function applySeo() {
    if (!ctx.SET.seo) return;
    if (document.body?.dataset.page === "home") applyHomeSeo();
    applyThemeColor();
  }

  function productOffer(base, path, product) {
    return {
      "@type": "Offer",
      url: `${base}${path}`,
      priceCurrency: "MRU",
      price: Number(product.price) || 0,
      priceValidUntil: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
      availability:
        Number(product.stock) > 0 && product.available !== false
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/RefurbishedCondition"
    };
  }

  /** @param {any} product */
  function productJsonLd(product, base, path) {
    const rating = Number(ctx.productRating(product)) || 0;
    /** @type {any} */
    const data = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      image: (product.images || [product.image]).filter(Boolean).map(absoluteUrl),
      description: ctx.L(product.description),
      sku: product.sku || product.handle,
      brand: { "@type": "Brand", name: product.vendor || ctx.L(ctx.SET.storeName) },
      offers: productOffer(base, path, product)
    };
    if (rating) {
      data.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: rating,
        reviewCount: Math.max(1, ctx.productReviews(product).length),
        bestRating: 5
      };
    }
    return data;
  }

  /** @param {any} product */
  function applyProductSeo(product) {
    const base = siteBase();
    const path = `/product.html?handle=${encodeURIComponent(product.handle)}`;
    const title = `${product.title} | ${ctx.L(ctx.SET.storeName)}`;
    const description = `${product.title} — ${ctx.L(product.description)}`.slice(0, 300);
    const image = absoluteUrl(product.image);
    document.title = title;
    setCanonical(`${base}${path}`);
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", "product");
    setMeta("property", "og:url", `${base}${path}`);
    setMeta("property", "og:image", image);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", image);
    setJsonLd(productJsonLd(product, base, path));
  }

  Object.assign(ctx, {
    setMeta,
    absoluteUrl,
    setJsonLd,
    setCanonical,
    applySeo,
    applyProductSeo
  });
}
