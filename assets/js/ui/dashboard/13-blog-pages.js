// @ts-check
/* dashboard.js → Blog and pages
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { viewBlog, postEditor, viewPages, pageEditor, savePageEditor, faqEditor });
  function viewBlog() {
    return `
      <div class="dash-view-head"><div><h2>${ctx.dt("المدونة", "Blog")}</h2><p>${ctx.dt("مقالات تساعد العملاء وتقوي SEO.", "Des articles utiles et bons pour le SEO.")}</p></div><div class="dash-view-actions"><button class="btn btn-primary" data-action="add-post">${ctx.icon("plus")} ${ctx.dt("مقال جديد", "Nouvel article")}</button></div></div>
      <div class="dash-card"><div class="dash-table-wrap"><table class="dash-table"><thead><tr><th>${ctx.dt("المقال", "Article")}</th><th>${ctx.dt("الرابط", "Slug")}</th><th>${ctx.dt("التاريخ", "Date")}</th><th>${ctx.dt("منشور", "Publié")}</th><th></th></tr></thead><tbody>
        ${(ctx.model.blog || []).map((post, index) => `<tr><td><div class="cell-main"><img src="${ctx.esc(post.image)}" alt=""><div><strong>${ctx.esc(ctx.lng(post.title))}</strong><small>${ctx.esc(ctx.lng(post.excerpt))}</small></div></div></td><td class="handle" style="direction:ltr">${ctx.esc(post.slug)}</td><td>${ctx.esc(post.date)}</td><td><span class="badge-soft ${post.published !== false ? "green" : ""}">${post.published !== false ? ctx.dt("منشور", "Publié") : ctx.dt("مسودة", "Brouillon")}</span></td><td><div class="cell-actions"><button class="btn btn-sm btn-soft" data-action="edit-post" data-index="${index}">${ctx.icon("edit")}</button><button class="btn btn-sm btn-soft" data-action="delete-post" data-index="${index}">${ctx.icon("trash")}</button></div></td></tr>`).join("")}
      </tbody></table></div></div>`;
  }

  ctx.pendingPostIndex = null;
  function postEditor(index) {
    const isNew = index == null;
    const buffer = isNew
      ? {
          id: `post-${Date.now().toString(36)}`,
          slug: `post-${Date.now().toString(36)}`,
          title: { ar: "", fr: "" },
          excerpt: { ar: "", fr: "" },
          body: { ar: "", fr: "" },
          image: "assets/img/category-iphone.svg",
          date: new Date().toISOString().slice(0, 10),
          published: true
        }
      : ctx.clone(ctx.model.blog[index]);
    ctx.editBuffer = buffer;
    ctx.pendingPostIndex = isNew ? null : index;
    ctx.openModal(
      isNew ? ctx.dt("مقال جديد", "Nouvel article") : ctx.lng(buffer.title),
      `
      <div class="form-grid">
        ${ctx.editBi(ctx.dt("العنوان", "Titre"), "title", buffer.title)}
        <div class="field"><label>${ctx.dt("الرابط", "Slug")}</label><input data-edit-path="slug" value="${ctx.esc(buffer.slug)}" dir="ltr"></div>
        <div class="field"><label>${ctx.dt("التاريخ", "Date")}</label><input type="date" data-edit-path="date" value="${ctx.esc(buffer.date)}"></div>
        ${ctx.editBi(ctx.dt("المقتطف", "Extrait"), "excerpt", buffer.excerpt, { type: "textarea", rows: 2 })}
        <div class="span-2">${ctx.imageEditor(ctx.dt("الصورة", "Image"), "image", buffer.image)}</div>
        ${ctx.editBi(ctx.dt("المحتوى", "Contenu"), "body", buffer.body, { type: "textarea", rows: 10 })}
        <div class="span-2">${ctx.editToggle(ctx.dt("نشر المقال", "Publier"), "published", buffer.published !== false)}</div>
      </div>`,
      {
        footer: `<button class="btn btn-soft btn-sm" data-action="close-modal">${ctx.dt("إلغاء", "Annuler")}</button><button class="btn btn-primary btn-sm" data-action="save-post" data-index="${isNew ? "" : index}">${ctx.dt("حفظ", "Enregistrer")}</button>`
      }
    );
  }

  function viewPages() {
    return `
      <div class="dash-view-head"><div><h2>${ctx.dt("الصفحات", "Pages")}</h2><p>${ctx.dt("الصفحات الثابتة والأسئلة الشائعة.", "Pages statiques et FAQ.")}</p></div></div>
      <div class="dash-tabs"><button class="active" data-dash-tab="pages-static">${ctx.dt("الصفحات", "Pages")}</button><button data-dash-tab="pages-faq">${ctx.dt("الأسئلة الشائعة", "FAQ")}</button></div>
      <div class="dash-panel active" data-dash-panel="pages-static">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("الصفحات الثابتة", "Pages statiques")}</h3><button data-action="add-page">${ctx.icon("plus")} ${ctx.dt("صفحة جديدة", "Nouvelle page")}</button></div><div class="dash-card-body"><div class="list-editor">
          ${(ctx.model.pages || []).map((page, index) => `<div class="list-row"><div class="grow"><strong>${ctx.esc(ctx.lng(page.title))}</strong><small class="handle">${ctx.esc(page.slug)}</small></div>${ctx.directToggle("", `pages.${index}.visible`, page.visible !== false)}<a class="btn btn-sm btn-soft" href="page.html?slug=${encodeURIComponent(page.slug)}" target="_blank" rel="noopener" title="${ctx.dt("معاينة", "Aperçu")}">${ctx.icon("external")}</a><button class="btn btn-sm btn-soft" data-action="edit-page" data-index="${index}">${ctx.icon("edit")}</button><button class="btn btn-sm btn-soft" data-action="delete-page" data-index="${index}">${ctx.icon("trash")}</button></div>`).join("")}
        </div></div></article>
      </div>
      <div class="dash-panel" data-dash-panel="pages-faq">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("الأسئلة الشائعة", "FAQ")}</h3><button data-action="add-faq">${ctx.icon("plus")} ${ctx.dt("سؤال جديد", "Nouvelle question")}</button></div><div class="dash-card-body"><div class="list-editor">
          ${(ctx.model.faqs || []).map((faq, index) => `<div class="list-row"><div class="grow"><strong>${ctx.esc(ctx.lng(faq.q))}</strong><small>${ctx.esc(ctx.lng(faq.a)).slice(0, 90)}</small></div><button class="btn btn-sm btn-soft" data-action="edit-faq" data-index="${index}">${ctx.icon("edit")}</button><button class="btn btn-sm btn-soft" data-action="delete-faq" data-index="${index}">${ctx.icon("trash")}</button></div>`).join("")}
        </div></div></article>
      </div>`;
  }

  ctx.pendingPageIndex = null;
  function pageEditor(index) {
    const isNew = index == null;
    const buffer = isNew
      ? {
          slug: `page-${Date.now().toString(36)}`,
          title: { ar: "", fr: "" },
          body: { ar: "", fr: "" },
          visible: true,
          seoTitle: { ar: "", fr: "" },
          seoDescription: { ar: "", fr: "" }
        }
      : ctx.clone(ctx.model.pages[index]);
    ctx.editBuffer = buffer;
    ctx.pendingPageIndex = isNew ? null : index;
    ctx.openModal(
      isNew ? ctx.dt("صفحة جديدة", "Nouvelle page") : ctx.lng(buffer.title),
      `
      <div class="form-grid">
        ${ctx.editBi(ctx.dt("العنوان", "Titre"), "title", buffer.title)}
        <div class="field"><label>${ctx.dt("الرابط", "Slug")}</label><input data-edit-path="slug" value="${ctx.esc(buffer.slug)}" dir="ltr"></div>
        ${ctx.editBi(ctx.dt("محتوى الصفحة", "Contenu"), "body", buffer.body, { type: "textarea", rows: 12 })}
        ${ctx.editBi(ctx.dt("عنوان SEO", "Titre SEO"), "seoTitle", buffer.seoTitle)}
        ${ctx.editBi(ctx.dt("وصف SEO", "Description SEO"), "seoDescription", buffer.seoDescription, { type: "textarea", rows: 2 })}
        <p class="form-note span-2">${ctx.dt("الرابط يستخدم حروفًا إنجليزية صغيرة وأرقامًا وشرطات فقط. يظهر المحتوى في المتجر مباشرة بعد النشر.", "Le slug utilise des minuscules, chiffres et tirets. Le contenu apparaît après publication.")}</p>
        ${ctx.editToggle(ctx.dt("ظاهرة", "Visible"), "visible", buffer.visible !== false)}
      </div>`,
      {
        footer: `<button class="btn btn-soft btn-sm" data-action="close-modal">${ctx.dt("إلغاء", "Annuler")}</button><button class="btn btn-primary btn-sm" data-action="save-page" data-index="${isNew ? "" : index}">${ctx.dt("حفظ", "Enregistrer")}</button>`
      }
    );
  }

  function savePageEditor() {
    if (!ctx.editBuffer) return;
    const slug = String(ctx.editBuffer.slug || "")
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
      return ctx.toast(
        ctx.dt("الرابط: حروف إنجليزية صغيرة وأرقام وشرطات فقط", "Slug : minuscules, chiffres et tirets uniquement"),
        "error"
      );
    }
    const duplicate = (ctx.model.pages || []).some(
      (page, index) => page.slug === slug && index !== ctx.pendingPageIndex
    );
    if (duplicate) return ctx.toast(ctx.dt("هذا الرابط مستخدم لصفحة أخرى", "Ce slug est déjà utilisé"), "error");
    if (!String(ctx.editBuffer.title?.ar || ctx.editBuffer.title?.fr || "").trim())
      return ctx.toast(ctx.dt("عنوان الصفحة مطلوب", "Le titre est requis"), "error");
    ctx.editBuffer.slug = slug;
    ctx.editBuffer.seoTitle = ctx.editBuffer.seoTitle || ctx.editBuffer.title;
    if (ctx.pendingPageIndex == null) ctx.model.pages.push(ctx.editBuffer);
    else ctx.model.pages[ctx.pendingPageIndex] = ctx.editBuffer;
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.renderRoute();
    ctx.toast(
      ctx.dt(
        "تم حفظ الصفحة في المسودة. انشر لتظهر للزوار.",
        "Page enregistrée en brouillon. Publiez pour la rendre visible."
      ),
      "good"
    );
  }

  function faqEditor(index) {
    const isNew = index == null;
    const buffer = isNew
      ? { id: `faq-${Date.now().toString(36)}`, q: { ar: "", fr: "" }, a: { ar: "", fr: "" } }
      : ctx.clone(ctx.model.faqs[index]);
    ctx.editBuffer = buffer;
    ctx.openModal(
      isNew ? ctx.dt("سؤال جديد", "Nouvelle question") : ctx.lng(buffer.q),
      `
      <div class="dash-form">${ctx.editBi(ctx.dt("السؤال", "Question"), "q", buffer.q)}${ctx.editBi(ctx.dt("الجواب", "Réponse"), "a", buffer.a, { type: "textarea", rows: 4 })}</div>`,
      {
        footer: `<button class="btn btn-soft btn-sm" data-action="close-modal">${ctx.dt("إلغاء", "Annuler")}</button><button class="btn btn-primary btn-sm" data-action="save-faq" data-index="${isNew ? "" : index}">${ctx.dt("حفظ", "Enregistrer")}</button>`
      }
    );
  }
}
