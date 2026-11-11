/* dashboard.js → Reviews
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

export function install(ctx) {
  Object.assign(ctx, { viewReviews, reviewEditor, saveReviewEditor });
  function viewReviews() {
    if (!Array.isArray(ctx.model.reviews)) ctx.model.reviews = [];
    const home = ctx.model.homeReviews || [];
    const allCustomer = ctx.R.getAllCustomerReviews();
    const pending = allCustomer.filter((review) => review.status === "pending");
    const approved = allCustomer.filter((review) => review.status === "approved");
    const rejected = allCustomer.filter((review) => review.status === "rejected");
    if (!viewReviews.refreshed) {
      viewReviews.refreshed = true;
      ctx.R.refreshReviews().catch(() => {});
    }
    const customerRow = (review, actions) => `<div class="list-row review-pending-row">
      <div class="grow">
        <strong>${ctx.esc(review.customerName)} <span style="color:#f5a623">${"★".repeat(Number(review.rating) || 5)}</span></strong>
        <small>${ctx.esc(review.productHandle)} — ${ctx.esc(ctx.L(review.title))}</small>
        <p class="review-body-preview">${ctx.esc(String(ctx.L(review.body)).slice(0, 160))}${String(ctx.L(review.body)).length > 160 ? "…" : ""}</p>
        <small class="review-date">${ctx.esc(ctx.R.formatDate(review.createdAt))}${review.email ? ` · ${ctx.esc(review.email)}` : ""}</small>
      </div>
      <div class="cell-actions">${actions}</div>
    </div>`;
    return `
      <div class="dash-view-head"><div><h2>${ctx.dt("التقييمات", "Avis clients")}</h2><p>${ctx.dt("إدارة تقييمات الصفحة الرئيسية، المنتجات، وتقييمات العملاء.", "Gestion des avis accueil, produits et avis clients.")}</p></div></div>
      <div class="dash-tabs">
        <button class="active" data-dash-tab="reviews-home">${ctx.dt("الرئيسية", "Accueil")} <span class="badge-soft">${home.length}</span></button>
        <button data-dash-tab="reviews-products">${ctx.dt("المنتجات", "Produits")} <span class="badge-soft">${(ctx.model.reviews || []).length}</span></button>
        <button data-dash-tab="reviews-customers">${ctx.dt("العملاء", "Clients")} <span class="badge-soft ${pending.length ? "orange" : ""}">${pending.length}</span></button>
      </div>
      <div class="dash-panel active" data-dash-panel="reviews-home">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("آراء الصفحة الرئيسية", "Avis page d’accueil")}</h3><button class="btn btn-primary btn-sm" data-action="add-home-review">${ctx.icon("plus")} ${ctx.dt("إضافة", "Ajouter")}</button></div><div class="dash-card-body"><div class="list-editor">
          ${home.map((review, index) => `<div class="list-row"><div class="grow"><strong>${ctx.esc(review.name)} <span style="color:#f5a623">${"★".repeat(Number(review.rating) || 5)}</span></strong><small>${ctx.esc(ctx.L(review.title))} — ${ctx.esc(ctx.L(review.city))}</small></div><button class="btn btn-sm btn-soft" data-action="edit-home-review" data-index="${index}">${ctx.icon("edit")}</button><button class="btn btn-sm btn-soft" data-action="delete-home-review" data-index="${index}">${ctx.icon("trash")}</button></div>`).join("") || `<div class="empty-dash">${ctx.dt("لا توجد تقييمات.", "Aucun avis.")}</div>`}
        </div></div></article>
      </div>
      <div class="dash-panel" data-dash-panel="reviews-products">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("تقييمات المنتجات", "Avis produits")}</h3><button class="btn btn-soft" data-action="add-product-review">${ctx.icon("plus")} ${ctx.dt("إضافة", "Ajouter")}</button></div><div class="dash-card-body"><div class="list-editor">
          ${(ctx.model.reviews || []).map((review, index) => `<div class="list-row"><div class="grow"><strong>${ctx.esc(review.name)} <span style="color:#f5a623">${"★".repeat(Number(review.rating) || 5)}</span></strong><small>${ctx.esc(review.handle)} — ${ctx.esc(ctx.L(review.title))}</small></div><label class="toggle"><input type="checkbox" data-review-approved="${index}" ${review.approved !== false ? "checked" : ""}><span></span></label><button class="btn btn-sm btn-soft" data-action="edit-product-review" data-index="${index}">${ctx.icon("edit")}</button><button class="btn btn-sm btn-soft" data-action="delete-product-review" data-index="${index}">${ctx.icon("trash")}</button></div>`).join("") || `<div class="empty-dash">${ctx.dt("لا توجد تقييمات منتجات مخصصة.", "Aucun avis produit dédié.")}</div>`}
        </div></div></article>
      </div>
      <div class="dash-panel" data-dash-panel="reviews-customers">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("تقييمات العملاء المعلقة", "Avis clients en attente")}</h3><span class="badge-soft orange">${pending.length}</span></div><div class="dash-card-body">
          ${
            pending.length
              ? `<div class="list-editor">
            ${pending
              .map((review) =>
                customerRow(
                  review,
                  `
              <button class="btn btn-sm btn-success" data-action="approve-customer-review" data-id="${ctx.esc(review.id)}">${ctx.icon("check")} ${ctx.dt("اعتماد", "Approuver")}</button>
              <button class="btn btn-sm btn-danger" data-action="reject-customer-review" data-id="${ctx.esc(review.id)}">${ctx.icon("trash")} ${ctx.dt("رفض", "Refuser")}</button>`
                )
              )
              .join("")}
          </div>`
              : `<div class="empty-dash">${ctx.dt("لا توجد تقييمات معلقة.", "Aucun avis en attente.")}</div>`
          }
        </div></article>
        ${
          approved.length
            ? `<article class="dash-card" style="margin-top:14px"><div class="dash-card-head"><h3>${ctx.dt("المعتمدة", "Approuvés")}</h3><span class="badge-soft green">${approved.length}</span></div><div class="dash-card-body"><div class="list-editor">
          ${approved
            .map((review) =>
              customerRow(
                review,
                `
            <a class="btn btn-sm btn-soft" href="product.html?handle=${encodeURIComponent(review.productHandle)}" target="_blank" rel="noopener">${ctx.icon("external")}</a>
            <button class="btn btn-sm btn-soft" data-action="reject-customer-review" data-id="${ctx.esc(review.id)}">${ctx.icon("close")} ${ctx.dt("إلغاء الاعتماد", "Retirer")}</button>
            <button class="btn btn-sm btn-soft" data-action="delete-customer-review" data-id="${ctx.esc(review.id)}">${ctx.icon("trash")}</button>`
              )
            )
            .join("")}
        </div></div></article>`
            : ""
        }
        ${
          rejected.length
            ? `<article class="dash-card" style="margin-top:14px"><div class="dash-card-head"><h3>${ctx.dt("المرفوضة", "Rejetés")}</h3><span class="badge-soft">${rejected.length}</span></div><div class="dash-card-body"><div class="list-editor">
          ${rejected
            .map((review) =>
              customerRow(
                review,
                `
            <button class="btn btn-sm btn-success" data-action="approve-customer-review" data-id="${ctx.esc(review.id)}">${ctx.icon("check")} ${ctx.dt("اعتماد", "Approuver")}</button>
            <button class="btn btn-sm btn-soft" data-action="delete-customer-review" data-id="${ctx.esc(review.id)}">${ctx.icon("trash")}</button>`
              )
            )
            .join("")}
        </div></div></article>`
            : ""
        }
      </div>`;
  }
  ctx.pendingReviewKind = "home";
  ctx.pendingReviewIndex = null;
  function reviewEditor(kind, index) {
    const isNew = index == null;
    const source = kind === "home" ? ctx.model.homeReviews || [] : ctx.model.reviews || [];
    const buffer = isNew
      ? {
          id: `review-${Date.now().toString(36)}`,
          name: "",
          city: { ar: "نواكشوط", fr: "Nouakchott" },
          rating: 5,
          title: { ar: "", fr: "" },
          body: { ar: "", fr: "" },
          color: "#2e7d6f",
          handle: "",
          verified: true,
          approved: true
        }
      : ctx.clone(source[index]);
    ctx.editBuffer = buffer;
    ctx.pendingReviewKind = kind;
    ctx.pendingReviewIndex = isNew ? null : index;
    ctx.openModal(
      isNew ? ctx.dt("تقييم جديد", "Nouvel avis") : ctx.dt("تعديل التقييم", "Modifier l’avis"),
      `
      <div class="form-grid">
        <div class="field"><label>${ctx.dt("اسم العميل", "Nom")}</label><input data-edit-path="name" value="${ctx.esc(buffer.name)}"></div>
        <div class="field"><label>${ctx.dt("التقييم", "Note")}</label><select data-edit-path="rating">${[5, 4, 3, 2, 1].map((value) => `<option value="${value}" ${Number(buffer.rating) === value ? "selected" : ""}>${"★".repeat(value)}</option>`).join("")}</select></div>
        ${ctx.editBi(ctx.dt("المدينة", "Ville"), "city", buffer.city)}
        ${kind === "product" ? `<div class="field"><label>${ctx.dt("المنتج", "Produit")}</label><select data-edit-path="handle">${ctx.model.products.map((product) => `<option value="${ctx.esc(product.handle)}" ${product.handle === buffer.handle ? "selected" : ""}>${ctx.esc(product.title)}</option>`).join("")}</select></div>` : `<div class="field"><label>${ctx.dt("لون الصورة الرمزية", "Couleur avatar")}</label><input type="color" data-edit-path="color" value="${ctx.esc(buffer.color || "#2e7d6f")}"></div>`}
        ${ctx.editBi(ctx.dt("عنوان التقييم", "Titre"), "title", buffer.title)}
        <div class="span-2">${ctx.editBi(ctx.dt("نص التقييم", "Contenu"), "body", buffer.body, { type: "textarea", rows: 4 })}</div>
        ${kind === "product" ? `<div class="span-2">${ctx.editToggle(ctx.dt("شراء موثق", "Achat vérifié"), "verified", buffer.verified !== false)}${ctx.editToggle(ctx.dt("معتمد للنشر", "Approuvé"), "approved", buffer.approved !== false)}</div>` : ""}
      </div>`,
      {
        footer: ctx.editorFooter(!isNew, "delete-review-buffer")
      }
    );
  }

  function saveReviewEditor() {
    if (!ctx.editBuffer) return;
    const list =
      ctx.pendingReviewKind === "home" ? ctx.model.homeReviews : ctx.model.reviews || (ctx.model.reviews = []);
    if (ctx.pendingReviewIndex == null) list.push(ctx.editBuffer);
    else list[ctx.pendingReviewIndex] = ctx.editBuffer;
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.renderRoute();
    ctx.toast(ctx.dt("تم حفظ التقييم", "Avis enregistré"), "good");
  }
}
