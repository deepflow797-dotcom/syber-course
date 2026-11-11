// @ts-check
/* dashboard.js → Abandoned checkout
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { viewAbandoned });
  function viewAbandoned() {
    const all = ctx.R.getAbandoned();
    const list = all.filter((item) => ctx.abandonedFilter === "all" || item.status === ctx.abandonedFilter);
    return `
      <div class="dash-view-head">
        <div><h2>${ctx.dt("السلال المتروكة", "Paniers abandonnés")}</h2><p>${ctx.dt("بيانات تُحفظ أثناء ملء العميل لصفحة الدفع.", "Données enregistrées pendant la saisie au checkout.")}</p></div>
      </div>
      <div class="dash-toolbar"><div class="segmented">${[
        ["open", ctx.dt("مفتوحة", "Ouverts")],
        ["contacted", ctx.dt("تم التواصل", "Contactés")],
        ["closed", ctx.dt("مغلقة", "Fermés")],
        ["all", ctx.dt("الكل", "Tous")]
      ]
        .map(
          ([id, label]) =>
            `<button data-abandoned-filter="${id}" class="${ctx.abandonedFilter === id ? "active" : ""}">${label}</button>`
        )
        .join(
          ""
        )}</div><div class="spacer"></div><span class="badge-soft orange">${all.filter((item) => item.status === "open").length} ${ctx.dt("مفتوحة", "ouverts")}</span></div>
      <div class="dash-card">${
        list.length
          ? `<div class="dash-table-wrap"><table class="dash-table"><thead><tr><th>${ctx.dt("العميل", "Client")}</th><th>${ctx.dt("الهاتف", "Téléphone")}</th><th>${ctx.dt("المدينة", "Ville")}</th><th>${ctx.dt("السلة", "Panier")}</th><th>${ctx.dt("القيمة", "Valeur")}</th><th>${ctx.dt("التاريخ", "Date")}</th><th>${ctx.dt("الحالة", "Statut")}</th><th></th></tr></thead><tbody>
        ${list
          .map(
            (item) => `<tr>
          <td><strong>${ctx.esc(item.name || ctx.dt("زائر", "Visiteur"))}</strong></td>
          <td dir="ltr">${ctx.esc(item.phone || "—")}</td>
          <td>${ctx.esc(item.city || "—")}</td>
          <td>${(item.items || []).map((product) => `${ctx.esc(product.title)} ×${product.qty}`).join("<br>") || "—"}</td>
          <td class="price">${ctx.money(item.subtotal || 0)}</td>
          <td>${ctx.esc(ctx.fmtDateTime(item.updatedAt || item.createdAt))}</td>
          <td><span class="badge-soft">${ctx.esc(item.status || "open")}</span></td>
          <td><div class="cell-actions">
            ${item.phone ? `<a class="btn btn-sm btn-soft" href="https://wa.me/${ctx.digits(item.phone)}?text=${encodeURIComponent(ctx.dt(`مرحباً، رأينا أنك لم تكمل طلبك من ${ctx.lng(ctx.model.settings.storeName)}. هل نساعدك؟`, `Bonjour, nous avons vu que vous n’avez pas finalisé votre commande ${ctx.lng(ctx.model.settings.storeName)}. Pouvons-nous vous aider ?`))}" target="_blank" rel="noopener">${ctx.icon("whatsapp")}</a>` : ""}
            <button class="btn btn-sm btn-soft" data-action="abandoned-status" data-id="${ctx.esc(item.id)}" data-status="contacted">${ctx.dt("تم التواصل", "Contacté")}</button>
            <button class="btn btn-sm btn-soft" data-action="delete-abandoned" data-id="${ctx.esc(item.id)}">${ctx.icon("trash")}</button>
          </div></td>
        </tr>`
          )
          .join("")}</tbody></table></div>`
          : `<div class="table-empty">${ctx.icon("abandoned")}<p>${ctx.dt("لا توجد سلال متروكة.", "Aucun panier abandonné.")}</p></div>`
      }</div>`;
  }
}
