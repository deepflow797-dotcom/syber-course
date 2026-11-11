// @ts-check
/* dashboard.js → Homepage
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { viewHomepage, heroEditor, saveHeroEditor, homeSectionEditor, moveInArray });
  const PAGE_SECTION_LABELS = {
    hero: { ar: "السلايدر الرئيسي", fr: "Hero / Slider" },
    trust: { ar: "شريط الثقة", fr: "Barre de confiance" },
    renewed: { ar: "ما معنى مجدد", fr: "Reconditionné" },
    categories: { ar: "الفئات", fr: "Catégories" },
    offer: { ar: "عرض بنكيلي", fr: "Offre Bankily" },
    products: { ar: "أقسام المنتجات", fr: "Sections produits" },
    sustain: { ar: "الاستدامة", fr: "Durabilité" },
    service: { ar: "الخدمات", fr: "Services" },
    video: { ar: "المجتمع والفيديو", fr: "Communauté & vidéo" },
    reviews: { ar: "آراء العملاء", fr: "Avis clients" },
    press: { ar: "الصحافة", fr: "Presse" }
  };

  function viewHomepage() {
    const sections = [...(ctx.model.settings.pageSections || [])].sort((a, b) => Number(a.order) - Number(b.order));
    const productSections = [...(ctx.model.settings.homeSections || [])].sort(
      (a, b) => Number(a.order) - Number(b.order)
    );
    return `
      <div class="dash-view-head">
        <div><h2>${ctx.dt("الصفحة الرئيسية", "Page d’accueil")}</h2><p>${ctx.dt("أعد ترتيب الأقسام، أخفِ أي قسم، وعدّل السلايدر والعروض.", "Réorganisez les sections, masquez-en et modifiez le slider.")}</p></div>
        <div class="dash-view-actions"><button class="btn btn-soft" data-action="preview">${ctx.icon("preview")} ${ctx.dt("معاينة", "Aperçu")}</button></div>
      </div>
      <div class="dash-tabs"><button class="active" data-dash-tab="home-sections">${ctx.dt("ترتيب الأقسام", "Ordre des sections")}</button><button data-dash-tab="home-hero">${ctx.dt("السلايدر", "Slider")}</button><button data-dash-tab="home-products">${ctx.dt("أقسام المنتجات", "Sections produits")}</button></div>
      <div class="dash-panel active" data-dash-panel="home-sections">
        <div class="dash-grid cols-2">
          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("أقسام الصفحة", "Sections de la page")}</h3><span class="badge-soft">${sections.filter((section) => section.visible !== false).length}/${sections.length}</span></div><div class="dash-card-body"><div class="list-editor">
            ${sections.map((section, index) => `<div class="list-row"><span class="drag">${ctx.icon("arrows")}</span><div class="grow"><strong>${ctx.esc(PAGE_SECTION_LABELS[section.id]?.[ctx.dashLang] || section.id)}</strong><small>${section.id}</small></div><div class="row-actions"><button class="btn btn-sm btn-soft" data-action="page-section-up" data-id="${section.id}" ${index === 0 ? "disabled" : ""}>${ctx.icon("up")}</button><button class="btn btn-sm btn-soft" data-action="page-section-down" data-id="${section.id}" ${index === sections.length - 1 ? "disabled" : ""}>${ctx.icon("down")}</button><label class="toggle"><input type="checkbox" data-page-section-visible="${section.id}" ${section.visible !== false ? "checked" : ""}><span></span></label></div></div>`).join("")}
          </div><p class="form-note u-mt-10">${ctx.dt("التغييرات تظهر في المعاينة فورًا وتُنشر عند الضغط على نشر.", "Les changements apparaissent dans l’aperçu et sont publiés via Publier.")}</p></div></article>
          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("معاينة الترتيب", "Aperçu de l’ordre")}</h3></div><div class="dash-card-body">
            <div class="u-border u-r-10 u-p-10 u-grid u-gap-5 u-surface-2">
              ${sections
                .filter((section) => section.visible !== false)
                .map(
                  (section, index) =>
                    `<div class="u-surface u-border u-r-6 u-p-7 u-fs-9 u-flex u-justify-between"><span>${index + 1}. ${ctx.esc(PAGE_SECTION_LABELS[section.id]?.[ctx.dashLang] || section.id)}</span><span class="u-soft">${section.id}</span></div>`
                )
                .join("")}
            </div>
          </div></article>
        </div>
      </div>
      <div class="dash-panel" data-dash-panel="home-hero">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("شرائح السلايدر", "Diapositives")}</h3><button data-action="add-hero">${ctx.icon("plus")} ${ctx.dt("إضافة شريحة", "Ajouter")}</button></div><div class="dash-card-body">
          <div class="list-editor">${(ctx.model.settings.heroSlides || []).map((slide, index) => `<div class="list-row"><span class="image-preview u-sq-44 u-basis-44"><img src="${ctx.esc(slide.image)}" alt=""></span><div class="grow"><strong>${ctx.esc(ctx.lng(slide.title))}</strong><small>${ctx.esc(slide.href)}</small></div>${ctx.directToggle("", `settings.heroSlides.${index}.visible`, slide.visible !== false)}<button class="btn btn-sm btn-soft" data-action="edit-hero" data-index="${index}">${ctx.icon("edit")}</button><button class="btn btn-sm btn-soft" data-action="delete-hero" data-index="${index}">${ctx.icon("trash")}</button></div>`).join("")}</div>
          <p class="form-note u-mt-10">${ctx.dt("ضع صورة بخلفية شفافة للحصول على أفضل نتيجة. يمكن استخدام رابط أو رفع صورة.", "Utilisez une image à fond transparent. URL ou téléversement.")}</p>
        </div></article>
      </div>
      <div class="dash-panel" data-dash-panel="home-products">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("أقسام المنتجات على الرئيسية", "Sections produits")}</h3></div><div class="dash-card-body">
          <div class="list-editor">${productSections.map((section, index) => `<div class="list-row"><span class="drag">${ctx.icon("arrows")}</span><div class="grow"><strong>${ctx.esc(ctx.lng(section.title))}</strong><small class="handle">${ctx.esc(section.collection || "")} · ${ctx.esc(section.layout)}</small></div><div class="row-actions"><button class="btn btn-sm btn-soft" data-action="home-section-up" data-id="${section.id}" ${index === 0 ? "disabled" : ""}>${ctx.icon("up")}</button><button class="btn btn-sm btn-soft" data-action="home-section-down" data-id="${section.id}" ${index === productSections.length - 1 ? "disabled" : ""}>${ctx.icon("down")}</button><label class="toggle"><input type="checkbox" data-home-section-visible="${section.id}" ${section.visible !== false ? "checked" : ""}><span></span></label><button class="btn btn-sm btn-soft" data-action="edit-home-section" data-id="${section.id}">${ctx.icon("edit")}</button></div></div>`).join("")}</div>
          <button class="btn btn-soft u-mt-10" data-action="add-home-section">${ctx.icon("plus")} ${ctx.dt("إضافة قسم منتجات", "Ajouter une section")}</button>
        </div></article>
      </div>`;
  }

  ctx.pendingHeroIndex = null;
  function heroEditor(index) {
    const isNew = index == null;
    const buffer = isNew
      ? {
          id: `hero-${Date.now().toString(36)}`,
          visible: true,
          title: { ar: "", fr: "" },
          subtitle: { ar: "", fr: "" },
          cta: { ar: "تسوق الآن", fr: "Découvrir" },
          href: "collection.html?handle=all",
          image: "assets/img/hero-iphone.svg",
          bg: "linear-gradient(135deg,#1f1f2e 0%,#39255b 55%,#ff6400 130%)",
          dark: true
        }
      : ctx.clone(ctx.model.settings.heroSlides[index]);
    ctx.editBuffer = buffer;
    ctx.pendingHeroIndex = isNew ? null : index;
    ctx.openModal(
      isNew ? ctx.dt("شريحة جديدة", "Nouvelle diapositive") : ctx.lng(buffer.title),
      `
      <div class="form-grid">
        ${ctx.editBi(ctx.dt("العنوان", "Titre"), "title", buffer.title)}
        ${ctx.editBi(ctx.dt("العنوان الفرعي", "Sous-titre"), "subtitle", buffer.subtitle, { type: "textarea", rows: 3 })}
        ${ctx.editBi(ctx.dt("زر الدعوة", "Bouton"), "cta", buffer.cta)}
        ${ctx.editInput(ctx.dt("رابط الزر", "Lien du bouton"), "href", { value: buffer.href })}
        <div class="field span-2"><label>CSS background</label><input data-edit-path="bg" value="${ctx.esc(buffer.bg)}" dir="ltr"></div>
        <div class="field span-2">${ctx.imageEditor(ctx.dt("صورة الجهاز", "Image appareil"), "image", buffer.image)}</div>
        <div class="span-2">${ctx.editToggle(ctx.dt("نص داكن على خلفية فاتحة", "Texte foncé sur fond clair"), "dark", buffer.dark === false)}</div>
      </div>`,
      {
        footer: ctx.editorFooter(!isNew, "delete-hero-buffer")
      }
    );
  }
  function saveHeroEditor() {
    if (!ctx.editBuffer) return;
    if (ctx.pendingHeroIndex == null) ctx.model.settings.heroSlides.push(ctx.editBuffer);
    else ctx.model.settings.heroSlides[ctx.pendingHeroIndex] = ctx.editBuffer;
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.renderRoute();
    ctx.toast(ctx.dt("تم حفظ السلايدر", "Slider enregistré"), "good");
  }

  function homeSectionEditor(id) {
    const index = ctx.model.settings.homeSections.findIndex((section) => section.id === id);
    if (index < 0) return;
    const buffer = ctx.clone(ctx.model.settings.homeSections[index]);
    ctx.editBuffer = buffer;
    ctx.openModal(
      ctx.lng(buffer.title),
      `
      <div class="form-grid">
        ${ctx.editBi(ctx.dt("العنوان", "Titre"), "title", buffer.title)}
        <div class="field"><label>${ctx.dt("المجموعة", "Collection")}</label><select data-edit-path="collection">${ctx.model.collections.map((collection) => `<option value="${ctx.esc(collection.handle)}" ${collection.handle === buffer.collection ? "selected" : ""}>${ctx.esc(ctx.lng(collection.title))}</option>`).join("")}</select></div>
        <div class="field"><label>${ctx.dt("التخطيط", "Disposition")}</label><select data-edit-path="layout">${["plain", "left", "right"].map((layout) => `<option ${buffer.layout === layout ? "selected" : ""}>${layout}</option>`).join("")}</select></div>
        <div class="field span-2">${ctx.imageEditor(ctx.dt("صورة البانر الجانبي", "Image promo"), "promo", buffer.promo || "")}</div>
        <div class="span-2">${ctx.editToggle(ctx.dt("إظهار شعلة", "Afficher la flamme"), "flame", Boolean(buffer.flame))}</div>
      </div>`,
      {
        footer: `<button class="btn btn-soft btn-sm" data-action="close-modal">${ctx.dt("إلغاء", "Annuler")}</button><button class="btn btn-primary btn-sm" data-action="save-home-section" data-id="${id}">${ctx.dt("حفظ", "Enregistrer")}</button>`
      }
    );
  }

  function moveInArray(array, index, direction) {
    const target = index + direction;
    if (target < 0 || target >= array.length) return;
    [array[index], array[target]] = [array[target], array[index]];
    array.forEach((item, position) => {
      item.order = position + 1;
    });
  }
  Object.assign(ctx, { PAGE_SECTION_LABELS });
}
