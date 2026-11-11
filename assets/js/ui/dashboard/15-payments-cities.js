// @ts-check
/* dashboard.js → Payments and shipping cities
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { viewPayments, paymentEditor, viewPaymentSave, cityEditor, viewCitySave });
  function viewPayments() {
    return `
      <div class="dash-view-head"><div><h2>${ctx.dt("الدفع والتوصيل", "Paiement & livraison")}</h2><p>${ctx.dt("فعّل طرق الدفع المحلية وحدد رسوم المدن. يمكنك رفع شعار لكل طريقة دفع.", "Activez les paiements locaux et les frais par ville. Vous pouvez télécharger un logo pour chaque moyen de paiement.")}</p></div></div>
      <div class="dash-tabs"><button class="active" data-dash-tab="pay-methods">${ctx.dt("طرق الدفع", "Moyens de paiement")}</button><button data-dash-tab="pay-cities">${ctx.dt("مدن التوصيل", "Villes de livraison")}</button><button data-dash-tab="pay-shipping">${ctx.dt("إعدادات الشحن", "Réglages livraison")}</button></div>
      <div class="dash-panel active" data-dash-panel="pay-methods">
        <div class="dash-view-actions" style="justify-content:flex-end;margin-bottom:9px"><button class="btn btn-primary btn-sm" data-action="add-payment">${ctx.icon("plus")} ${ctx.dt("طريقة دفع", "Moyen de paiement")}</button></div>
        <div class="dash-grid cols-2">
          ${(ctx.model.settings.payments || [])
            .map(
              (payment, index) => `<article class="dash-card"><div class="dash-card-body">
            <div style="display:flex;align-items:center;gap:9px;margin-bottom:10px">
              ${payment.image || payment.logo ? `<img src="${ctx.esc(payment.image || payment.logo)}" alt="" style="width:36px;height:36px;border-radius:9px;object-fit:contain">` : `<span style="width:36px;height:36px;border-radius:9px;background:${ctx.esc(payment.color)};color:#fff;display:grid;place-items:center;font-size:10px;font-weight:800">${ctx.esc(String(ctx.lng(payment.name)).slice(0, 2))}</span>`}
              <div style="flex:1"><strong style="font-size:12px">${ctx.esc(ctx.lng(payment.name))}</strong><br><small style="font-size:8px;color:var(--soft-muted)">${ctx.esc(ctx.lng(payment.note))}</small></div>
              <label class="toggle"><input type="checkbox" data-payment-active="${index}" ${payment.active !== false ? "checked" : ""}><span></span></label>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
              <span class="badge-soft ${payment.discount ? "orange" : ""}">${payment.discount ? `-${payment.discount}%` : ctx.dt("بدون خصم", "Sans remise")}</span>
              <div class="cell-actions"><button class="btn btn-sm btn-soft" data-action="edit-payment" data-index="${index}">${ctx.icon("edit")}</button><button class="btn btn-sm btn-soft" data-action="delete-payment" data-index="${index}">${ctx.icon("trash")}</button></div>
            </div>
            ${payment.image || payment.logo ? `<div class="image-preview" style="margin-top:8px"><img src="${ctx.esc(payment.image || payment.logo)}" alt="" style="max-width:100%;max-height:40px;border-radius:6px"></div>` : ""}
          </div></article>`
            )
            .join("")}
        </div>
        <article class="dash-card" style="margin-top:14px"><div class="dash-card-body">${ctx.biField(ctx.dt("نص عرض الدفع", "Texte offre paiement"), "settings.paymentOffer", { type: "textarea", rows: 2 })}<p class="form-note" style="margin-top:8px">${ctx.dt("يظهر هذا النص في صفحة المنتج وصفحة الدفع. البنكيلي يطبق الخصم المحدد أعلاه تلقائيًا.", "Ce texte apparaît sur la fiche produit et au checkout. Bankily applique automatiquement la remise.")}</p></div></article>
      </div>
      <div class="dash-panel" data-dash-panel="pay-cities">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("مدن التوصيل", "Villes de livraison")}</h3><button data-action="add-city">${ctx.icon("plus")} ${ctx.dt("إضافة مدينة", "Ajouter une ville")}</button></div><div class="dash-card-body"><div class="dash-table-wrap"><table class="dash-table"><thead><tr><th>${ctx.dt("المدينة", "Ville")}</th><th>${ctx.dt("الرسوم", "Frais")}</th><th>${ctx.dt("المدة", "Délai")}</th><th>${ctx.dt("نشطة", "Active")}</th><th></th></tr></thead><tbody>
          ${(ctx.model.settings.cities || []).map((city, index) => `<tr><td><strong>${ctx.esc(ctx.lng(city.name))}</strong></td><td>${ctx.money(city.fee)}</td><td>${ctx.esc(ctx.lng(city.days))}</td><td><label class="toggle"><input type="checkbox" data-city-active="${index}" ${city.active !== false ? "checked" : ""}><span></span></label></td><td><div class="cell-actions"><button class="btn btn-sm btn-soft" data-action="edit-city" data-index="${index}">${ctx.icon("edit")}</button><button class="btn btn-sm btn-soft" data-action="delete-city" data-index="${index}">${ctx.icon("trash")}</button></div></td></tr>`).join("")}
        </tbody></table></div></div></article>
      </div>
      <div class="dash-panel" data-dash-panel="pay-shipping">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("إعدادات الشحن", "Réglages livraison")}</h3></div><div class="dash-card-body dash-form">
          <div class="form-grid">${ctx.field(ctx.dt("الشحن المجاني بعد (MRU)", "Livraison gratuite dès (MRU)"), "settings.freeShippingOver", { type: "number" })}${ctx.field(ctx.dt("حد المخزون المنخفض", "Seuil stock faible"), "settings.lowStockThreshold", { type: "number" })}</div>
          ${ctx.biField(ctx.dt("ملاحظة الشحن", "Note livraison"), "settings.shippingNote", { type: "textarea", rows: 2 })}
          ${ctx.directToggle(ctx.dt("إخفاء المنتجات المنتهية من المتجر", "Masquer les produits épuisés"), "settings.autoHideOutOfStock", ctx.model.settings.autoHideOutOfStock)}
          <p class="form-note">${ctx.dt("تظهر رسوم كل مدينة في صفحة الدفع ويُضاف الشحن المجاني إذا تجاوز المجموع الحد المحدد.", "Les frais de chaque ville s’affichent au checkout ; la livraison est offerte au-delà du seuil.")}</p>
        </div></article>
      </div>`;
  }

  ctx.pendingPaymentIndex = null;
  function paymentEditor(index) {
    const isNew = index == null;
    const buffer = isNew
      ? {
          id: `payment-${Date.now().toString(36)}`,
          name: { ar: "", fr: "" },
          image: "",
          color: "#0b6fb8",
          active: true,
          discount: 0,
          note: { ar: "", fr: "" }
        }
      : ctx.clone(ctx.model.settings.payments[index]);
    ctx.editBuffer = buffer;
    ctx.pendingPaymentIndex = isNew ? null : index;
    ctx.openModal(
      isNew ? ctx.dt("طريقة دفع جديدة", "Nouveau moyen") : ctx.lng(buffer.name),
      `
      <div class="form-grid">
        ${ctx.editBi(ctx.dt("الاسم", "Nom"), "name", buffer.name)}
        <div class="field"><label>${ctx.dt("اللون", "Couleur")}</label><input type="color" data-edit-path="color" value="${ctx.esc(buffer.color)}"></div>
        <div class="field"><label>${ctx.dt("الخصم %", "Remise %")}</label><input type="number" data-edit-path="discount" value="${ctx.esc(buffer.discount || 0)}"></div>
        <div class="field"><label>${ctx.dt("ملاحظة", "Note")}</label><input data-edit-path="note.ar" value="${ctx.esc(buffer.note?.ar || "")}" dir="rtl"></div>
        <div class="field"><label>Note FR</label><input data-edit-path="note.fr" value="${ctx.esc(buffer.note?.fr || "")}" dir="ltr"></div>
        <div class="span-2">${ctx.imageEditor(ctx.dt("صورة التطبيق", "Image de l’application"), "image", buffer.image || buffer.logo || "")}</div>
        <div class="span-2">${ctx.editToggle(ctx.dt("مفعلة", "Active"), "active", buffer.active !== false)}</div>
      </div>`,
      {
        footer: ctx.editorFooter(!isNew, "delete-payment-buffer")
      }
    );
  }

  function viewPaymentSave() {
    if (!ctx.editBuffer) return;
    if (ctx.pendingPaymentIndex == null) ctx.model.settings.payments.push(ctx.editBuffer);
    else ctx.model.settings.payments[ctx.pendingPaymentIndex] = ctx.editBuffer;
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.renderRoute();
    ctx.toast(ctx.dt("تم حفظ طريقة الدفع", "Paiement enregistré"), "good");
  }

  ctx.pendingCityIndex = null;
  function cityEditor(index) {
    const isNew = index == null;
    const buffer = isNew
      ? {
          id: `city-${Date.now().toString(36)}`,
          name: { ar: "", fr: "" },
          fee: 0,
          days: { ar: "2–4 أيام", fr: "2–4 jours" },
          active: true
        }
      : ctx.clone(ctx.model.settings.cities[index]);
    ctx.editBuffer = buffer;
    ctx.pendingCityIndex = isNew ? null : index;
    ctx.openModal(
      isNew ? ctx.dt("مدينة جديدة", "Nouvelle ville") : ctx.lng(buffer.name),
      `
      <div class="form-grid">
        ${ctx.editBi(ctx.dt("المدينة", "Ville"), "name", buffer.name)}
        <div class="field"><label>${ctx.dt("رسوم الشحن", "Frais")}</label><input type="number" data-edit-path="fee" value="${ctx.esc(buffer.fee)}"></div>
        ${ctx.editBi(ctx.dt("المدة", "Délai"), "days", buffer.days)}
        <div class="span-2">${ctx.editToggle(ctx.dt("نشطة", "Active"), "active", buffer.active !== false)}</div>
      </div>`,
      {
        footer: ctx.editorFooter(!isNew, "delete-city-buffer")
      }
    );
  }

  function viewCitySave() {
    if (!ctx.editBuffer) return;
    if (ctx.pendingCityIndex == null) ctx.model.settings.cities.push(ctx.editBuffer);
    else ctx.model.settings.cities[ctx.pendingCityIndex] = ctx.editBuffer;
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.renderRoute();
    ctx.toast(ctx.dt("تم حفظ المدينة", "Ville enregistrée"), "good");
  }
}
