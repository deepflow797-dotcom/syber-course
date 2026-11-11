// @ts-check
/* dashboard.js → Overview
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { statCard, viewOverview });
  function statCard(label, value, note, accent, iconName, trend = "") {
    return `<article class="dash-card stat-card u-accent-bg" data-sv="accent:${ctx.esc(accent)}">
      <div class="stat-top"><span class="stat-label">${ctx.esc(label)}</span><span class="stat-icon">${ctx.icon(iconName)}</span></div>
      <strong>${value}</strong><small>${trend ? `<span class="trend">${ctx.esc(trend)}</span> · ` : ""}${ctx.esc(note)}</small>
    </article>`;
  }

  function viewOverview() {
    const orders = ctx.orderList();
    const totalRevenue = ctx.revenueOfOrders(orders);
    const newCount = orders.filter((order) => order.status === "new").length;
    const cancelled = orders.filter((order) => order.status === "cancelled" || order.status === "returned").length;
    const low = ctx.lowStockProducts();
    const abandoned = ctx.R.getAbandoned().filter((item) => item.status === "open");
    const recent = orders.slice(0, 6);
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
    const statusRows = ["new", "confirmed", "preparing", "shipped", "delivered", "cancelled"].map((status) => {
      const meta = ctx.R.statusMeta(status);
      return { status, label: ctx.lng(meta.label), color: meta.color, count: ctx.orderStatusCount(status) };
    });
    const displayName =
      ctx.session?.role === "owner" ? ctx.dt("مالك المتجر", "Propriétaire") : ctx.dt("مدير المتجر", "Gérant");
    return `
      <div class="dash-view-head">
        <div><h2>${ctx.dt("مرحبًا", "Bonjour")} ${ctx.esc(displayName)} 👋</h2><p>${ctx.dt("هذا ملخص مباشر لأداء متجرك.", "Voici un résumé en direct de votre boutique.")}</p></div>
        <div class="dash-view-actions">
          <a class="btn btn-primary" href="#products" data-route="products">${ctx.icon("plus")} ${ctx.dt("إضافة منتج", "Ajouter un produit")}</a>
          <a class="btn btn-soft" href="#reports" data-route="reports">${ctx.dt("عرض التقارير", "Voir les rapports")}</a>
        </div>
      </div>
      <div class="dash-grid cols-4 u-mb-14">
        ${statCard(ctx.dt("إجمالي الطلبات", "Commandes totales"), orders.length, ctx.dt("كل الطلبات المسجلة", "Toutes les commandes"), "#ff6400", "orders", newCount ? `+${newCount} ${ctx.dt("جديد", "nouveau")}` : "")}
        ${statCard(ctx.dt("الإيرادات", "Chiffre d’affaires"), ctx.money(totalRevenue), ctx.dt("دون الملغاة والمرتجعة", "Hors annulées et retours"), "#128c53", "reports")}
        ${statCard(ctx.dt("طلبات جديدة", "Nouvelles commandes"), newCount, ctx.dt("تحتاج إلى تأكيد", "À confirmer"), "#a72396", "bell")}
        ${statCard(ctx.dt("مخزون منخفض", "Stock faible"), low.length, ctx.dt("منتجات تحتاج متابعة", "Produits à suivre"), "#e67e22", "products")}
      </div>
      <div class="dash-grid cols-3 u-mb-14">
        <article class="dash-card u-span-2">
          <div class="dash-card-head"><h3>${ctx.dt("آخر الطلبات", "Dernières commandes")}</h3><a href="#orders" data-route="orders">${ctx.dt("عرض الكل", "Tout voir")}</a></div>
          <div class="dash-card-body u-pt-10">
            ${
              recent.length
                ? `<div class="dash-table-wrap"><table class="dash-table"><thead><tr><th>${ctx.dt("الطلب", "Commande")}</th><th>${ctx.dt("العميل", "Client")}</th><th>${ctx.dt("المدينة", "Ville")}</th><th>${ctx.dt("المجموع", "Total")}</th><th>${ctx.dt("الحالة", "Statut")}</th><th></th></tr></thead><tbody>
              ${recent
                .map((order) => {
                  const status = ctx.R.statusMeta(order.status);
                  return `<tr>
                  <td><strong>${ctx.esc(order.id)}</strong><br><small>${ctx.esc(ctx.fmtDate(order.createdAt))}</small></td>
                  <td>${ctx.esc(order.customer?.name || "")}<br><small dir="ltr">${ctx.esc(order.customer?.phone || "")}</small></td>
                  <td>${ctx.esc(order.customer?.city || "")}</td>
                  <td class="price">${ctx.money(order.total)}</td>
                  <td><span class="status-pill u-status-text" data-sv="status:${ctx.esc(status.color)}">${ctx.esc(ctx.lng(status.label))}</span></td>
                  <td><button class="btn btn-sm btn-soft" type="button" data-action="view-order" data-id="${ctx.esc(order.id)}">${ctx.dt("تفاصيل", "Détails")}</button></td>
                </tr>`;
                })
                .join("")}</tbody></table></div>`
                : `<div class="empty-dash">${ctx.icon("orders")}<p>${ctx.dt("لا توجد طلبات بعد. ستظهر الطلبات القادمة من المتجر هنا مباشرة.", "Aucune commande. Les commandes de la boutique apparaîtront ici.")}</p></div>`
            }
          </div>
        </article>
        <article class="dash-card">
          <div class="dash-card-head"><h3>${ctx.dt("حالة المتجر", "État de la boutique")}</h3><a href="#settings" data-route="settings">${ctx.dt("إعدادات", "Réglages")}</a></div>
          <div class="dash-card-body">
            <div class="u-flex u-items-center u-gap-9 u-py-9 u-border-bottom"><span class="dot u-sq-8 u-round u-tint" data-sv="bg:${ctx.R.isStoreOpen() ? "#25a55f" : "#c0392b"}"></span><div><strong class="u-fs-10">${ctx.R.isStoreOpen() ? ctx.dt("المتجر مفتوح", "Boutique ouverte") : ctx.dt("المتجر مغلق", "Boutique fermée")}</strong><br><small class="u-fs-8 u-soft">${ctx.model.settings.hours.open} — ${ctx.model.settings.hours.close} · ${ctx.esc(ctx.model.settings.timezone)}</small></div></div>

            <div class="u-flex u-items-center u-gap-9 u-py-9"><span class="dot u-sq-8 u-round u-tint" data-sv="bg:${ctx.dirty ? "#e67e22" : "#25a55f"}"></span><div><strong class="u-fs-10">${ctx.dirty ? ctx.dt("مسودة غير منشورة", "Brouillon non publié") : ctx.dt("كل التغييرات منشورة", "Tout est publié")}</strong><br><small class="u-fs-8 u-soft">${ctx.dt("آخر تحديث", "Dernière mise à jour")}: ${ctx.esc(ctx.fmtDateTime(ctx.model.updatedAt))}</small></div></div>
            <button class="btn btn-primary btn-block btn-sm u-mt-8" type="button" data-action="preview">${ctx.icon("preview")} ${ctx.dt("معاينة المتجر", "Prévisualiser")}</button>
          </div>
        </article>
      </div>
      <div class="dash-grid cols-3">
        <article class="dash-card">
          <div class="dash-card-head"><h3>${ctx.dt("الطلبات في آخر 7 أيام", "Commandes des 7 jours")}</h3></div>
          <div class="dash-card-body">
            <div class="report-bars">${days.map((day) => `<div class="bar u-h-pct" data-sv="h:${Math.max(5, Math.round((day.total / maxDay) * 100))}" title="${ctx.money(day.total)}"><span>${ctx.esc(day.label)}</span></div>`).join("")}</div>
            <div class="report-legend"><span><i></i>${ctx.money(days.reduce((sum, day) => sum + day.total, 0))} ${ctx.dt("هذا الأسبوع", "cette semaine")}</span></div>
          </div>
        </article>
        <article class="dash-card">
          <div class="dash-card-head"><h3>${ctx.dt("توزيع حالات الطلبات", "Répartition des statuts")}</h3></div>
          <div class="dash-card-body">
            ${statusRows.map((row) => `<div class="u-grid u-grid-thumb u-items-center u-gap-7 u-mb-8"><small class="u-fs-8 u-muted">${ctx.esc(row.label)}</small><div class="mini-bar" data-sv="bar:${ctx.esc(row.color)}"><i class="u-w-pct" data-sv="w:${orders.length ? Math.max(3, (row.count / orders.length) * 100) : 0}"></i></div><strong class="u-fs-9">${row.count}</strong></div>`).join("")}
          </div>
        </article>
        <article class="dash-card">
          <div class="dash-card-head"><h3>${ctx.dt("تحتاج انتباهك", "À surveiller")}</h3></div>
          <div class="dash-card-body">
            <div class="list-editor">
              <div class="list-row"><div class="grow"><strong>${low.length} ${ctx.dt("منتجات بمخزون منخفض", "produits en stock faible")}</strong><small>${ctx.dt("حد التنبيه", "Seuil")}: ${ctx.model.settings.lowStockThreshold}</small></div><a class="btn btn-sm btn-soft" href="#products" data-route="products">${ctx.dt("إدارة", "Gérer")}</a></div>
              <div class="list-row"><div class="grow"><strong>${abandoned.length} ${ctx.dt("سلة متروكة", "paniers abandonnés")}</strong><small>${ctx.dt("فرص استرجاع", "Opportunités")}</small></div><a class="btn btn-sm btn-soft" href="#abandoned" data-route="abandoned">${ctx.dt("عرض", "Voir")}</a></div>
              <div class="list-row"><div class="grow"><strong>${cancelled} ${ctx.dt("طلبات ملغاة/مرتجعة", "annulées/retournées")}</strong><small>${ctx.dt("راجع الأسباب", "Vérifiez les causes")}</small></div><a class="btn btn-sm btn-soft" href="#orders" data-route="orders">${ctx.dt("الطلبات", "Commandes")}</a></div>
            </div>
          </div>
        </article>
      </div>`;
  }
}
