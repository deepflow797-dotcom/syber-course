// @ts-check
/* dashboard.js → Publish, preview and draft lifecycle
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { openPublishModal, publishNow });
  function openPublishModal() {
    ctx.saveDraftNow();
    const products = ctx.model.products.length;
    ctx.openModal(
      ctx.dt("نشر التغييرات", "Publier les changements"),
      `
      <div class="publish-modal-list">
        <div><span>${ctx.dt("المنتجات", "Produits")}</span><strong>${products}</strong></div>
        <div><span>${ctx.dt("الأقسام", "Sections")}</span><strong>${(ctx.model.settings.pageSections || []).filter((section) => section.visible !== false).length}</strong></div>
        <div><span>${ctx.dt("الطلبات", "Commandes")}</span><strong>${ctx.R.getOrders().length}</strong></div>
        <div><span>${ctx.dt("آخر تعديل", "Dernière modification")}</span><strong>${ctx.esc(ctx.fmtDateTime(ctx.model.updatedAt))}</strong></div>
        <div><span>${ctx.dt("مساحة المتجر", "Boutique")}</span><strong>${ctx.R.remote ? "Supabase" : ctx.dt("محلي", "Local")} · MRU</strong></div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:8px;background:var(--surface-2);border-radius:8px;padding:11px;margin-top:13px;font-size:10px;color:var(--muted);line-height:1.6">${ctx.icon("info")}<span>${ctx.dt("سيظهر المحتوى والألوان والمنتجات للزوار خلال ثوانٍ. يمكنك فتح المعاينة أولًا للتأكد.", "Le contenu, les couleurs et les produits seront visibles en quelques secondes. Ouvrez l’aperçu pour vérifier.")}</span></div>`,
      {
        footer: `<button class="btn btn-soft btn-sm" data-action="close-modal">${ctx.dt("إلغاء", "Annuler")}</button><button class="btn btn-soft btn-sm" data-action="preview">${ctx.icon("preview")} ${ctx.dt("معاينة", "Aperçu")}</button><button class="btn btn-primary btn-sm" data-action="confirm-publish">${ctx.icon("publish")} ${ctx.dt("نشر", "Publier")}</button>`
      }
    );
  }

  async function publishNow() {
    const button = ctx.$("[data-action='confirm-publish']");
    if (button) {
      button.disabled = true;
      button.textContent = ctx.dt("جارٍ النشر...", "Publication...");
    }
    try {
      const published = await ctx.R.publish(ctx.model);
      ctx.model = ctx.clone(published);
      ctx.dirty = false;
      ctx.closeModal();
      ctx.renderRoute();
      ctx.updateDraftState();
      ctx.R.addAudit(ctx.dt("نشر تحديث المتجر", "Publication de la boutique"));
      ctx.toast(ctx.dt("تم نشر التغييرات في المتجر", "Changements publiés sur la boutique"), "good");
    } catch (error) {
      ctx.toast(error.message || String(error), "error");
      if (button) {
        button.disabled = false;
        button.textContent = ctx.dt("نشر", "Publier");
      }
    }
  }
}
