// @ts-check
/* dashboard.js → Marketing / coupons
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { viewMarketing, couponEditor });
  function viewMarketing() {
    const offer =
      (ctx.model.settings.offers || []).find((item) => item.id === "bankily") ||
      (ctx.model.settings.offers || [])[0] ||
      {};
    return `
      <div class="dash-view-head"><div><h2>${ctx.dt("العروض والتسويق", "Offres & marketing")}</h2><p>${ctx.dt("كوبونات، عرض بنكيلي والبانر الترويجي.", "Coupons, offre Bankily et bannière promo.")}</p></div></div>
      <div class="dash-tabs"><button class="active" data-dash-tab="marketing-offer">${ctx.dt("عرض بنكيلي", "Offre Bankily")}</button><button data-dash-tab="marketing-coupons">${ctx.dt("الكوبونات", "Coupons")}</button><button data-dash-tab="marketing-banner">${ctx.dt("بانر وإعلان", "Bannière & annonce")}</button></div>
      <div class="dash-panel active" data-dash-panel="marketing-offer">
        <div class="dash-grid cols-2">
          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("عرض الدفع عبر بنكيلي", "Offre Bankily")}</h3><span class="badge-soft orange">-10%</span></div><div class="dash-card-body dash-form">
            <div class="form-grid">${ctx.biField(ctx.dt("العنوان", "Titre"), "settings.offers.0.title")}${ctx.biField(ctx.dt("الوصف", "Sous-titre"), "settings.offers.0.subtitle", { type: "textarea", rows: 2 })}</div>
            <div class="form-grid">${ctx.field(ctx.dt("كود الخصم", "Code promo"), "settings.offers.0.code")}${ctx.field(ctx.dt("نهاية العرض", "Fin de l’offre"), "settings.offers.0.endsAt", { type: "datetime-local" })}</div>
            <div class="check-row"><label class="toggle"><input type="checkbox" data-path="settings.offers.0.active" data-type="bool" ${offer.active !== false ? "checked" : ""}><span></span></label><span>${ctx.dt("العرض نشط", "Offre active")}</span></div>
            ${ctx.biField(ctx.dt("نص عرض الدفع في المنتج", "Texte offre au produit"), "settings.paymentOffer", { type: "textarea", rows: 2 })}
            ${ctx.field(ctx.dt("كود بانكيلي", "Code Bankily"), "settings.paymentOfferCode")}
            <p class="form-note">${ctx.dt("يُعرض العد التنازلي تلقائيًا حتى تاريخ النهاية. الكود يُطبق عند اختيار الدفع عبر بنكيلي.", "Le compte à rebours s’affiche jusqu’à la date de fin. Le code s’applique avec Bankily.")}</p>
          </div></article>
          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("معاينة العرض", "Aperçu de l’offre")}</h3></div><div class="dash-card-body">
            <div class="u-hero-gradient">
              <span class="u-fs-9 u-ls-1 u-warm">BANKILY · -10%</span>
              <h3 class="u-fs-21 u-my-7 u-lh-12">${ctx.esc(ctx.lng(offer.title))}</h3>
              <p class="u-fs-10 u-dim u-lh-16">${ctx.esc(ctx.lng(offer.subtitle))}</p>
              <span class="u-dashed-badge u-mt-13">${ctx.esc(offer.code || "BANKILY10")}</span>
            </div>
            <p class="form-note u-mt-10">${ctx.dt("ينتهي", "Se termine")}: ${ctx.esc(offer.endsAt ? ctx.fmtDateTime(offer.endsAt) : "—")}</p>
          </div></article>
        </div>
      </div>
      <div class="dash-panel" data-dash-panel="marketing-coupons">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("كوبونات الخصم", "Coupons")}</h3><button data-action="add-coupon">${ctx.icon("plus")} ${ctx.dt("كوبون جديد", "Nouveau coupon")}</button></div><div class="dash-card-body">
          <div class="dash-table-wrap"><table class="dash-table"><thead><tr><th>${ctx.dt("الكود", "Code")}</th><th>${ctx.dt("النوع", "Type")}</th><th>${ctx.dt("القيمة", "Valeur")}</th><th>${ctx.dt("الحد الأدنى", "Minimum")}</th><th>${ctx.dt("الانتهاء", "Expiration")}</th><th>${ctx.dt("نشط", "Actif")}</th><th></th></tr></thead><tbody>
            ${(ctx.model.settings.coupons || []).map((coupon, index) => `<tr><td><strong class="u-ltr">${ctx.esc(coupon.code)}</strong></td><td>${coupon.type === "percent" ? ctx.dt("نسبة", "Pourcentage") : ctx.dt("ثابت", "Fixe")}</td><td>${coupon.type === "percent" ? `${coupon.value}%` : ctx.money(coupon.value)}</td><td>${ctx.money(coupon.minTotal || 0)}</td><td>${coupon.expiresAt ? ctx.esc(ctx.fmtDate(coupon.expiresAt)) : "—"}</td><td><label class="toggle"><input type="checkbox" data-coupon-active="${index}" ${coupon.active !== false ? "checked" : ""}><span></span></label></td><td><div class="cell-actions"><button class="btn btn-sm btn-soft" data-action="edit-coupon" data-index="${index}">${ctx.icon("edit")}</button><button class="btn btn-sm btn-soft" data-action="delete-coupon" data-index="${index}">${ctx.icon("trash")}</button></div></td></tr>`).join("")}
          </tbody></table></div>
        </div></article>
      </div>
      <div class="dash-panel" data-dash-panel="marketing-banner">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("البانر والرسائل", "Bannière & messages")}</h3></div><div class="dash-card-body dash-form">
          ${ctx.biField(ctx.dt("شريط الإعلان العلوي", "Bandeau haut"), "settings.announcement", { type: "textarea", rows: 2 })}
          <div class="form-grid">${ctx.biField(ctx.dt("رسالة المتجر المغلق", "Message boutique fermée"), "settings.closedMessage", { type: "textarea", rows: 2 })}${ctx.biField(ctx.dt("عنوان عرض الرئيسية", "Titre offre accueil"), "settings.paymentOffer", { type: "textarea", rows: 2 })}</div>
          ${ctx.biField(ctx.dt("عنوان قسم الاستدامة", "Titre durabilité"), "settings.sustainabilityTitle")}
          <p class="form-note">${ctx.dt("البانر يعرض تلقائيًا في أعلى كل صفحات المتجر. يمكن إخفاؤه من إعدادات الواجهة.", "La bannière s’affiche en haut du site. Masquable depuis l’apparence.")}</p>
        </div></article>
      </div>`;
  }

  function couponEditor(index) {
    const isNew = index == null;
    const buffer = isNew
      ? {
          id: `coupon-${Date.now().toString(36)}`,
          code: "RESTORE10",
          type: "percent",
          value: 10,
          active: true,
          minTotal: 0,
          expiresAt: ""
        }
      : ctx.clone(ctx.model.settings.coupons[index]);
    ctx.editBuffer = buffer;
    ctx.openModal(
      isNew ? ctx.dt("كوبون جديد", "Nouveau coupon") : buffer.code,
      `
      <div class="form-grid">
        ${ctx.editInput(ctx.dt("الكود", "Code"), "code", { value: buffer.code })}
        <div class="field"><label>${ctx.dt("النوع", "Type")}</label><select data-edit-path="type"><option value="percent" ${buffer.type === "percent" ? "selected" : ""}>${ctx.dt("نسبة مئوية", "Pourcentage")}</option><option value="fixed" ${buffer.type === "fixed" ? "selected" : ""}>${ctx.dt("مبلغ ثابت", "Montant fixe")}</option></select></div>
        ${ctx.editInput(ctx.dt("القيمة", "Valeur"), "value", { type: "number", value: buffer.value })}
        ${ctx.editInput(ctx.dt("الحد الأدنى للطلب", "Minimum de commande"), "minTotal", { type: "number", value: buffer.minTotal || 0 })}
        ${ctx.editInput(ctx.dt("تاريخ الانتهاء", "Date d’expiration"), "expiresAt", { type: "date", value: buffer.expiresAt ? String(buffer.expiresAt).slice(0, 10) : "" })}
        <div class="span-2">${ctx.editToggle(ctx.dt("نشط", "Actif"), "active", buffer.active !== false)}</div>
      </div>`,
      {
        footer: `<button class="btn btn-soft btn-sm" data-action="close-modal">${ctx.dt("إلغاء", "Annuler")}</button><button class="btn btn-primary btn-sm" data-action="save-coupon" data-index="${isNew ? "" : index}">${ctx.dt("حفظ", "Enregistrer")}</button>`
      }
    );
  }
}
