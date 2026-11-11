/* dashboard.js → Audit log
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

export function install(ctx) {
  Object.assign(ctx, { viewAudit });
  function viewAudit() {
    const logs = ctx.R.getAudit();
    return `
      <div class="dash-view-head"><div><h2>${ctx.dt("سجل النشاط", "Journal d’activité")}</h2><p>${ctx.dt("آخر 500 عملية في لوحة التحكم.", "Les 500 dernières actions du tableau de bord.")}</p></div><div class="dash-view-actions"><button class="btn btn-soft" data-action="clear-audit">${ctx.icon("trash")} ${ctx.dt("مسح السجل", "Effacer")}</button></div></div>
      <article class="dash-card"><div class="dash-card-body">${logs.length ? `<div class="list-editor">${logs.map((log) => `<div class="audit-row"><span class="audit-dot"></span><div><strong>${ctx.esc(log.action)}</strong><small>${ctx.esc(ctx.fmtDateTime(log.at))} · ${ctx.esc(log.actor || "system")}</small></div></div>`).join("")}</div>` : `<div class="empty-dash">${ctx.icon("audit")}<p>${ctx.dt("لا توجد عمليات مسجلة بعد.", "Aucune action enregistrée.")}</p></div>`}</div></article>`;
  }
}
