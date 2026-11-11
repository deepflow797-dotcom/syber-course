/* app.js → Global events
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

export function install(ctx) {
  Object.assign(ctx, { injectPixels, setMeta, absoluteUrl, setJsonLd, setCanonical, applySeo, applyProductSeo });
  document.addEventListener("click", (e) => {
    // Account dropdown in the header
    if (e.target.closest("[data-account-toggle]")) {
      e.stopPropagation();
      document.querySelector(".account-dropdown")?.classList.toggle("open");
      return;
    }
    document.querySelectorAll(".account-dropdown.open").forEach((dropdown) => {
      if (!dropdown.contains(e.target)) dropdown.classList.remove("open");
    });
    if (e.target.closest("[data-customer-logout]")) {
      ctx.R.customerLogout();
      ctx.renderCustomerAccount();
      ctx.toast(ctx.t("signedOut"), "good");
      if (document.body.dataset.page === "account") ctx.renderAccount();
      return;
    }
    // Review form submission
    if (e.target.matches("#submit-review")) {
      const rating = Number(document.querySelector(".rating-input")?.dataset.rating || 0);
      const title = document.getElementById("review-title")?.value?.trim();
      const body = document.getElementById("review-body")?.value?.trim();
      const handle = new URLSearchParams(location.search).get("handle");
      if (!rating || !title || !body || !handle) {
        ctx.toast(ctx.t("reviewIncomplete"), "error");
        return;
      }
      ctx.R.submitReview({ productHandle: handle, rating, title, body })
        .then(() => {
          ctx.toast(ctx.t("reviewSubmitted"), "good");
          setTimeout(() => location.reload(), 1200);
        })
        .catch((error) => {
          if (String(error?.message) === "loginRequired") {
            ctx.toast(ctx.t("loginRequired"), "error");
            setTimeout(() => {
              location.href = "account.html";
            }, 1200);
          } else {
            ctx.toast(error?.message || ctx.t("reviewIncomplete"), "error");
          }
        });
      return;
    }
    if (e.target.matches(".rating-input button")) {
      const val = Number(e.target.dataset.star);
      e.target.closest(".rating-input").dataset.rating = val;
      e.target
        .closest(".rating-input")
        .querySelectorAll("button")
        .forEach((b, i) => {
          b.classList.toggle("active", i < val);
        });
      return;
    }
    const setLang = e.target.closest("[data-set-lang]");
    if (setLang) {
      e.preventDefault();
      if (setLang.dataset.setLang !== ctx.R.lang) {
        ctx.R.setLang(setLang.dataset.setLang);
        location.reload();
      }
      return;
    }
    const themeToggle = e.target.closest("[data-theme-toggle]");
    if (themeToggle) {
      e.preventDefault();
      const next = ctx.R.theme === "dark" ? "light" : "dark";
      ctx.R.setTheme(next);
      document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
        button.innerHTML = `${next === "dark" ? ctx.ICON.sun : ctx.ICON.moon}${button.closest(".menu-preferences") ? ` ${ctx.esc(next === "dark" ? ctx.t("light") : ctx.t("dark"))}` : ""}`;
      });
      return;
    }
    if (e.target.closest("[data-country]")) {
      ctx.toast(`${ctx.L(ctx.SET.country.name)} · ${ctx.L(ctx.SET.country.currencyName)}`);
      return;
    }
    if (!e.target.closest(".lang-switch")) document.querySelector(".lang-switch")?.classList.remove("open");
    if (e.target.closest("[data-video]")) {
      e.preventDefault();
      ctx.toast(
        ctx.R.lang === "ar" ? "فيديوهات المجتمع ستُضاف قريبًا" : "Les vidéos de la communauté arrivent bientôt"
      );
      return;
    }
    const inc = e.target.closest("[data-cart-inc]");
    if (inc) {
      const it = ctx
        .readCart()
        .find((x) => x.handle === inc.dataset.handle && String(x.variantId) === inc.dataset.cartInc);
      if (it) ctx.setQty(inc.dataset.cartInc, inc.dataset.handle, it.qty + 1);
      return;
    }
    const dec = e.target.closest("[data-cart-dec]");
    if (dec) {
      const it = ctx
        .readCart()
        .find((x) => x.handle === dec.dataset.handle && String(x.variantId) === String(dec.dataset.cartDec));
      if (it) ctx.setQty(dec.dataset.cartDec, dec.dataset.handle, it.qty - 1);
      return;
    }
    const rem = e.target.closest("[data-cart-remove]");
    if (rem) {
      ctx.removeLine(rem.dataset.handle, rem.dataset.cartRemove);
      return;
    }
    const wish = e.target.closest("[data-wish]");
    if (wish) {
      e.preventDefault();
      ctx.toggleWish(wish.dataset.wish);
      return;
    }
    const sw = e.target.closest(".swatch");
    if (sw) {
      e.preventDefault();
      const card = sw.closest(".product-card");
      if (card) {
        card.querySelectorAll(".swatch").forEach((x) => x.classList.remove("selected"));
        sw.classList.add("selected");
        const img = card.querySelector("[data-card-main]");
        if (img && sw.dataset.colorImg) img.src = sw.dataset.colorImg;
        const tint = card.querySelector("[data-card-tint]");
        if (tint) {
          const isFirst = card.querySelector(".swatch") === sw;
          tint.style.background = sw.dataset.colorHex || "transparent";
          tint.style.opacity = isFirst || (img && sw.dataset.colorImg !== img.dataset.initialSrc) ? "0" : ".18";
          if (sw.dataset.colorHex) tint.style.opacity = isFirst ? "0" : ".16";
        }
      }
      return;
    }
    const scrollBtn = e.target.closest("[data-scroll]");
    if (scrollBtn) {
      const track = scrollBtn.closest(".carousel-wrap")?.querySelector(".track") || scrollBtn.closest(".video-panel");
      if (track)
        track.scrollBy({
          left: (scrollBtn.dataset.scroll === "next" ? 1 : -1) * track.clientWidth * 0.8,
          behavior: "smooth"
        });
      return;
    }
    if (e.target.closest("[data-close-search]")) {
      ctx.closeSearch();
      return;
    }
    if (e.target.closest("[data-close-cart]")) {
      ctx.closeCart();
      return;
    }
    if (e.target.closest("[data-add-cart]")) {
      if (!ctx.PDP.p) return;
      const v = ctx.pdpVariant();
      if (!v) return;
      ctx.addToCart(ctx.PDP.p.handle, v.id, ctx.PDP.qty, ctx.PDP.specs);
      ctx.openCart();
      return;
    }
    if (e.target.closest("[data-buy-now]")) {
      if (!ctx.PDP.p) return;
      const v = ctx.pdpVariant();
      if (!v) return;
      ctx.addToCart(ctx.PDP.p.handle, v.id, ctx.PDP.qty, ctx.PDP.specs);
      location.href = "checkout.html";
      return;
    }
    const opt = e.target.closest("[data-opt]");
    if (opt && ctx.PDP.p) {
      ctx.PDP.sel[opt.dataset.opt] = opt.dataset.value;
      const keys = (ctx.PDP.p.options || []).map((o) => o.name);
      let v = (ctx.PDP.p.variants || []).find((x) => keys.every((k, i) => x["o" + (i + 1)] === ctx.PDP.sel[k]));
      if (!v) {
        const idx = (ctx.PDP.p.options || []).findIndex((o) => o.name === opt.dataset.opt);
        v =
          (ctx.PDP.p.variants || []).find((x) => x.available && x["o" + (idx + 1)] === opt.dataset.value) ||
          (ctx.PDP.p.variants || []).find((x) => x["o" + (idx + 1)] === opt.dataset.value);
        if (v)
          (ctx.PDP.p.options || []).forEach((o, i) => {
            if (v["o" + (i + 1)]) ctx.PDP.sel[o.name] = v["o" + (i + 1)];
          });
      }
      const info = document.getElementById("product-info");
      if (info) info.outerHTML = ctx.pdpInfoHTML();
      if (/color|colour/i.test(opt.dataset.opt)) {
        const main = document.getElementById("gallery-main-img");
        const tint = document.getElementById("gallery-tint");
        const img = ctx.PDP.p.colorImages?.[opt.dataset.value] || ctx.PDP.p.image;
        if (main && img) main.src = img;
        if (tint) {
          const first = ctx.PDP.p.colors?.[0]?.name;
          tint.style.background = opt.dataset.colorHex || "transparent";
          tint.style.opacity = first === opt.dataset.value ? "0" : ".18";
        }
        document
          .querySelectorAll("[data-thumb]")
          .forEach((thumb) => thumb.classList.toggle("active", thumb.dataset.thumb === img));
      }
      ctx.hydrateIcons();
      return;
    }
    const qbtn = e.target.closest("[data-qty]");
    if (qbtn) {
      ctx.PDP.qty = Math.max(1, Math.min(ctx.MAX_QTY, ctx.PDP.qty + Number(qbtn.dataset.qty)));
      const span = document.getElementById("qty-val");
      if (span) span.textContent = ctx.PDP.qty;
      return;
    }
    const sdot = e.target.closest(".sustain-dots button, .reviews-dots button, .press-dots button");
    if (sdot) {
      const dots = [...sdot.parentElement.children];
      const section = sdot.closest("section") || sdot.closest(".container");
      const track =
        sdot.closest(".sustain")?.querySelector(".sustain-track") ||
        sdot.closest(".reviews")?.querySelector(".reviews-track") ||
        sdot.closest(".press")?.querySelector(".press-grid");
      if (track && section) {
        const i = dots.indexOf(sdot);
        const card = track.firstElementChild;
        const width = card ? card.getBoundingClientRect().width + 12 : track.clientWidth;
        track.scrollTo({ left: (ctx.R.lang === "ar" ? -1 : 1) * i * width, behavior: "smooth" });
        dots.forEach((dot, index) => dot.classList.toggle("active", index === i));
      }
      return;
    }
    const thumb = e.target.closest("[data-thumb]");
    if (thumb) {
      const main = document.getElementById("gallery-main-img");
      if (main) main.src = thumb.dataset.thumb;
      const tint = document.getElementById("gallery-tint");
      if (tint) tint.style.opacity = "0";
      document.querySelectorAll("[data-thumb]").forEach((item) => item.classList.toggle("active", item === thumb));
      return;
    }
  });

  document.addEventListener("change", (event) => {
    const spec = event.target.closest("[data-spec]");
    if (spec) {
      ctx.PDP.specs[spec.dataset.spec] = spec.value;
      ctx.toast(ctx.R.lang === "ar" ? "تم حفظ خيار الطلب" : "Option enregistrée");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      ctx.closeSearch();
      ctx.closeCart();
      ctx.closeMenu();
    }
  });

  window.addEventListener(
    "scroll",
    () => {
      document.querySelector(".site-header")?.classList.toggle("scrolled", window.scrollY > 160);
    },
    { passive: true }
  );

  window.addEventListener("restore:changed", () => {
    if (document.body?.dataset.page === "dashboard") return;
    if (!document.querySelector("input:focus, textarea:focus, select:focus")) {
      setTimeout(() => location.reload(), 250);
    }
  });

  window.addEventListener("restore:customer", () => {
    ctx.renderCustomerAccount();
    const page = document.body?.dataset.page;
    if (page === "wishlist") ctx.renderWishlist();
    if (page === "account") ctx.renderAccount();
  });

  window.addEventListener("restore:orders", () => {
    if (document.body?.dataset.page === "account") ctx.renderAccount();
  });

  window.addEventListener("restore:reviews", () => {
    if (document.body?.dataset.page !== "product" || !ctx.PDP.p) return;
    const section = document.querySelector("#product-extra .product-reviews");
    if (!section) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = ctx.renderProductReviews(ctx.PDP.p);
    const next = wrapper.firstElementChild;
    if (next) {
      section.replaceWith(next);
      ctx.hydrateIcons(next);
      ctx.observeReveals();
    }
  });

  /* Analytics pixels load ONLY after explicit consent (restore_consent_v1 = "granted").
     Third-party pixel loaders cannot use Subresource Integrity (vendors rotate the files), so consent is the control. */
  const CONSENT_KEY = "restore_consent_v1";
  function consentState() {
    try {
      return localStorage.getItem(CONSENT_KEY) || "";
    } catch {
      return "";
    }
  }
  function setConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* private mode */
    }
    document.getElementById("consent-banner")?.remove();
    if (value === "granted") injectPixels();
  }
  function showConsentBanner() {
    if (document.getElementById("consent-banner")) return;
    const ar = ctx.R.lang === "ar";
    const box = document.createElement("div");
    box.id = "consent-banner";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-live", "polite");
    box.style.cssText =
      "position:fixed;inset-inline:12px;bottom:12px;z-index:9999;max-width:560px;margin-inline:auto;background:var(--card,#fff);color:inherit;border:1px solid rgba(0,0,0,.12);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.18);padding:14px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:14px";
    box.innerHTML = `<span style="flex:1;min-width:200px">${ctx.esc(ar ? "نستخدم أدوات قياس (Meta/TikTok/Google) لتحسين المتجر. هل توافق؟" : "Nous utilisons des outils de mesure (Meta/TikTok/Google) pour améliorer la boutique. Acceptez-vous ?")}</span>
      <button type="button" class="btn btn-sm btn-soft" data-consent="denied">${ctx.esc(ar ? "رفض" : "Refuser")}</button>
      <button type="button" class="btn btn-sm btn-primary" data-consent="granted">${ctx.esc(ar ? "موافق" : "Accepter")}</button>`;
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-consent]");
      if (b) setConsent(b.dataset.consent);
    });
    document.body.appendChild(box);
  }
  function injectPixels() {
    const pixels = ctx.SET.pixels || {};
    if (!pixels.meta && !pixels.tiktok && !pixels.ga) return;
    if (document.querySelector("script[data-restore-pixels]")) return;
    const consent = consentState();
    if (consent !== "granted") {
      if (!consent) showConsentBanner();
      return;
    }
    const script = document.createElement("script");
    script.src = "assets/js/pixels.js";
    script.defer = true;
    script.dataset.restorePixels = "true";
    if (pixels.meta)
      script.dataset.meta = String(pixels.meta)
        .replace(/[^A-Za-z0-9_.-]/g, "")
        .slice(0, 80);
    if (pixels.tiktok)
      script.dataset.tiktok = String(pixels.tiktok)
        .replace(/[^A-Za-z0-9_.-]/g, "")
        .slice(0, 80);
    if (pixels.ga)
      script.dataset.ga = String(pixels.ga)
        .replace(/[^A-Za-z0-9_.-]/g, "")
        .slice(0, 80);
    document.head.appendChild(script);
  }

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
    let script = document.head.querySelector("script[data-seo-jsonld]");
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.seoJsonld = "true";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }

  function setCanonical(url) {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = url;
  }

  function applySeo() {
    if (!ctx.SET.seo) return;
    const base = String(ctx.SET.baseUrl || location.origin).replace(/\/$/, "");
    if (document.body?.dataset.page === "home") {
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
      setMeta("property", "og:image", absoluteUrl(ctx.SET.seo.image || ctx.SET.logo));
      setMeta("property", "og:locale", ctx.R.lang === "ar" ? "ar_MR" : "fr_FR");
      setMeta("name", "twitter:card", "summary_large_image");
      setMeta("name", "twitter:title", title);
      setMeta("name", "twitter:description", description);
      setMeta("name", "twitter:image", absoluteUrl(ctx.SET.seo.image || ctx.SET.logo));
      const structured = {
        "@context": "https://schema.org",
        "@type": "Store",
        name: ctx.L(ctx.SET.storeName),
        description,
        url: base,
        image: absoluteUrl(ctx.SET.seo.image || ctx.SET.logo),
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
      setJsonLd(structured);
    }
    const themeColor = document.querySelector('meta[name="theme-color"]') || document.createElement("meta");
    themeColor.setAttribute("name", "theme-color");
    themeColor.setAttribute("content", ctx.R.theme === "dark" ? "#101014" : ctx.SET.colors.primary);
    if (!themeColor.parentNode) document.head.appendChild(themeColor);
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon && ctx.SET.favicon) favicon.setAttribute("href", ctx.SET.favicon);
  }

  function applyProductSeo(product) {
    const base = String(ctx.SET.baseUrl || location.origin).replace(/\/$/, "");
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
    const rating = Number(ctx.productRating(product)) || 0;
    const offers = {
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
    const data = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      image: (product.images || [product.image]).filter(Boolean).map(absoluteUrl),
      description: ctx.L(product.description),
      sku: product.sku || product.handle,
      brand: { "@type": "Brand", name: product.vendor || ctx.L(ctx.SET.storeName) },
      offers
    };
    if (rating) {
      data.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: rating,
        reviewCount: Math.max(1, ctx.productReviews(product).length),
        bestRating: 5
      };
    }
    setJsonLd(data);
  }
}
