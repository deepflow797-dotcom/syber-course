// @ts-check
/* dashboard.js → Reports
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { reportOrders, viewReports });
  ctx.reportRange = "30";
  function reportOrders() {
    const orders = ctx.orderList().filter((order) => order.status !== "cancelled" && order.status !== "returned");
    if (ctx.reportRange === "all") return orders;
    const days = Number(ctx.reportRange) || 30;
    const cutoff = Date.now() - days * 864e5;
    return orders.filter((order) => Date.parse(order.createdAt) >= cutoff);
  }

  function viewReports() {
    const orders = reportOrders();
    const revenue = ctx.revenueOfOrders(orders);
    const items = orders.flatMap((order) => order.items || []);
    const itemCount = items.reduce((sum, item) => sum + Number(item.qty || 1), 0);
    const avg = orders.length ? revenue / orders.length : 0;
    const cityMap = {};
    orders.forEach((order) => {
      const city = order.customer?.city || "—";
      cityMap[city] = cityMap[city] || { count: 0, revenue: 0 };
      cityMap[city].count += 1;
      cityMap[city].revenue += Number(order.total) || 0;
    });
    const productMap = {};
    items.forEach((item) => {
      const key = item.handle || item.title;
      productMap[key] = productMap[key] || { title: item.title, image: item.image, qty: 0, revenue: 0 };
      productMap[key].qty += Number(item.qty || 1);
      productMap[key].revenue += Number(item.line || 0);
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
    const topCities = Object.entries(cityMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 8);
    const maxCity = Math.max(1, ...topCities.map(([, data]) => data.revenue));
    const abandoned = ctx.R.getAbandoned().length;
    const conversion = orders.length + abandoned ? Math.round((orders.length / (orders.length + abandoned)) * 100) : 0;
    const days = [...Array(7)].map((_, offset) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - offset));
      const key = date.toISOString().slice(0, 10);
      const total = orders
        .filter((order) => String(order.createdAt).slice(0, 10) === key)
        .reduce((sum, order) => sum + Number(order.total || 0), 0);
      return { label: date.toLocaleDateString(ctx.dashLang === "ar" ? "ar-MR" : "fr-FR", { weekday: "short" }), total };
    });
    const maxDay = Math.max(1, ...days.map((day) => day.total));
    const low = ctx.lowStockProducts().slice(0, 8);
    return `
      <div class="dash-view-head"><div><h2>${ctx.dt("التقارير", "Rapports")}</h2><p>${ctx.dt("المبيعات والمخزون والأداء.", "Ventes, stock et performance.")}</p></div><div class="dash-view-actions"><div class="segmented">${[
        ["7", "7j"],
        ["30", "30j"],
        ["90", "90j"],
        ["all", ctx.dt("الكل", "Tout")]
      ]
        .map(
          ([id, label]) =>
            `<button data-report-range="${id}" class="${ctx.reportRange === id ? "active" : ""}">${label}</button>`
        )
        .join(
          ""
        )}</div><button class="btn btn-soft" data-action="export-orders">${ctx.icon("download")} CSV</button></div></div>
      <div class="dash-grid cols-4 u-mb-14">
        ${ctx.statCard(ctx.dt("الإيرادات", "Chiffre d’affaires"), ctx.money(revenue), `${orders.length} ${ctx.dt("طلب", "commandes")}`, "#128c53", "reports")}
        ${ctx.statCard(ctx.dt("متوسط الطلب", "Panier moyen"), ctx.money(avg), ctx.dt("لكل طلب", "par commande"), "#ff6400", "cart")}
        ${ctx.statCard(ctx.dt("القطع المباعة", "Articles vendus"), itemCount, ctx.dt("إجمالي القطع", "total unités"), "#a72396", "products")}
        ${ctx.statCard(ctx.dt("نسبة التحويل", "Conversion"), `${conversion}%`, `${abandoned} ${ctx.dt("سلة متروكة", "paniers")}`, "#0b6fb8", "marketing")}
      </div>
      <div class="dash-grid cols-3">
        <article class="dash-card u-span-2"><div class="dash-card-head"><h3>${ctx.dt("الإيرادات آخر 7 أيام", "Revenus 7 jours")}</h3></div><div class="dash-card-body"><div class="report-bars">${days.map((day) => `<div class="bar u-h-pct" data-sv="h:${Math.max(5, Math.round((day.total / maxDay) * 100))}" title="${ctx.money(day.total)}"><span>${ctx.esc(day.label)}</span></div>`).join("")}</div><div class="report-legend"><span><i></i>${ctx.money(days.reduce((sum, day) => sum + day.total, 0))}</span></div></div></article>
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("أفضل المدن", "Meilleures villes")}</h3></div><div class="dash-card-body">${topCities.length ? topCities.map(([city, data]) => `<div class="u-mb-9"><div class="u-flex u-justify-between u-fs-9 u-mb-4"><span>${ctx.esc(city)}</span><strong>${ctx.money(data.revenue)}</strong></div><div class="mini-bar"><i class="u-w-pct" data-sv="w:${Math.round((data.revenue / maxCity) * 100)}"></i></div><small class="u-fs-8 u-soft">${data.count} ${ctx.dt("طلب", "commandes")}</small></div>`).join("") : `<div class="empty-dash">${ctx.dt("لا توجد بيانات.", "Aucune donnée.")}</div>`}</div></article>
      </div>
      <div class="dash-grid cols-2 u-mt-14">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("المنتجات الأكثر مبيعًا", "Meilleures ventes")}</h3></div><div class="dash-card-body"><div class="dash-table-wrap"><table class="dash-table"><thead><tr><th>${ctx.dt("المنتج", "Produit")}</th><th>${ctx.dt("القطع", "Unités")}</th><th>${ctx.dt("الإيراد", "Revenu")}</th></tr></thead><tbody>${topProducts.map((product) => `<tr><td><div class="cell-main"><img src="${ctx.esc(product.image)}" alt=""><strong>${ctx.esc(product.title)}</strong></div></td><td>${product.qty}</td><td class="price">${ctx.money(product.revenue)}</td></tr>`).join("") || `<tr><td colspan="3" class="table-empty">${ctx.dt("لا توجد مبيعات.", "Aucune vente.")}</td></tr>`}</tbody></table></div></div></article>
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("مخزون منخفض", "Stock faible")}</h3><a href="#products" data-route="products">${ctx.dt("إدارة", "Gérer")}</a></div><div class="dash-card-body"><div class="list-editor">${low.map((product) => `<div class="list-row"><span class="image-preview u-sq-32 u-basis-32"><img src="${ctx.esc(product.image)}" alt=""></span><div class="grow"><strong>${ctx.esc(product.title)}</strong><small>${ctx.dt("متبقي", "Reste")}: ${product.stock}</small></div><span class="badge-soft ${product.stock <= 0 ? "" : "orange"}">${product.stock <= 0 ? ctx.dt("نفد", "Épuisé") : ctx.dt("منخفض", "Faible")}</span></div>`).join("") || `<div class="empty-dash">${ctx.dt("المخزون جيد.", "Stock correct.")}</div>`}</div></div></article>
      </div>`;
  }
}
