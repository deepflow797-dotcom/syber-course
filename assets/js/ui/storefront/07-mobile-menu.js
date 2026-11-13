// @ts-check
/* app.js → Mobile menu
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { mountMenu, openMenu, closeMenu, runSearch });
  function mountMenu() {
    if (document.getElementById("menu-drawer")) return;
    const el = document.createElement("div");
    el.innerHTML = `
      <div class="menu-overlay" id="menu-overlay"></div>
      <aside class="menu-drawer" id="menu-drawer" aria-label="${ctx.esc(ctx.t("menu"))}" aria-hidden="true">
        <div class="drawer-head">
          <h3>${ctx.esc(ctx.t("menu"))}</h3>
          <button class="drawer-close" type="button" data-close-menu aria-label="${ctx.esc(ctx.t("close"))}">${ctx.ICON.close}</button>
        </div>
        <nav class="menu-links" aria-label="Mobile">
          ${ctx.NAV.map((n) => `<a href="${ctx.esc(ctx.R.safeHref(n.href))}">${ctx.esc(ctx.L(n.label))}${n.flame ? '<span class="flame" data-icon="flame" aria-hidden="true"></span>' : ""}</a>`).join("")}
        </nav>
        <div class="menu-extra">
          <a href="account.html">${ctx.ICON.user} ${ctx.esc(ctx.t("myAccount"))}</a>
          <a href="wishlist.html">${ctx.ICON.heart} ${ctx.esc(ctx.t("wishlist"))}</a>
          <a href="page.html?slug=help">${ctx.ICON.info} ${ctx.esc(ctx.t("contactUs"))}</a>
          <a href="dashboard.html">${ctx.ICON.badgeCheck} ${ctx.R.lang === "ar" ? "لوحة التحكم" : "Tableau de bord"}</a>
        </div>
        <div class="menu-preferences">
          <button type="button" data-set-lang="ar" class="${ctx.R.lang === "ar" ? "active" : ""}"><img src="assets/img/flag-mr.svg" alt="" width="22"> العربية</button>
          <button type="button" data-set-lang="fr" class="${ctx.R.lang === "fr" ? "active" : ""}"><img src="assets/img/flag-fr.svg" alt="" width="22"> Français</button>
          <button type="button" data-theme-toggle>${ctx.R.theme === "dark" ? ctx.ICON.sun : ctx.ICON.moon} ${ctx.esc(ctx.R.theme === "dark" ? ctx.t("light") : ctx.t("dark"))}</button>
        </div>
      </aside>`;
    document.body.appendChild(el);
    document.getElementById("menu-overlay").addEventListener("click", closeMenu);
    el.querySelector("[data-close-menu]").addEventListener("click", closeMenu);
    ctx.hydrateIcons(el);
  }

  function openMenu() {
    mountMenu();
    document.getElementById("menu-overlay").classList.add("open");
    const d = document.getElementById("menu-drawer");
    d.classList.add("open");
    d.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
  }

  function closeMenu() {
    document.getElementById("menu-overlay")?.classList.remove("open");
    const d = document.getElementById("menu-drawer");
    if (d) {
      d.classList.remove("open");
      d.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("no-scroll");
  }

  function runSearch(q) {
    const box = document.getElementById("search-results");
    const hint = document.getElementById("search-hint");
    if (!box) return;
    q = (q || "").trim();
    let items;
    if (q.length < 2) {
      hint.textContent = ctx.t("popular");
      const popular = [
        "iphone-13-pro-max",
        "iphone-14-pro-max",
        "galaxy-s21-plus",
        "lenovo-thinkpad-t460-core-i5-6th-gen",
        "hp-chromebook-11-g3-celeron-5th-gen",
        "galaxy-z-fold-3",
        "iphone-15-pro-max",
        "galaxy-s20-plus"
      ];
      items = popular.map((h) => ctx.BY_HANDLE.get(h)).filter((p) => p && ctx.PRODUCTS.includes(p));
    } else {
      const found = ctx.PRODUCTS.filter((p) => ctx.R.matchesQuery(p, q));
      hint.textContent = ctx.t("resultsFor", { count: found.length, q });
      items = found.slice(0, 12);
    }
    box.innerHTML = items.length
      ? items
          .map(
            (p) => `
      <a class="search-result" href="product.html?handle=${encodeURIComponent(p.handle)}">
        <img src="${ctx.urlAttr(p.image)}" alt="${ctx.esc(p.title)}" width="64" height="64" loading="lazy" decoding="async">
        <div><div class="t">${ctx.esc(p.title)}</div><div class="p">${ctx.money(p.price)}</div></div>
      </a>`
          )
          .join("")
      : `<div class="search-empty">${ctx.esc(ctx.t("noResults"))} — ${ctx.esc(ctx.t("tryFilter"))}</div>`;
  }
}
