// @ts-check
/* app.js → Header & footer
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { renderHeader, renderCustomerAccount, renderFooter });
  const NAV = (ctx.SET.navigation || []).filter((n) => n.visible !== false);

  const currencyLabel = () => {
    const lang = ctx.R.lang;
    const ar = lang === "ar";
    if (ctx.R.getCurrencyMode() === "old") return ar ? "قديمة" : "Ancienne";
    return ar ? "جديدة" : "Nouvelle";
  };

  function otherLang(lang) {
    return lang === "ar" ? "fr" : "ar";
  }

  function otherLangLabel(lang) {
    return otherLang(lang) === "fr" ? "Français" : "العربية";
  }

  function flagFor(lang) {
    return lang === "fr" ? "assets/img/flag-fr.svg" : "assets/img/flag-mr.svg";
  }

  function themeButtonLabel() {
    return ctx.R.theme === "dark" ? ctx.t("light") : ctx.t("dark");
  }

  function themeButtonIcon() {
    return ctx.R.theme === "dark" ? ctx.ICON.sun : ctx.ICON.moon;
  }

  function navItemHTML(n) {
    const flame = n.flame ? '<span class="flame" data-icon="flame" aria-hidden="true"></span>' : "";
    const sub = n.sub?.length
      ? `<div class="nav-drop">${n.sub.map((s) => `<a href="${ctx.esc(ctx.R.safeHref(s.href))}">${ctx.esc(ctx.L(s.label))}</a>`).join("")}</div>`
      : "";
    return `
            <div class="nav-item">
              <a href="${ctx.esc(ctx.R.safeHref(n.href))}">${ctx.esc(ctx.L(n.label))}${flame}</a>
              ${sub}
            </div>`;
  }

  function renderHeader() {
    const el = document.getElementById("site-header");
    if (!el) return;
    const lang = ctx.R.lang;
    const otherLabel = otherLangLabel(lang);
    const currentFlag = flagFor(lang);
    const closed = !ctx.R.isStoreOpen();
    el.className = "site-header";
    el.innerHTML = `
      <div class="announcement ${closed ? "is-closed" : ""} announce-slide"><span>${ctx.esc(closed ? ctx.t("storeClosed") : ctx.L(ctx.SET.announcement))}</span></div>
      <div class="container header-top">
        <button class="menu-btn" type="button" data-open-menu aria-label="${ctx.esc(ctx.t("menu"))}">${ctx.ICON.menu}</button>
        <a class="logo" href="index.html" aria-label="${ctx.esc(ctx.L(ctx.SET.storeName))}"><img src="${ctx.SET.logo}" alt="${ctx.esc(ctx.L(ctx.SET.storeName))}"></a>
        <form class="search" id="header-search" role="search" autocomplete="off">
          <input type="search" placeholder="${ctx.esc(ctx.t("searchPlaceholder"))}" aria-label="${ctx.esc(ctx.t("search"))}">
          <button class="search-btn" type="submit" aria-label="${ctx.esc(ctx.t("search"))}">${ctx.ICON.search}</button>
        </form>
        <div class="header-actions">
          <div class="customer-account" id="customer-account"></div>
          <div class="lang-switch">
            <button class="lang-current" type="button" data-lang-toggle aria-label="${ctx.esc(ctx.t("language"))}">
              <img src="${currentFlag}" alt="" width="20" height="14"><span>${lang.toUpperCase()}</span>${ctx.ICON.chevronDown}
            </button>
            <div class="lang-menu">
              <button type="button" data-set-lang="ar"><img src="assets/img/flag-mr.svg" alt="" width="22" height="15"><span>العربية</span></button>
              <button type="button" data-set-lang="fr"><img src="assets/img/flag-fr.svg" alt="" width="22" height="15"><span>Français</span></button>
            </div>
          </div><button class="icon-btn theme-btn" type="button" data-theme-toggle aria-label="${ctx.esc(themeButtonLabel())}">${themeButtonIcon()}</button>
          <a class="icon-btn" href="account.html" aria-label="${ctx.esc(ctx.t("account"))}">${ctx.ICON.user}</a>
          <a class="icon-btn" href="wishlist.html" aria-label="${ctx.esc(ctx.t("wishlist"))}">${ctx.ICON.heart}<span class="cart-count wish-count" hidden>0</span></a>
          <button class="icon-btn" type="button" data-open-cart aria-label="${ctx.esc(ctx.t("cart"))}">${ctx.ICON.bag}<span class="cart-count cart-count-n" hidden>0</span></button>
        </div>
      </div>
      <nav class="main-nav" aria-label="Main">
        <div class="container nav-inner">
          ${NAV.map(navItemHTML).join("")}
        </div>
        <button class="nav-scroll" type="button" aria-label="${ctx.esc(ctx.t("seeAll"))}"><span data-icon="chevronRight" aria-hidden="true"></span></button>
      </nav>`;
    wireHeader(el, otherLabel);
    ctx.hydrateIcons(el);
  }

  function wireHeader(el, otherLabel) {
    const form = el.querySelector("#header-search");
    const input = form.querySelector("input");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      ctx.openSearch(input.value);
    });
    input.addEventListener("focus", () => {
      input.blur();
      ctx.openSearch(input.value);
    });
    el.querySelectorAll("[data-open-cart]").forEach((b) => b.addEventListener("click", ctx.openCart));
    el.querySelector("[data-open-menu]")?.addEventListener("click", ctx.openMenu);
    el.querySelector(".nav-scroll")?.addEventListener("click", () => {
      el.querySelector(".nav-inner")?.scrollBy({ left: (ctx.R.lang === "ar" ? -1 : 1) * 260, behavior: "smooth" });
    });
    el.querySelector("[data-lang-toggle]")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      el.querySelector(".lang-switch")?.classList.toggle("open");
    });
    el.querySelector("[data-currency-toggle]")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      el.querySelector(".currency-switch")?.classList.toggle("open");
    });
    el.querySelectorAll("[data-set-currency]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ctx.R.setCurrencyMode(btn.dataset.setCurrency);
        el.querySelector(".currency-switch")?.classList.remove("open");
      });
    });
    // Currency label update
    window.addEventListener("restore:currencyMode", () => {
      const label = el.querySelector(".currency-label");
      if (label) label.textContent = currencyLabel();
    });
    // Account dropdown
    el.querySelector("[data-account-toggle]")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      el.querySelector(".account-dropdown")?.classList.toggle("open");
    });
    el.querySelector("[data-customer-logout]")?.addEventListener("click", () => {
      ctx.R.customerLogout();
      location.reload();
    });
    // Close dropdowns on outside click
    document.addEventListener("click", () => {
      el.querySelector(".lang-switch")?.classList.remove("open");
      el.querySelector(".currency-switch")?.classList.remove("open");
      el.querySelector(".account-dropdown")?.classList.remove("open");
    });
    el.querySelector(".lang-current span")?.setAttribute("title", otherLabel);
  }

  function renderCustomerAccount() {
    const root = document.getElementById("customer-account");
    if (!root) return;
    const cust = ctx.R.getCustomer();
    if (cust) {
      const initial = String(cust.name || "U")
        .trim()
        .slice(0, 1)
        .toUpperCase();
      root.innerHTML = `
        <div class="account-dropdown">
          <button class="account-btn" type="button" data-account-toggle aria-label="${ctx.esc(ctx.t("account"))}">
            <span class="account-avatar">${ctx.esc(initial)}</span>
            <span class="account-name">${ctx.esc(cust.name)}</span>
            ${ctx.ICON.chevronDown}
          </button>
          <div class="account-menu">
            <a href="account.html">${ctx.ICON.user} ${ctx.esc(ctx.t("myAccount"))}</a>
            <a href="wishlist.html">${ctx.ICON.heart} ${ctx.esc(ctx.t("wishlist"))}</a>
            <button type="button" data-customer-logout>${ctx.ICON.logout} ${ctx.esc(ctx.t("logout"))}</button>
          </div>
        </div>`;
    } else {
      root.innerHTML = `<a class="btn btn-outline btn-sm account-login-link" href="account.html">${ctx.ICON.user} ${ctx.esc(ctx.t("login"))}</a>`;
    }
  }

  function renderFooter() {
    const el = document.getElementById("site-footer");
    if (!el) return;
    const year = new Date().getFullYear();
    const trust = `
      <div class="trust-bar">
        <div class="container trust-inner">
          <ul class="trust-list">
            ${(ctx.SET.trustBar || []).map((item) => `<li><span class="trust-ico" data-icon="${ctx.esc(item.icon)}"></span>${ctx.esc(ctx.L(item.label))}</li>`).join("")}
          </ul>
          <div class="footer-promo">${ctx.ICON.bolt}<span>${ctx.esc(ctx.L(ctx.SET.paymentOffer))}</span></div>
        </div>
      </div>`;
    el.innerHTML =
      trust +
      `
      <footer class="footer">
        <div class="container footer-main">
          <div>
            <a class="logo" href="index.html" aria-label="${ctx.esc(ctx.L(ctx.SET.storeName))}"><img src="${ctx.SET.logoWhite}" alt="${ctx.esc(ctx.L(ctx.SET.storeName))}"></a>
            <div class="footer-contact">
              <h4>${ctx.esc(ctx.t("contactUs"))}</h4>
              <div class="row"><span>${ctx.ICON.mapPin} ${ctx.esc(ctx.L(ctx.SET.address))}</span></div>
              <div class="row"><span>${ctx.ICON.whatsapp} <a href="https://wa.me/${ctx.esc(ctx.SET.whatsapp)}" target="_blank" rel="noopener" dir="ltr">${ctx.esc(ctx.SET.phoneDisplay)}</a></span><span>${ctx.esc(ctx.t("replyWithin"))}</span></div>
              <div class="row"><span>${ctx.ICON.mail} <a href="mailto:${ctx.esc(ctx.SET.email)}">${ctx.esc(ctx.SET.email)}</a></span></div>
              <div class="row"><span>${ctx.ICON.clock} ${ctx.esc(ctx.t("workingHours"))}</span></div>
            </div>
            <div class="footer-pay" aria-label="${ctx.esc(ctx.t("paymentMethods"))}">
              ${(ctx.SET.payments || [])
                .filter((p) => p.active)
                .map((p) =>
                  p.image || p.logo
                    ? `<span class="pay-badge pay-image" style="--pay:${ctx.esc(p.color)}"><img src="${ctx.esc(p.image || p.logo)}" alt="${ctx.esc(ctx.L(p.name))}" loading="lazy"></span>`
                    : `<span class="pay-badge pay-text" style="--pay:${ctx.esc(p.color)}">${ctx.esc(ctx.L(p.name))}</span>`
                )
                .join("")}
            </div>
            <form class="newsletter" id="newsletter-form">
              <label for="newsletter-email">${ctx.esc(ctx.t("newsletter"))}</label>
              <div><input id="newsletter-email" type="email" placeholder="${ctx.esc(ctx.t("newsletterPlaceholder"))}" required><button type="submit">${ctx.esc(ctx.t("subscribe"))}</button></div>
            </form>
          </div>
          ${(ctx.SET.footerColumns || [])
            .map(
              (col) => `
            <div>
              <h4>${ctx.esc(ctx.L(col.title))}</h4>
              <ul class="footer-links">
                ${col.links.map((l) => `<li><a href="${ctx.esc(ctx.R.safeHref(l.href))}">${ctx.esc(ctx.L(l.label))}</a></li>`).join("")}
              </ul>
            </div>`
            )
            .join("")}
        </div>
        <div class="container footer-bottom">
          <p>${ctx.esc(ctx.t("allRights", { year, store: ctx.L(ctx.SET.storeName) }))} · ${ctx.esc(ctx.L(ctx.SET.city))}, ${ctx.esc(ctx.L(ctx.SET.country.name))}</p>
          <div class="footer-bottom-links">
            <a href="dashboard.html">${ctx.R.lang === "ar" ? "لوحة التحكم" : "Tableau de bord"}</a>
            <div class="socials">
              ${(ctx.SET.social || []).map((s) => `<a href="${ctx.esc(ctx.R.safeHref(s.href, ""))}" target="_blank" rel="noopener" aria-label="${ctx.esc(s.id)}">${ctx.ICON[s.icon] || ctx.ICON.instagram}</a>`).join("")}
            </div>
          </div>
        </div>
      </footer>`;
    const form = /** @type {HTMLFormElement | null} */ (el.querySelector("#newsletter-form"));
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      ctx.toast(ctx.t("subscribed"));
      form.reset();
    });
    ctx.hydrateIcons(el);
  }
  Object.assign(ctx, { NAV });
}
