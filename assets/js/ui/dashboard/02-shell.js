/* dashboard.js → Application shell
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

export function install(ctx) {
  Object.assign(ctx, { renderShell, renderRoute });
  const NAV_GROUPS = [
    {
      label: { ar: "نظرة عامة", fr: "Vue d’ensemble" },
      items: [
        { id: "overview", icon: "overview", ar: "نظرة عامة", fr: "Vue d’ensemble" },
        { id: "orders", icon: "orders", ar: "الطلبات", fr: "Commandes", count: true },
        { id: "abandoned", icon: "abandoned", ar: "السلال المتروكة", fr: "Paniers abandonnés" }
      ]
    },
    {
      label: { ar: "المتجر", fr: "Boutique" },
      items: [
        { id: "products", icon: "products", ar: "المنتجات", fr: "Produits" },
        { id: "categories", icon: "categories", ar: "الفئات", fr: "Catégories" },
        { id: "reviews", icon: "reviews", ar: "التقييمات", fr: "Avis" }
      ]
    },
    {
      label: { ar: "المحتوى", fr: "Contenu" },
      items: [
        { id: "content", icon: "content", ar: "نصوص المتجر", fr: "Textes & contenu" },
        { id: "homepage", icon: "home", ar: "الصفحة الرئيسية", fr: "Page d’accueil" },
        { id: "appearance", icon: "palette", ar: "الهوية والألوان", fr: "Identité & couleurs" },
        { id: "marketing", icon: "marketing", ar: "العروض والتسويق", fr: "Offres & marketing" },
        { id: "blog", icon: "blog", ar: "المدونة", fr: "Blog" },
        { id: "pages", icon: "pages", ar: "الصفحات", fr: "Pages" }
      ]
    },
    {
      label: { ar: "العمليات", fr: "Opérations" },
      items: [
        { id: "payments", icon: "payment", ar: "الدفع والتوصيل", fr: "Paiement & livraison" },
        { id: "team", icon: "team", ar: "الفريق", fr: "Équipe" },
        { id: "reports", icon: "reports", ar: "التقارير", fr: "Rapports" },
        { id: "settings", icon: "settings", ar: "الإعدادات", fr: "Réglages" },
        { id: "audit", icon: "audit", ar: "سجل النشاط", fr: "Journal d’activité" }
      ]
    },
    {
      label: { ar: "الحساب", fr: "Compte" },
      items: [{ id: "profile", icon: "team", ar: "ملفي الشخصي", fr: "Mon profil" }]
    }
  ];
  const OWNER_ONLY_ROUTES = new Set(["team", "settings", "audit"]);
  const ROUTE_TITLES = {
    overview: {
      ar: "نظرة عامة",
      fr: "Vue d’ensemble",
      sub: { ar: "ملخص مباشر للمتجر", fr: "Résumé en direct de la boutique" }
    },
    orders: {
      ar: "الطلبات",
      fr: "Commandes",
      sub: { ar: "إدارة الطلبات والواتساب والفواتير", fr: "Commandes, WhatsApp et factures" }
    },
    abandoned: {
      ar: "السلال المتروكة",
      fr: "Paniers abandonnés",
      sub: { ar: "استرجع العملاء الذين لم يكملوا الطلب", fr: "Récupérez les clients qui n’ont pas finalisé" }
    },
    products: { ar: "المنتجات", fr: "Produits", sub: { ar: "المخزون والأسعار والصور", fr: "Stock, prix et images" } },
    categories: {
      ar: "الفئات",
      fr: "Catégories",
      sub: { ar: "تنظيم مجموعات المتجر", fr: "Organisez les collections" }
    },
    reviews: {
      ar: "التقييمات",
      fr: "Avis clients",
      sub: { ar: "راجع واعتمد تقييمات العملاء", fr: "Modérez les avis clients" }
    },
    content: {
      ar: "نصوص المتجر",
      fr: "Textes & contenu",
      sub: { ar: "المحتوى بالعربية والفرنسية", fr: "Contenu en arabe et français" }
    },
    homepage: {
      ar: "الصفحة الرئيسية",
      fr: "Page d’accueil",
      sub: { ar: "الأقسام، السلايدر والترتيب", fr: "Sections, slider et ordre" }
    },
    appearance: {
      ar: "الهوية والألوان",
      fr: "Identité & couleurs",
      sub: { ar: "الشعار، الألوان والخطوط", fr: "Logo, couleurs et polices" }
    },
    marketing: {
      ar: "العروض والتسويق",
      fr: "Offres & marketing",
      sub: { ar: "بنكيلي، الكوبونات والبانرات", fr: "Bankily, coupons et bannières" }
    },
    blog: { ar: "المدونة", fr: "Blog", sub: { ar: "المقالات والصور المنشورة", fr: "Articles et images publiés" } },
    pages: {
      ar: "الصفحات",
      fr: "Pages",
      sub: { ar: "الصفحات الثابتة والسياسات", fr: "Pages statiques et politiques" }
    },
    payments: {
      ar: "الدفع والتوصيل",
      fr: "Paiement & livraison",
      sub: { ar: "بنكيلي، مصرفي، سداد، كليك والمدن", fr: "Bankily, Masrvi, Sedad, Click et villes" }
    },
    team: { ar: "الفريق", fr: "Équipe", sub: { ar: "المديرون وصلاحيات الدخول", fr: "Gérants et accès" } },
    reports: {
      ar: "التقارير",
      fr: "Rapports",
      sub: { ar: "المبيعات، الطلبات والمخزون", fr: "Ventes, commandes et stock" }
    },
    settings: {
      ar: "الإعدادات",
      fr: "Réglages",
      sub: { ar: "SEO، واتساب، البكسل والحماية", fr: "SEO, WhatsApp, pixels et sécurité" }
    },
    audit: {
      ar: "سجل النشاط",
      fr: "Journal d’activité",
      sub: { ar: "كل التغييرات المسجلة", fr: "Toutes les modifications" }
    }
  };

  function renderShell() {
    const displayName =
      ctx.session?.role === "owner" ? ctx.dt("مالك المتجر", "Propriétaire") : ctx.dt("مدير المتجر", "Gérant");
    const initials = String(displayName || "R")
      .slice(0, 2)
      .toUpperCase();
    const mgr =
      ctx.R.managers.find((item) => item.id === ctx.session?.id) ||
      ctx.R.managers.find((item) => item.username === ctx.session?.username);
    const mgrAvatar = mgr?.avatar && mgr.avatar.trim() ? mgr.avatar : "";
    ctx.app.innerHTML = `
      <div class="dash-shell">
        <aside class="dash-sidebar" id="dash-sidebar">
          <a class="brand" href="index.html"><img src="${ctx.esc(ctx.model.settings.logoWhite || "assets/img/brand-logo-white.svg")}" alt="${ctx.esc(ctx.model.settings.storeName?.[ctx.dashLang] || "")}"></a>
          <div class="dash-workspace"><span class="dot"></span><div><strong>${ctx.esc(ctx.lng(ctx.model.settings.storeName))}</strong><small>MRU</small></div></div>
          <nav class="dash-nav">
            ${NAV_GROUPS.map(
              (group) => `
              <div class="dash-nav-label">${ctx.esc(group.label[ctx.dashLang] || group.label.ar)}</div>
              ${group.items
                .filter((item) => ctx.session?.role === "owner" || !OWNER_ONLY_ROUTES.has(item.id))
                .map(
                  (item) =>
                    `<a href="#${item.id}" data-route="${item.id}" class="${ctx.route === item.id ? "active" : ""}">${ctx.icon(item.icon)}<span>${ctx.esc(item[ctx.dashLang] || item.ar)}</span>${item.count ? `<span class="count" data-nav-count="orders" ${ctx.newOrdersCount() ? "" : "hidden"}>${ctx.newOrdersCount() || ""}</span>` : ""}</a>`
                )
                .join("")}
            `
            ).join("")}
          </nav>
          <div class="dash-user">
            <span class="dash-avatar" data-route="profile" title="${ctx.dt("ملفي الشخصي", "Mon profil")}">${mgrAvatar ? `<img src="${ctx.esc(mgrAvatar)}" alt="">` : ctx.esc(initials)}</span>
            <div><strong>${ctx.esc(displayName)}</strong><small>${ctx.session?.role === "owner" ? ctx.dt("المالك", "Propriétaire") : ctx.dt("مدير", "Gérant")}</small></div>
            <button type="button" data-action="logout" title="${ctx.dt("خروج", "Déconnexion")}">${ctx.icon("logout")}</button>
          </div>
        </aside>
        <main class="dash-main">
          <header class="dash-topbar">
            <button class="dash-menu-btn" type="button" data-action="toggle-sidebar">${ctx.icon("menu")}</button>
            <div class="dash-title"><h1 id="dash-title">${ctx.esc(ROUTE_TITLES[ctx.route]?.[ctx.dashLang] || ROUTE_TITLES[ctx.route]?.ar || "")}</h1><small id="dash-subtitle">${ctx.esc(ROUTE_TITLES[ctx.route]?.sub?.[ctx.dashLang] || "")}</small></div>
            <label class="dash-search">${ctx.icon("search")}<input id="dash-search" placeholder="${ctx.dt("بحث في الطلبات والمنتجات...", "Rechercher commandes, produits...")}" value="${ctx.esc(ctx.searchTerm)}"></label>
            <div class="dash-top-actions">
              <span class="dash-save-state ${ctx.dirty ? "dirty" : "published"}"><i></i>${ctx.dirty ? ctx.dt("تغييرات غير منشورة", "Modifications non publiées") : ctx.dt("متجر محدث", "Boutique à jour")}</span>
              <button class="dash-lang" type="button" data-dash-lang="${ctx.dashLang === "ar" ? "fr" : "ar"}">${ctx.dashLang === "ar" ? "FR" : "AR"}</button>
              <button class="dash-icon-btn" type="button" data-action="theme" title="${ctx.dt("الوضع الليلي", "Mode sombre")}">${ctx.icon(ctx.R.theme === "dark" ? "sun" : "moon")}</button>
              <a class="dash-icon-btn" href="index.html" target="_blank" rel="noopener" title="${ctx.dt("عرض المتجر", "Voir la boutique")}">${ctx.icon("external")}</a>
              <button class="dash-icon-btn" type="button" data-action="orders-alert" title="${ctx.dt("طلبات جديدة", "Nouvelles commandes")}">${ctx.icon("bell")}<span class="alert-dot" data-order-alert ${Math.max(0, ctx.newOrdersCount() - ctx.orderBadgeSeen) ? "" : "hidden"}>${Math.max(0, ctx.newOrdersCount() - ctx.orderBadgeSeen) || ""}</span></button>
              <div class="dash-publish">
                <button class="btn btn-soft" type="button" data-action="preview" title="${ctx.dt("معاينة", "Aperçu")}">${ctx.icon("preview")}<span>${ctx.dt("معاينة", "Aperçu")}</span></button>
                <button class="btn btn-primary" type="button" data-action="publish" title="${ctx.dt("نشر", "Publier")}">${ctx.icon("publish")}<span>${ctx.dt("نشر", "Publier")}</span></button>
              </div>
            </div>
          </header>
          <div class="dash-view" id="dash-view"></div>
        </main>
      </div>`;
    renderRoute();
    ctx.updateCounts();
  }

  function renderRoute() {
    if (!ctx.session) {
      ctx.renderLogin();
      return;
    }
    if (ctx.session.mustChange) {
      ctx.renderPasswordChange();
      return;
    }
    if (!ROUTE_TITLES[ctx.route]) ctx.route = "overview";
    if (OWNER_ONLY_ROUTES.has(ctx.route) && ctx.session.role !== "owner") {
      ctx.route = "overview";
      ctx.toast(ctx.dt("هذه الصفحة متاحة للمالك فقط", "Cette page est réservée au propriétaire"), "error");
    }
    const view = ctx.$("#dash-view");
    if (!view) {
      renderShell();
      return;
    }
    const views = {
      overview: ctx.viewOverview,
      orders: ctx.viewOrders,
      abandoned: ctx.viewAbandoned,
      products: ctx.viewProducts,
      categories: ctx.viewCategories,
      reviews: ctx.viewReviews,
      content: ctx.viewContent,
      homepage: ctx.viewHomepage,
      appearance: ctx.viewAppearance,
      marketing: ctx.viewMarketing,
      blog: ctx.viewBlog,
      pages: ctx.viewPages,
      payments: ctx.viewPayments,
      team: ctx.viewTeam,
      reports: ctx.viewReports,
      settings: ctx.viewSettings,
      audit: ctx.viewAudit,
      profile: ctx.viewProfile
    };
    view.innerHTML = (views[ctx.route] || ctx.viewOverview)();
    ctx.$$(".dash-nav a").forEach((link) => link.classList.toggle("active", link.dataset.route === ctx.route));
    const title = ctx.$("#dash-title");
    const subtitle = ctx.$("#dash-subtitle");
    if (title) title.textContent = ROUTE_TITLES[ctx.route]?.[ctx.dashLang] || ROUTE_TITLES[ctx.route]?.ar || "";
    if (subtitle) subtitle.textContent = ROUTE_TITLES[ctx.route]?.sub?.[ctx.dashLang] || "";
    const search = ctx.$("#dash-search");
    if (search && search.value !== ctx.searchTerm) search.value = ctx.searchTerm;
    ctx.updateDraftState();
    ctx.updateCounts();
    if (ctx.route === "orders" || ctx.route === "reports")
      setTimeout(() => localStorage.setItem("restore_orders_seen_v1", String(ctx.newOrdersCount())), 800);
  }
  Object.assign(ctx, { NAV_GROUPS, OWNER_ONLY_ROUTES, ROUTE_TITLES });
}
