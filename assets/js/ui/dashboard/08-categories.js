/* dashboard.js → Categories
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

export function install(ctx) {
  Object.assign(ctx, { viewCategories, categoryEditor, saveCategoryEditor, collectionEditor });
  function viewCategories() {
    return `
      <div class="dash-view-head">
        <div><h2>${ctx.dt("الفئات", "Catégories")}</h2><p>${ctx.dt("تظهر الفئات في القائمة والصفحة الرئيسية.", "Les catégories apparaissent dans le menu et l’accueil.")}</p></div>
        <div class="dash-view-actions"><button class="btn btn-primary" data-action="add-category">${ctx.icon("plus")} ${ctx.dt("فئة جديدة", "Nouvelle catégorie")}</button></div>
      </div>
      <div class="dash-grid cols-2">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("فئات المتجر", "Catégories boutique")}</h3><span class="badge-soft">${ctx.model.theme.categories.length}</span></div><div class="dash-card-body">
          <div class="list-editor">${ctx.model.theme.categories.map((category, index) => `<div class="list-row"><div class="grow"><strong>${ctx.esc(ctx.lng(category.label))}</strong><small class="handle">${ctx.esc(category.handle)}</small></div><button class="btn btn-sm btn-soft" data-action="edit-category" data-index="${index}">${ctx.icon("edit")}</button><button class="btn btn-sm btn-soft" data-action="delete-category" data-index="${index}">${ctx.icon("trash")}</button></div>`).join("")}</div>
        </div></article>
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("المجموعات", "Collections")}</h3><span class="badge-soft">${ctx.model.collections.length}</span></div><div class="dash-card-body">
          <div class="list-editor">${ctx.model.collections.map((collection, index) => `<div class="list-row"><div class="grow"><strong>${ctx.esc(ctx.lng(collection.title))}</strong><small class="handle">${ctx.esc(collection.handle)}</small></div>${ctx.directToggle("", `collections.${index}.visible`, collection.visible !== false)}<button class="btn btn-sm btn-soft" data-action="edit-collection" data-index="${index}">${ctx.icon("edit")}</button></div>`).join("")}</div>
        </div></article>
      </div>`;
  }

  function categoryEditor(index) {
    const isNew = index == null;
    const buffer = isNew
      ? {
          label: { ar: "فئة جديدة", fr: "Nouvelle catégorie" },
          handle: `category-${Date.now().toString(36)}`,
          image: "assets/img/category-iphone.svg"
        }
      : ctx.clone(ctx.model.theme.categories[index]);
    ctx.editBuffer = buffer;
    ctx.openModal(
      isNew ? ctx.dt("فئة جديدة", "Nouvelle catégorie") : ctx.lng(buffer.label),
      `
      <div class="form-grid">
        ${ctx.editBi(ctx.dt("اسم الفئة", "Nom"), "label", buffer.label)}
        <div class="field"><label>${ctx.dt("المعرف", "Identifiant")}</label><input data-edit-path="handle" value="${ctx.esc(buffer.handle)}" dir="ltr"></div>
        <div class="span-2">${ctx.imageEditor(ctx.dt("صورة الفئة", "Image"), "image", buffer.image)}</div>
      </div>`,
      {
        footer: ctx.editorFooter(!isNew, "delete-category-buffer"),
        onMount: () => {
          ctx.pendingCategoryIndex = isNew ? null : index;
        }
      }
    );
  }
  ctx.pendingCategoryIndex = null;

  function saveCategoryEditor() {
    const item = ctx.editBuffer;
    if (!item) return;
    if (ctx.pendingCategoryIndex == null) ctx.model.theme.categories.push(item);
    else ctx.model.theme.categories[ctx.pendingCategoryIndex] = item;
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.renderRoute();
    ctx.toast(ctx.dt("تم حفظ الفئة", "Catégorie enregistrée"), "good");
  }

  function collectionEditor(index) {
    const buffer = ctx.clone(ctx.model.collections[index]);
    ctx.editBuffer = buffer;
    ctx.openModal(
      ctx.lng(buffer.title),
      `
      <div class="form-grid">${ctx.editBi(ctx.dt("اسم المجموعة", "Nom de la collection"), "title", buffer.title)}<div class="field"><label>${ctx.dt("المعرف", "Identifiant")}</label><input value="${ctx.esc(buffer.handle)}" readonly dir="ltr"></div></div>`,
      {
        footer: `<button class="btn btn-soft btn-sm" data-action="close-modal">${ctx.dt("إلغاء", "Annuler")}</button><button class="btn btn-primary btn-sm" data-action="save-collection" data-index="${index}">${ctx.dt("حفظ", "Enregistrer")}</button>`
      }
    );
  }
}
