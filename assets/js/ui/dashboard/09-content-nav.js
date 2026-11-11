// @ts-check
/* dashboard.js → Storefront content and navigation
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { isoLocal, directImageEditor, viewContent, navEditor, saveNavEditor });
  function isoLocal(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function directImageEditor(label, path, value = "") {
    return `<div class="field"><label>${ctx.esc(label)}</label><div class="image-field">
      <span class="image-preview"><img data-preview-for="${ctx.esc(path)}" src="${ctx.esc(value || "assets/img/favicon.svg")}" alt=""></span>
      <div class="grow">
        <input data-path="${ctx.esc(path)}" value="${ctx.esc(value)}" placeholder="assets/img/...">
        <label class="upload-btn">${ctx.icon("upload")} ${ctx.dt("رفع صورة", "Téléverser")}<input type="file" accept="image/*" data-upload-path="${ctx.esc(path)}" data-upload-target="direct"></label>
      </div>
    </div></div>`;
  }

  function viewContent() {
    const settings = ctx.model.settings;
    return `
      <div class="dash-view-head">
        <div><h2>${ctx.dt("نصوص المتجر", "Textes & contenu")}</h2><p>${ctx.dt("كل نص يظهر في المتجر قابل للتعديل هنا بالعربية والفرنسية.", "Chaque texte visible sur la boutique est modifiable ici en arabe et en français.")}</p></div>
        <div class="dash-view-actions"><button class="btn btn-primary" data-action="save-draft">${ctx.icon("check")} ${ctx.dt("حفظ المسودة", "Enregistrer")}</button></div>
      </div>
      <div class="dash-tabs">
        <button class="active" type="button" data-dash-tab="content-main">${ctx.dt("الهوية والنصوص", "Identité & textes")}</button>
        <button type="button" data-dash-tab="content-contact">${ctx.dt("التواصل والمواعيد", "Contact & horaires")}</button>
        <button type="button" data-dash-tab="content-trust">${ctx.dt("شريط الثقة", "Barre de confiance")}</button>
        <button type="button" data-dash-tab="content-nav">${ctx.dt("القائمة", "Navigation")}</button>
        <button type="button" data-dash-tab="content-footer">${ctx.dt("التذييل", "Pied de page")}</button>
      </div>
      <div class="dash-panel active" data-dash-panel="content-main">
        <div class="dash-grid cols-2">
          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("النصوص الأساسية", "Textes principaux")}</h3></div><div class="dash-card-body dash-form">
            ${ctx.biField(ctx.dt("اسم المتجر", "Nom de la boutique"), "settings.storeName")}
            ${ctx.biField(ctx.dt("الشعار النصي", "Slogan"), "settings.tagline")}
            ${ctx.biField(ctx.dt("شريط الإعلان", "Bandeau d’annonce"), "settings.announcement", { type: "textarea", rows: 2 })}
            ${ctx.biField(ctx.dt("عنوان الفئات", "Titre catégories"), "settings.categoriesTitle")}
            ${ctx.biField(ctx.dt("عنوان خدمة العملاء", "Titre service"), "settings.serviceTitle", { type: "textarea", rows: 2 })}
            ${ctx.biField(ctx.dt("عنوان آراء العملاء", "Titre avis"), "settings.reviewsTitle")}
            ${ctx.biField(ctx.dt("عنوان الصحافة", "Titre presse"), "settings.pressTitle")}
            ${ctx.biField(ctx.dt("نص المجدد", "Texte reconditionné"), "settings.renewalText")}
          </div></article>
          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("أقسام مخصصة", "Sections personnalisées")}</h3></div><div class="dash-card-body dash-form">
            ${ctx.biField(ctx.dt("عنوان الثقة", "Titre confiance"), "settings.trustTitle")}
            ${ctx.biField(ctx.dt("عنوان المجتمع", "Titre communauté"), "settings.communityTitle")}
            ${ctx.biField(ctx.dt("ملاحظة الشحن", "Note livraison"), "settings.shippingNote", { type: "textarea", rows: 2 })}
            ${ctx.field(ctx.dt("الحد الأدنى للشحن المجاني (MRU)", "Seuil livraison gratuite (MRU)"), "settings.freeShippingOver", { type: "number" })}
            ${ctx.field(ctx.dt("رقم الهاتف للعرض", "Téléphone affiché"), "settings.phoneDisplay")}
            ${ctx.field("WhatsApp", "settings.whatsapp", { hint: ctx.dt("أرقام فقط مع رمز الدولة، مثال 22246000000", "Chiffres uniquement avec indicatif, ex. 22246000000") })}
            ${ctx.field(ctx.dt("البريد الإلكتروني", "E-mail"), "settings.email", { type: "email" })}
          </div></article>
        </div>
      </div>
      <div class="dash-panel" data-dash-panel="content-contact">
        <div class="dash-grid cols-2">
          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("معلومات التواصل", "Coordonnées")}</h3></div><div class="dash-card-body dash-form">
            ${ctx.biField(ctx.dt("العنوان", "Adresse"), "settings.address", { type: "textarea", rows: 2 })}
            ${ctx.field(ctx.dt("الهاتف", "Téléphone"), "settings.phone")}
            ${ctx.field(ctx.dt("واتساب", "WhatsApp"), "settings.whatsapp")}
            ${ctx.field(ctx.dt("بريد الدعم", "E-mail support"), "settings.email", { type: "email" })}
            ${ctx.field(ctx.dt("المنطقة الزمنية", "Fuseau horaire"), "settings.timezone")}
          </div></article>
          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("ساعات العمل والحالة", "Horaires et état")}</h3></div><div class="dash-card-body dash-form">
            <div class="form-grid">${ctx.field(ctx.dt("الفتح", "Ouverture"), "settings.hours.open", { type: "time" })}${ctx.field(ctx.dt("الإغلاق", "Fermeture"), "settings.hours.close", { type: "time" })}</div>
            <div class="check-row"><label class="toggle"><input type="checkbox" data-path="settings.hours.closed" data-type="bool" ${settings.hours.closed ? "checked" : ""}><span></span></label><span>${ctx.dt("إغلاق المتجر مؤقتًا", "Fermer temporairement")}</span></div>
            <div class="check-row"><label class="toggle"><input type="checkbox" data-path="settings.hours.maintenance" data-type="bool" ${settings.hours.maintenance ? "checked" : ""}><span></span></label><span>${ctx.dt("وضع الصيانة", "Mode maintenance")}</span></div>
            ${ctx.biField(ctx.dt("رسالة الإغلاق", "Message de fermeture"), "settings.closedMessage", { type: "textarea", rows: 2 })}
            <p class="form-note">${ctx.dt("تظهر حالة المتجر تلقائيًا للزوار حسب ساعات العمل. الأوقات بتوقيت نواكشوط.", "L’état est calculé selon les horaires. Heure de Nouakchott.")}</p>
            <p class="form-note">${ctx.dt("ساعات اليوم", "Aujourd’hui")}: <strong>${ctx.R.isStoreOpen() ? ctx.dt("مفتوح", "Ouvert") : ctx.dt("مغلق", "Fermé")}</strong></p>
          </div></article>
        </div>
      </div>
      <div class="dash-panel" data-dash-panel="content-trust">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("شريط الثقة", "Barre de confiance")}</h3><button data-action="add-trust">${ctx.icon("plus")} ${ctx.dt("إضافة", "Ajouter")}</button></div><div class="dash-card-body">
          <div class="dash-form">${(settings.trustBar || []).map((item, index) => `<div class="form-section"><div class="form-grid"><div class="field"><label>${ctx.dt("الأيقونة", "Icône")}</label><input data-path="settings.trustBar.${index}.icon" value="${ctx.esc(item.icon)}"></div><div class="field"><label>${ctx.dt("العربي", "Arabe")}</label><input data-path="settings.trustBar.${index}.label.ar" value="${ctx.esc(item.label?.ar || "")}" dir="rtl"></div><div class="field"><label>Français</label><input data-path="settings.trustBar.${index}.label.fr" value="${ctx.esc(item.label?.fr || "")}" dir="ltr"></div><div style="display:flex;align-items:flex-end"><button class="btn btn-sm btn-danger" data-action="remove-trust" data-index="${index}">${ctx.icon("trash")}</button></div></div></div>`).join("")}</div>
        </div></article>
      </div>
      <div class="dash-panel" data-dash-panel="content-nav">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("قائمة التنقل", "Navigation")}</h3><button data-action="add-nav">${ctx.icon("plus")} ${ctx.dt("إضافة عنصر", "Ajouter")}</button></div><div class="dash-card-body">
          <div class="list-editor">${(settings.navigation || []).map((item, index) => `<div class="list-row"><div class="grow"><strong>${ctx.esc(ctx.lng(item.label))}</strong><small class="handle">${ctx.esc(item.href)}</small></div>${ctx.directToggle("", `settings.navigation.${index}.visible`, item.visible !== false)}<button class="btn btn-sm btn-soft" data-action="edit-nav" data-index="${index}">${ctx.icon("edit")}</button><button class="btn btn-sm btn-soft" data-action="delete-nav" data-index="${index}">${ctx.icon("trash")}</button></div>`).join("")}</div>
          <p class="form-note" style="margin-top:10px">${ctx.dt("كل عنصر يمكن أن يحتوي على قائمة فرعية. استخدم محرر العنصر لإضافة روابط مثل S24 Series أو iPhone 16.", "Chaque entrée peut contenir un sous-menu. Utilisez l’éditeur pour ajouter des liens comme Galaxy S24.")}</p>
        </div></article>
      </div>
      <div class="dash-panel" data-dash-panel="content-footer">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("أعمدة التذييل", "Colonnes du pied de page")}</h3></div><div class="dash-card-body dash-form">
          ${(settings.footerColumns || []).map((column, index) => `<div class="form-section"><h4>${ctx.dt("عمود", "Colonne")} ${index + 1}</h4><div class="form-grid">${["ar", "fr"].map((language) => `<div class="field"><label>${language.toUpperCase()}</label><input data-path="settings.footerColumns.${index}.title.${language}" value="${ctx.esc(column.title?.[language] || "")}" dir="${language === "ar" ? "rtl" : "ltr"}"></div>`).join("")}</div><div class="field" style="margin-top:8px"><label>${ctx.dt("روابط (اسم|رابط في كل سطر)", "Liens (nom|URL par ligne)")}</label><textarea rows="4" data-lines-path="settings.footerColumns.${index}.links">${ctx.esc((column.links || []).map((link) => `${link.label?.ar || ""}|${link.label?.fr || ""}|${link.href}`).join("\n"))}</textarea></div></div>`).join("")}
          <button class="btn btn-soft" data-action="add-footer-column">${ctx.icon("plus")} ${ctx.dt("إضافة عمود", "Ajouter une colonne")}</button>
        </div></article>
      </div>`;
  }

  function navEditor(index) {
    const isNew = index == null;
    const buffer = isNew
      ? {
          id: `nav-${Date.now().toString(36)}`,
          label: { ar: "عنصر جديد", fr: "Nouvel élément" },
          href: "collection.html?handle=all",
          visible: true,
          sub: []
        }
      : ctx.clone(ctx.model.settings.navigation[index]);
    ctx.editBuffer = buffer;
    ctx.openModal(
      isNew ? ctx.dt("عنصر قائمة", "Élément de navigation") : ctx.lng(buffer.label),
      `
      <div class="form-grid">
        ${ctx.editBi(ctx.dt("الاسم", "Nom"), "label", buffer.label)}
        ${ctx.editInput(ctx.dt("الرابط", "Lien"), "href", { value: buffer.href })}
        <div class="field span-2"><label>${ctx.dt("قائمة فرعية (اسم عربي|اسم فرنسي|رابط في كل سطر)", "Sous-menu (nom AR|nom FR|URL par ligne)")}</label><textarea rows="6" data-subnav>${ctx.esc((buffer.sub || []).map((item) => `${item.label?.ar || ""}|${item.label?.fr || ""}|${item.href}`).join("\n"))}</textarea></div>
        ${ctx.editToggle(ctx.dt("ظاهر", "Visible"), "visible", buffer.visible !== false)}
      </div>`,
      {
        footer: ctx.editorFooter(!isNew, "delete-nav-buffer"),
        onMount: () => {
          ctx.pendingNavIndex = isNew ? null : index;
        }
      }
    );
  }
  ctx.pendingNavIndex = null;

  function saveNavEditor() {
    const item = ctx.editBuffer;
    if (!item) return;
    const subNode = ctx.$("[data-subnav]");
    item.sub = (subNode?.value || "")
      .split("\n")
      .map((line) => {
        const [ar, fr, href] = line.split("|").map((part) => part.trim());
        return ar && href ? { label: { ar, fr: fr || ar }, href } : null;
      })
      .filter(Boolean);
    if (ctx.pendingNavIndex == null) ctx.model.settings.navigation.push(item);
    else ctx.model.settings.navigation[ctx.pendingNavIndex] = item;
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.renderRoute();
    ctx.toast(ctx.dt("تم حفظ عنصر القائمة", "Navigation enregistrée"), "good");
  }
}
