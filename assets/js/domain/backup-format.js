// @ts-check
/* Backup document format (P4) — pure functions only: no DOM, no storage, no network.
   The dashboard export/import UI is a thin shell over this module, which is why every rule below is unit-tested
   without a browser.

   Format, deliberately boring:
   { format: "restore-backup", formatVersion: 1, exportedAt, app: "1.7.0", version, counts, data: { …store state } }

   `data` is the published store state as `state.js` stores it, so an import is a plain `hydrate()` away. The
   envelope exists so a file can be recognised, version-checked and summarised before anything is written. */

export const BACKUP_FORMAT = "restore-backup";
export const BACKUP_FORMAT_VERSION = 1;

/** Store-state keys that belong to the catalog (products/collections) and live in tables when Supabase is wired. */
const CATALOG_KEYS = ["products", "collections"];

/** Keys of the state tree, in the order a human would expect to see them in the import summary. */
export const STATE_KEYS = [
  "settings",
  "products",
  "collections",
  "pages",
  "blog",
  "faqs",
  "homeReviews",
  "press",
  "theme",
  "home",
  "reviews"
];

/**
 * A short, stable summary of what a state tree contains — what the dashboard shows next to a file name.
 * @param {Record<string, any>} data
 */
export function describeState(data) {
  const state = data || {};
  const settings = state.settings || {};
  const count = (value) => (Array.isArray(value) ? value.length : 0);
  return {
    products: count(state.products),
    collections: count(state.collections),
    pages: count(state.pages),
    blog: count(state.blog),
    categories: count(state.theme?.categories),
    homeSections: count(settings.homeSections),
    coupons: count(settings.coupons),
    storeName: settings.storeName || null,
    updatedAt: state.updatedAt || null
  };
}

/**
 * Wraps a state tree in the backup envelope. The data is cloned, so the caller keeps ownership of its own object.
 * @param {Record<string, any>} data published store state
 * @param {{ app?: string, clone: <T>(value: T) => T, nowISO?: () => string }} ctx
 */
export function createBackup(data, ctx) {
  if (!data || typeof data !== "object") throw new Error("لا توجد بيانات للتصدير. / Rien à exporter.");
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: (ctx.nowISO && ctx.nowISO()) || new Date().toISOString(),
    app: ctx.app || "",
    version: Number(data.version || 0),
    counts: describeState(data),
    data: ctx.clone(data)
  };
}

/** File name for a backup: stable, sortable, no spaces. `restore-backup-2026-11-11-1432.json`. */
export function backupFileName(exportedAt) {
  const date = new Date(exportedAt);
  const stamp = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = (n) => String(n).padStart(2, "0");
  const day = `${stamp.getUTCFullYear()}-${pad(stamp.getUTCMonth() + 1)}-${pad(stamp.getUTCDate())}`;
  const time = `${pad(stamp.getUTCHours())}${pad(stamp.getUTCMinutes())}`;
  return `restore-backup-${day}-${time}.json`;
}

/** Errors carry a machine-readable `code` so the UI can translate them and tests can assert on them. */
function fail(code, message) {
  const error = /** @type {Error & { code: string }} */ (new Error(message));
  error.code = code;
  return error;
}

/** Rejects an envelope that is not ours or was written by a newer store. */
function checkEnvelope(doc) {
  if (doc.format !== BACKUP_FORMAT) throw fail("not-a-backup", "الملف ليس نسخة احتياطية من هذا المتجر.");
  const version = doc.formatVersion;
  if (!Number.isInteger(version) || version < 1) throw fail("bad-format-version", "رقم إصدار الملف غير صالح.");
  if (version > BACKUP_FORMAT_VERSION)
    throw fail("future-format", "هذه النسخة أُنشئت بإصدار أحدث من المتجر. حدّث لوحة التحكم أولًا.");
}

/** Rejects a payload whose section types would corrupt the state tree if applied. */
function checkPayload(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw fail("no-data", "النسخة لا تحتوي على بيانات.");
  for (const key of CATALOG_KEYS) {
    if (data[key] != null && !Array.isArray(data[key])) throw fail(`bad-${key}`, `حقل ${key} غير صالح.`);
  }
  if (data.settings != null && (typeof data.settings !== "object" || Array.isArray(data.settings)))
    throw fail("bad-settings", "حقل الإعدادات غير صالح.");
}

/**
 * Validates a parsed backup file without touching the store. Throws an error with a `code` when the file cannot be
 * applied; returns the envelope plus a summary of what will change when it can.
 * @param {unknown} input parsed JSON
 */
export function validateBackup(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw fail("not-an-object", "الملف ليس نسخة احتياطية صالحة.");
  const doc = /** @type {Record<string, any>} */ (input);
  checkEnvelope(doc);
  const { data } = doc;
  checkPayload(data);
  const written = Object.keys(data).filter((key) => STATE_KEYS.includes(key));
  if (!written.length) throw fail("empty-data", "النسخة فارغة: لا تحتوي على أي قسم معروف.");
  return {
    exportedAt: doc.exportedAt || null,
    app: doc.app || "",
    version: Number(doc.version || 0),
    counts: describeState(data),
    keys: written,
    data
  };
}

/**
 * Compares a validated backup against the current state. Pure: the UI renders this, the user decides.
 * @param {Record<string, any>} current current store state
 * @param {Record<string, any>} incoming validated backup data
 */
export function diffBackup(current, incoming) {
  const before = describeState(current);
  const after = describeState(incoming);
  const numeric = Object.keys(after).filter((key) => typeof after[key] === "number");
  const changes = numeric
    .map((key) => ({ key, from: before[key], to: after[key] }))
    .filter((row) => row.from !== row.to);
  const storeNameChanged = JSON.stringify(before.storeName) !== JSON.stringify(after.storeName);
  return {
    changes,
    storeNameChanged,
    before,
    after,
    identical: !changes.length && !storeNameChanged
  };
}

/**
 * Merges an imported state over the current one, key by key. Objects are shallow-merged one level so a backup from an
 * older version never drops settings the current version added; arrays and primitives replace wholesale.
 * @param {Record<string, any>} current
 * @param {Record<string, any>} incoming
 */
export function mergeImportedState(current, incoming) {
  const out = { ...(current || {}) };
  for (const key of Object.keys(incoming || {})) {
    if (!STATE_KEYS.includes(key)) continue;
    const next = incoming[key];
    if (key === "settings" && next && typeof next === "object" && !Array.isArray(next)) {
      out.settings = { ...(current?.settings || {}), ...next };
      continue;
    }
    out[key] = next;
  }
  return out;
}

/** A backup is only worth applying if it parses and validates; this is the whole read path, in one place. */
export function parseBackupText(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ""));
  } catch {
    throw fail("invalid-json", "الملف ليس JSON صالحًا.");
  }
  return validateBackup(parsed);
}
