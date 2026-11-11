// @ts-check
/* state.js → Store backup: export the published state, import a validated file, keep a pre-import snapshot.
   The rules live in domain/backup-format.js (pure, unit-tested); this module only adds storage, publishing and the
   `RESTORE` surface. Nothing here writes to Supabase except through `publish()`, so an import cannot half-apply in
   tables mode: the state is swapped locally, then published in one call. */

import {
  backupFileName,
  createBackup,
  diffBackup,
  mergeImportedState,
  parseBackupText
} from "../domain/backup-format.js";

export function install(ctx) {
  Object.assign(ctx, {
    backupExport,
    backupPreview,
    backupApply,
    backupRestorePrevious
  });

  const PREVIOUS_KEY = `${ctx.LS_STATE}_before_import`;
  const APP_VERSION = "1.7.0";

  /** The published state, catalog included even in tables mode (the file must be self-contained). */
  function exportableState() {
    const state = ctx.clone(ctx.state);
    if (ctx.catalogInfo?.source === "tables") {
      // products/collections are live in memory from the tables; keep them in the file so it restores onto a bare store
      state.products = ctx.state.products || [];
      state.collections = ctx.state.collections || [];
    }
    return state;
  }

  function backupExport() {
    const doc = createBackup(exportableState(), { clone: ctx.clone, nowISO: ctx.nowISO, app: APP_VERSION });
    return { doc, fileName: backupFileName(doc.exportedAt), text: JSON.stringify(doc, null, 2) };
  }

  /** Parses and diffs without writing anything. Returns `{ ok: true, preview }` or `{ ok: false, error }`. */
  function backupPreview(text) {
    try {
      const incoming = parseBackupText(text);
      return { ok: true, preview: { ...incoming, diff: diffBackup(ctx.state, incoming.data) } };
    } catch (error) {
      return { ok: false, error: { code: error.code || "unknown", message: error.message } };
    }
  }

  /** Applies a validated import: snapshot the current state, merge, persist, publish. */
  async function backupApply(text, { mode = "replace" } = {}) {
    const preview = backupPreview(text);
    if (!preview.ok) return preview;
    const previous = ctx.clone(ctx.state);
    const merged = mergeImportedState(mode === "merge" ? ctx.state : {}, preview.preview.data);
    const candidate = ctx.hydrate(merged);
    if (ctx.REMOTE && !(await ctx.remoteSessionValid())) {
      return { ok: false, error: { code: "session", message: "انتهت جلسة Supabase. أعد تسجيل الدخول." } };
    }
    ctx.writeJSON(PREVIOUS_KEY, previous);
    try {
      await ctx.publish(candidate);
    } catch (error) {
      ctx.writeJSON(ctx.LS_STATE, previous);
      ctx.state = previous;
      ctx.applyDocument();
      return { ok: false, error: { code: "publish", message: error.message } };
    }
    ctx.addAudit(`استيراد نسخة احتياطية (${preview.preview.keys.length} أقسام)`);
    return { ok: true, applied: preview.preview.keys, counts: preview.preview.counts };
  }

  /** One-click undo for the last import. Local only: it restores what this browser had before the import. */
  function backupRestorePrevious() {
    const previous = ctx.readJSON(PREVIOUS_KEY, null);
    if (!previous) return { ok: false, error: { code: "no-snapshot", message: "لا توجد نسخة سابقة." } };
    ctx.state = ctx.hydrate(previous);
    const stored = ctx.writeJSON(ctx.LS_STATE, ctx.state);
    ctx.applyDocument();
    ctx.channel?.postMessage({ type: "state", updatedAt: ctx.state.updatedAt });
    window.dispatchEvent(new CustomEvent("restore:changed", { detail: { source: "import-undo" } }));
    return { ok: Boolean(stored) };
  }
}
