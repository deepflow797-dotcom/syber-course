// @ts-check
/* dashboard.js → Settings
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { viewSettings });
  function viewSettings() {
    const settings = ctx.model.settings;
    return `
      <div class="dash-view-head"><div><h2>${ctx.dt("الإعدادات", "Réglages")}</h2><p>${ctx.dt("SEO، واتساب، الحماية والتكامل.", "SEO, WhatsApp, sécurité et intégration.")}</p></div><div class="dash-view-actions"><button class="btn btn-soft" data-action="discard-draft">${ctx.dt("إلغاء المسودة", "Annuler le brouillon")}</button><button class="btn btn-primary" data-action="save-draft">${ctx.icon("check")} ${ctx.dt("حفظ", "Enregistrer")}</button></div></div>
      <div class="dash-tabs"><button class="active" data-dash-tab="settings-seo">SEO</button><button data-dash-tab="settings-whatsapp">WhatsApp</button><button data-dash-tab="settings-security">${ctx.dt("الحماية", "Sécurité")}</button><button data-dash-tab="settings-advanced">${ctx.dt("متقدم", "Avancé")}</button></div>
      <div class="dash-panel active" data-dash-panel="settings-seo">
        <div class="dash-grid cols-2">
          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("محركات البحث", "Référencement")}</h3></div><div class="dash-card-body dash-form">
            ${ctx.biField(ctx.dt("عنوان SEO", "Titre SEO"), "settings.seo.title")}
            ${ctx.biField(ctx.dt("وصف SEO", "Description SEO"), "settings.seo.description", { type: "textarea", rows: 3 })}
            <div class="form-grid">${ctx.field(ctx.dt("الرابط الأساسي", "URL de base"), "settings.baseUrl", { placeholder: "https://example.com" })}${ctx.field(ctx.dt("صورة المشاركة", "Image de partage"), "settings.seo.image", { placeholder: "assets/img/..." })}</div>
            <p class="form-note">${ctx.dt("يُستخدم عنوان ووصف SEO في كل صفحة، وتُضاف بيانات المنتج المنظمة تلقائيًا.", "Titres et descriptions sont appliqués par page ; les données produit structurées sont ajoutées automatiquement.")}</p>
          </div></article>
          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("بكسلات التحليلات", "Pixels analytiques")}</h3></div><div class="dash-card-body dash-form">
            ${ctx.field("Meta Pixel ID", "settings.pixels.meta", { placeholder: "1234567890" })}
            ${ctx.field("TikTok Pixel ID", "settings.pixels.tiktok", { placeholder: "C..." })}
            ${ctx.field("Google Analytics ID", "settings.pixels.ga", { placeholder: "G-XXXXXXX" })}
            <p class="form-note">${ctx.dt("تُحمّل الأكواد تلقائيًا في المتجر بعد النشر. لا تضع أكوادًا كاملة، فقط المعرف.", "Les scripts sont chargés automatiquement. Indiquez uniquement l’identifiant.")}</p>
            ${ctx.directToggle(ctx.dt("تفعيل PWA للجوال", "Activer la PWA mobile"), "settings.pwa", settings.pwa !== false)}
          </div></article>
        </div>
      </div>
      <div class="dash-panel" data-dash-panel="settings-whatsapp">
        <div class="dash-grid cols-2">
          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("رسالة الطلب", "Message de commande")}</h3></div><div class="dash-card-body dash-form">
            ${ctx.biField(ctx.dt("القالب الكامل", "Modèle complet"), "settings.orderTemplate", { type: "textarea", rows: 13 })}
            <p class="form-note">${ctx.dt("المتغيرات: {store} {order_id} {name} {phone} {city} {address} {payment} {items} {subtotal} {shipping} {discount} {total} {notes}", "Variables : {store} {order_id} {name} {phone} {city} {address} {payment} {items} {subtotal} {shipping} {discount} {total} {notes}")}</p>
            ${ctx.field("WhatsApp", "settings.whatsapp", { hint: ctx.dt("الرقم الذي تستقبل عليه الطلبات", "Numéro qui reçoit les commandes") })}
          </div></article>
          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("رسائل المتابعة", "Messages de suivi")}</h3></div><div class="dash-card-body dash-form">
            ${ctx.biField(ctx.dt("تأكيد الطلب", "Confirmation"), "settings.whatsappTemplates.confirm", { type: "textarea", rows: 3 })}
            ${ctx.biField(ctx.dt("تم الشحن", "Expédition"), "settings.whatsappTemplates.shipped", { type: "textarea", rows: 3 })}
            ${ctx.biField(ctx.dt("تم التسليم", "Livraison"), "settings.whatsappTemplates.delivered", { type: "textarea", rows: 3 })}
          </div></article>
        </div>
      </div>
      <div class="dash-panel" data-dash-panel="settings-security">
        <div class="dash-grid cols-2">
          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("الحماية من الطلبات المزعجة", "Protection anti-spam")}</h3></div><div class="dash-card-body dash-form">
            ${ctx.field(ctx.dt("الفاصل الزمني بين الطلبات (ثانية)", "Délai entre commandes (secondes)"), "settings.rateLimitSeconds", { type: "number" })}
            <div class="field"><label>${ctx.dt("قائمة الحظر (رقم في كل سطر)", "Liste de blocage (un numéro par ligne)")}</label><textarea data-blocklist rows="7" dir="ltr">${ctx.esc((settings.blocklist || []).join("\n"))}</textarea></div>
            <p class="form-note">${ctx.dt("تُطبق القائمة على أرقام الهواتف بصيغة 222XXXXXXXX.", "La liste s’applique aux numéros au format 222XXXXXXXX.")}</p>
            ${ctx.directToggle(ctx.dt("طلب رمز تحقق OTP (قريبًا)", "Vérification OTP (bientôt)"), "settings.otp.enabled", settings.otp?.enabled)}
          </div></article>
          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("المخزون والمنتجات", "Stock & produits")}</h3></div><div class="dash-card-body dash-form">
            ${ctx.field(ctx.dt("حد المخزون المنخفض", "Seuil de stock faible"), "settings.lowStockThreshold", { type: "number" })}
            ${ctx.directToggle(ctx.dt("إخفاء المنتجات المنتهية تلقائيًا", "Masquer automatiquement les produits épuisés"), "settings.autoHideOutOfStock", settings.autoHideOutOfStock !== false)}
            ${ctx.directToggle(ctx.dt("إظهار بيانات تجريبية حتى إدخال بياناتك", "Afficher les données de démo jusqu’à vos données"), "settings.fakeData", settings.fakeData !== false)}
            ${ctx.directToggle(ctx.dt("الوضع الليلي", "Mode sombre"), "settings.darkMode", settings.darkMode !== false)}
          </div></article>
        </div>
      </div>
      <div class="dash-panel" data-dash-panel="settings-advanced">
        <div class="dash-grid cols-2">
          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("التكامل والاستضافة", "Intégration & hébergement")}</h3></div><div class="dash-card-body">
            <div class="publish-modal-list">
              <div><span>${ctx.dt("وضع البيانات", "Mode données")}</span><strong>${ctx.R.remote ? "Supabase" : ctx.dt("محلي تجريبي", "Local démo")}</strong></div>
              <div><span>Supabase URL</span><strong class="u-fs-8" dir="ltr">${ctx.esc(ctx.R.config.supabaseUrl || ctx.dt("غير مهيأ", "Non configuré"))}</strong></div>
              <div><span>${ctx.dt("المشروع", "Projet")}</span><strong>${ctx.esc(ctx.L(ctx.model.settings.legalName || ctx.model.settings.storeName))}</strong></div>
              <div><span>${ctx.dt("نطاق البيع", "Périmètre")}</span><strong>MRU · Mauritanie</strong></div>
            </div>
            <div class="field u-mt-12"><label>${ctx.dt("العملة المعروضة افتراضيًا", "Affichage de la devise par défaut")}</label><select data-currency-mode>
              <option value="new" ${ctx.R.getCurrencyMode() === "new" ? "selected" : ""}>${ctx.dt("أوقية جديدة (MRU)", "Nouvelle ouguiya (MRU)")}</option>
              <option value="old" ${ctx.R.getCurrencyMode() === "old" ? "selected" : ""}>${ctx.dt("أوقية قديمة (MRO) = القيمة × 10", "Ancienne ouguiya (MRO) = valeur × 10")}</option>
            </select><p class="form-note">${ctx.dt("يمكن للزائر تبديلها من رأس المتجر. الأسعار محفوظة بالأوقية الجديدة.", "Le visiteur peut la changer dans l’en-tête. Les prix restent en nouvelle ouguiya.")}</p></div>
            <p class="form-note u-mt-11">${ctx.dt("لربط Supabase: ضع URL و anon key في config.js ثم نفّذ ملف supabase/schema.sql. ستتزامن الطلبات والحالة تلقائيًا.", "Pour Supabase : renseignez URL et anon key dans config.js puis exécutez supabase/schema.sql.")}</p>
            <a class="btn btn-soft btn-sm" href="supabase/schema.sql" target="_blank">${ctx.dt("عرض ملف SQL", "Voir le fichier SQL")}</a>
          </div></article>
          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("منطقة الخطر", "Zone sensible")}</h3></div><div class="dash-card-body">
            <p class="u-fs-10 u-muted u-lh-18 u-mb-12">${ctx.dt("إعادة تعيين البيانات التجريبية ستحذف الطلبات والمسودات والحسابات المحلية. لا يمكن التراجع.", "Réinitialiser la démo supprime commandes, brouillons et comptes locaux. Action irréversible.")}</p>
            <div class="u-flex u-gap-7 u-wrap"><button class="btn btn-soft btn-sm" data-action="publish">${ctx.icon("publish")} ${ctx.dt("نشر الآن", "Publier")}</button><button class="btn btn-danger btn-sm" data-action="reset-demo">${ctx.icon("trash")} ${ctx.dt("إعادة تعيين التجربة", "Réinitialiser la démo")}</button></div>
          </div></article>
        </div>
      </div>`;
  }
}
