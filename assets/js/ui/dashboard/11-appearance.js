/* dashboard.js → Appearance
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

export function install(ctx) {
  Object.assign(ctx, { viewAppearance });
  function viewAppearance() {
    const fonts = ["Montserrat", "Tajawal", "Cairo", "Inter", "Poppins", "DM Sans"];
    return `
      <div class="dash-view-head"><div><h2>${ctx.dt("الهوية والألوان", "Identité & couleurs")}</h2><p>${ctx.dt("غيّر الشعار والألوان والخط. تظهر التغييرات في المتجر بعد النشر.", "Changez logo, couleurs et police. Les changements sont publiés sur la boutique.")}</p></div><div class="dash-view-actions"><button class="btn btn-soft" data-action="preview">${ctx.icon("preview")} ${ctx.dt("معاينة مباشرة", "Aperçu")}</button></div></div>
      <div class="dash-grid cols-2">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("الشعار والأيقونات", "Logo & icônes")}</h3></div><div class="dash-card-body dash-form">
          ${ctx.directImageEditor(ctx.dt("الشعار الأساسي", "Logo principal"), "settings.logo", ctx.model.settings.logo)}
          ${ctx.directImageEditor(ctx.dt("الشعار الأبيض", "Logo blanc"), "settings.logoWhite", ctx.model.settings.logoWhite)}
          ${ctx.directImageEditor(ctx.dt("أيقونة الموقع", "Favicon"), "settings.favicon", ctx.model.settings.favicon)}
          <div class="form-grid">${ctx.field(ctx.dt("الانحناء (px)", "Arrondi (px)"), "settings.radius", { type: "number" })}<div class="field"><label>${ctx.dt("خط الواجهة", "Police")}</label><select data-path="settings.font">${fonts.map((font) => `<option value="${font}" ${ctx.model.settings.font === font ? "selected" : ""}>${font}</option>`).join("")}</select></div></div>
        </div></article>
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("ألوان العلامة", "Couleurs de marque")}</h3></div><div class="dash-card-body dash-form">
          <div class="form-grid">
            ${ctx.field(ctx.dt("اللون الأساسي", "Couleur principale"), "settings.colors.primary", { type: "color" })}
            ${ctx.field(ctx.dt("اللون الثانوي", "Couleur secondaire"), "settings.colors.purple", { type: "color" })}
            ${ctx.field(ctx.dt("لون النص", "Couleur texte"), "settings.colors.ink", { type: "color" })}
            ${ctx.field(ctx.dt("الخلفية الفاتحة", "Fond clair"), "settings.colors.lavender", { type: "color" })}
          </div>
          <div style="border-radius:12px;padding:18px;background:var(--surface-2);border:1px solid var(--border);margin-top:4px">
            <span class="eyebrow">${ctx.dt("معاينة", "Aperçu")}</span>
            <h3 style="font-size:22px;margin:8px 0 6px">${ctx.esc(ctx.lng(ctx.model.settings.storeName))}</h3>
            <p style="font-size:11px;color:var(--muted);margin-bottom:12px">${ctx.esc(ctx.lng(ctx.model.settings.tagline))}</p>
            <button class="btn btn-primary btn-sm" type="button">${ctx.dt("تسوق الآن", "Découvrir")}</button>
            <button class="btn btn-soft btn-sm" type="button" style="margin-inline-start:5px">${ctx.dt("معرفة المزيد", "En savoir plus")}</button>
          </div>
          <p class="form-note">${ctx.dt("يوفر المتجر الوضع الفاتح والداكن تلقائيًا. الألوان تُطبّق على الأزرار، الشريط العلوي والعروض.", "Le mode clair/sombre est automatique. Les couleurs s’appliquent aux boutons, au header et aux offres.")}</p>
        </div></article>
      </div>
      <article class="dash-card" style="margin-top:14px"><div class="dash-card-head"><h3>${ctx.dt("الوضع الليلي والحركات", "Mode sombre et animations")}</h3></div><div class="dash-card-body"><div class="form-grid">${ctx.directToggle(ctx.dt("تفعيل الوضع الليلي للزوار", "Activer le mode sombre"), "settings.darkMode", ctx.model.settings.darkMode !== false)}${ctx.directToggle(ctx.dt("تفعيل الحركات", "Activer les animations"), "settings.animations", ctx.model.settings.animations !== false)}${ctx.directToggle(ctx.dt("تفعيل PWA", "Activer la PWA"), "settings.pwa", ctx.model.settings.pwa !== false)}</div></div></article>`;
  }
}
