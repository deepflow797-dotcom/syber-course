// @ts-check
/* dashboard.js → Backup & restore (P4)
   The dashboard half of `services/15-backup.js`: a card in Réglages ▸ Avancé to download a self-contained JSON copy of
   the store, and an import flow that shows what the file contains and what would change *before* anything is written.
   Everything user-visible is a button in the action tables (22c/22d), so no inline handlers are needed (CSP-safe). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { backupCardHTML, backupAskImport, backupDoApply, backupDoUndo, backupExportNow: exportNow });

  const fmt = (value) => (value == null ? "—" : String(value));

  /** Downloads `text` as `fileName` without touching the network. */
  function download(fileName, text) {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // give the browser a tick to start the download before the URL is revoked
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  /** The export/import card body — rendered inside Réglages ▸ Avancé. */
  function backupCardHTML() {
    const counts = ctx.countsOfModel ? ctx.countsOfModel() : { products: ctx.model.products.length };
    return `
      <div class="dash-card-body">
        <p class="u-fs-10 u-muted u-lh-18 u-mb-12">${ctx.dt(
          "ملف واحد يحتوي الإعدادات والمنتجات والأقسام والصفحات. يُستخدم للنقل إلى استضافة أخرى أو للرجوع عند خطأ.",
          "Un seul fichier : réglages, produits, sections et pages. Pour migrer d’hôte ou revenir en arrière."
        )}</p>
        <div class="publish-modal-list">
          <div><span>${ctx.dt("المنتجات", "Produits")}</span><strong>${ctx.esc(fmt(counts.products))}</strong></div>
          <div><span>${ctx.dt("الصفحات", "Pages")}</span><strong>${ctx.esc(fmt(ctx.model.pages?.length || 0))}</strong></div>
          <div><span>${ctx.dt("آخر نشر", "Dernière publication")}</span><strong>${ctx.esc(ctx.fmtDateTime(ctx.model.updatedAt))}</strong></div>
        </div>
        <div class="u-flex u-gap-7 u-wrap u-mt-12">
          <button class="btn btn-primary btn-sm" data-action="backup-export">${ctx.icon("download")} ${ctx.dt("تنزيل نسخة", "Télécharger une copie")}</button>
          <button class="btn btn-soft btn-sm" data-action="backup-import">${ctx.icon("upload")} ${ctx.dt("استيراد نسخة", "Importer une copie")}</button>
          <button class="btn btn-soft btn-sm" data-action="backup-undo">${ctx.icon("restore")} ${ctx.dt("تراجع عن آخر استيراد", "Annuler le dernier import")}</button>
        </div>
      </div>`;
  }

  /** Runs the export and reports the size, so the user knows the file is real. */
  function exportNow() {
    try {
      const { doc, fileName, text } = ctx.R.backupExport();
      download(fileName, text);
      ctx.toast(
        ctx.dt(
          `تم تنزيل ${fileName} (${Math.round(text.length / 1024)} ك.ب)`,
          `${fileName} téléchargé (${Math.round(text.length / 1024)} Ko)`
        ),
        "good"
      );
      ctx.addAudit?.(`تصدير نسخة احتياطية: ${doc.counts.products} منتج`);
      return true;
    } catch (error) {
      ctx.toast(error.message, "error");
      return false;
    }
  }

  /** Opens a file picker; the chosen file is read and previewed, never applied directly. */
  function openImportPicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (file) backupImportFile(file);
    });
    input.click();
  }

  /** Reads the file, validates it and shows the diff before offering the apply button. */
  async function backupImportFile(file) {
    if (file.size > 8 * 1024 * 1024) {
      ctx.toast(ctx.dt("الملف أكبر من 8 ميغابايت.", "Fichier de plus de 8 Mo."), "error");
      return;
    }
    let text = "";
    try {
      text = await file.text();
    } catch {
      ctx.toast(ctx.dt("تعذر قراءة الملف.", "Lecture impossible."), "error");
      return;
    }
    const result = ctx.R.backupPreview(text);
    if (!result.ok) {
      ctx.toast(ctx.dt(`ملف غير صالح: ${result.error.message}`, `Fichier invalide : ${result.error.message}`), "error");
      return;
    }
    openBackupModal(file.name, result.preview, text);
  }

  /** Renders the import preview: counts, the fields that differ, and the two apply modes. */
  function openBackupModal(fileName, preview, text) {
    const { diff, counts, exportedAt, keys } = preview;
    const rows = diff.changes
      .map(
        (row) =>
          `<div><span>${ctx.esc(row.key)}</span><strong dir="ltr">${ctx.esc(fmt(row.from))} → ${ctx.esc(fmt(row.to))}</strong></div>`
      )
      .join("");
    const storeName = diff.storeNameChanged
      ? `<div><span>${ctx.dt("اسم المتجر", "Nom de la boutique")}</span><strong>${ctx.esc(ctx.L(diff.after.storeName))} ${ctx.dt("(يتغير)", "(modifié)")}</strong></div>`
      : "";
    const identicalNote = diff.identical
      ? `<div class="u-flex u-items-start u-gap-8 u-surface-2 u-r-8 u-p-11 u-mt-12 u-fs-10 u-muted u-lh-16">${ctx.icon("info")}<span>${ctx.dt("الملف مطابق للحالة الحالية. لا شيء سيتغير.", "Le fichier est identique à l’état actuel. Rien ne changera.")}</span></div>`
      : "";
    ctx.openModal(
      ctx.dt("مراجعة الاستيراد", "Vérifier l’import"),
      `
      <div class="publish-modal-list">
        <div><span>${ctx.dt("الملف", "Fichier")}</span><strong dir="ltr">${ctx.esc(fileName)}</strong></div>
        <div><span>${ctx.dt("تاريخ التصدير", "Exporté le")}</span><strong>${ctx.esc(ctx.fmtDateTime(exportedAt))}</strong></div>
        <div><span>${ctx.dt("الأقسام", "Sections")}</span><strong>${keys.length}</strong></div>
        <div><span>${ctx.dt("المنتجات في الملف", "Produits du fichier")}</span><strong>${counts.products}</strong></div>
        ${storeName}
        ${rows}
      </div>
      ${identicalNote}
      <div class="u-flex u-items-start u-gap-8 u-surface-2 u-r-8 u-p-11 u-mt-13 u-fs-10 u-muted u-lh-16">${ctx.icon("info")}<span>${ctx.dt(
        "الاستيراد يستبدل البيانات الحالية بعد حفظ نسخة منها، ويمكن التراجع بزر واحد بعدها.",
        "L’import remplace les données actuelles après en avoir gardé une copie, et reste annulable en un clic."
      )}</span></div>`,
      {
        wide: true,
        footer: `<button class="btn btn-soft btn-sm" data-action="close-modal">${ctx.dt("إلغاء", "Annuler")}</button>
          <button class="btn btn-soft btn-sm" data-action="backup-apply" data-id="merge">${ctx.icon("plus")} ${ctx.dt("دمج مع الحالي", "Fusionner")}</button>
          <button class="btn btn-primary btn-sm" data-action="backup-apply" data-id="replace">${ctx.icon("upload")} ${ctx.dt("استبدال الكل", "Tout remplacer")}</button>`
      }
    );
    ctx.pendingBackup = { fileName, text, counts };
  }

  /** Applies the pending import (called by the `backup-apply` action, which passes the mode in `data-id`). */
  async function backupDoApply(mode) {
    const pending = ctx.pendingBackup;
    if (!pending) {
      ctx.toast(ctx.dt("لا يوجد ملف للمراجعة.", "Aucun fichier à appliquer."), "error");
      return;
    }
    const result = await ctx.R.backupApply(pending.text, { mode });
    ctx.pendingBackup = null;
    ctx.closeModal();
    if (!result.ok) {
      ctx.toast(ctx.dt(`لم يُطبَّق: ${result.error.message}`, `Non appliqué : ${result.error.message}`), "error");
      return;
    }
    ctx.model = ctx.clone(ctx.R.state);
    ctx.dirty = false;
    ctx.renderRoute();
    ctx.toast(
      ctx.dt("تم الاستيراد. يمكنك التراجع من نفس البطاقة.", "Import terminé. Annulable depuis la même carte."),
      "good"
    );
  }

  /** Undo: restores the snapshot taken before the last import. */
  function backupDoUndo() {
    const result = ctx.R.backupRestorePrevious();
    if (!result.ok) {
      ctx.toast(ctx.dt("لا توجد نسخة سابقة.", "Aucune copie précédente."), "error");
      return;
    }
    ctx.model = ctx.clone(ctx.R.state);
    ctx.dirty = false;
    ctx.renderRoute();
    ctx.toast(ctx.dt("تم التراجع.", "Annulé."), "good");
  }

  /** Entry point for the `backup-import` action: pick a file, then preview it. */
  function backupAskImport() {
    openImportPicker();
  }
}
