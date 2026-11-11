// @ts-check
/* Pure mappers between dashboard/storefront catalog objects and relational rows.
   No DOM, no fetch, no side effects — unit-tested in tests/catalog-mappers.test.mjs.

   Product object (app/dashboard shape)  <->  restore_products row (+ variants, + collection handles)
   Collection object                      <->  restore_collections row
   Coupon object                          <->  restore_coupons row
*/

const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const int = (v, d = 0) => Math.max(0, Math.round(num(v, d)));
const txt = (v) =>
  v && typeof v === "object"
    ? { ar: String(v.ar ?? ""), fr: String(v.fr ?? "") }
    : { ar: String(v ?? ""), fr: String(v ?? "") };
const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

export const HANDLE_RE = /^[a-z0-9][a-z0-9-_]{1,118}$/;
/** @param {Record<string, any> | null | undefined} p @returns {string[]} error codes (empty = valid) */
export function validateProduct(p) {
  const errors = [];
  if (!p || typeof p !== "object") return ["product_required"];
  if (!HANDLE_RE.test(String(p.handle || ""))) errors.push("handle_invalid");
  if (!(txt(p.title).ar || txt(p.title).fr)) errors.push("title_required");
  if (num(p.price, -1) < 0) errors.push("price_invalid");
  if (num(p.stock, -1) < 0) errors.push("stock_invalid");
  return errors;
}
/** @param {Record<string, any> | null | undefined} c @returns {string[]} error codes (empty = valid) */
export function validateCoupon(c) {
  const errors = [];
  if (!c || typeof c !== "object") return ["coupon_required"];
  if (!/^[A-Z0-9_-]{2,40}$/.test(String(c.code || "").toUpperCase())) errors.push("code_invalid");
  if (!["percent", "fixed"].includes(c.type)) errors.push("type_invalid");
  if (num(c.value, -1) < 0 || (c.type === "percent" && num(c.value) > 100)) errors.push("value_invalid");
  return errors;
}

/* Keys that live in dedicated columns; everything else goes to `extra`. */
const PRODUCT_COLUMN_KEYS = new Set([
  "id",
  "handle",
  "title",
  "brand",
  "vendor",
  "price",
  "compare",
  "compareAt",
  "stock",
  "condition",
  "specs",
  "images",
  "image",
  "active",
  "sku",
  "sortOrder",
  "variants",
  "collections",
  "updatedAt",
  "createdAt",
  "_source"
]);

function productExtra(p, images) {
  const extra = {};
  for (const [k, v] of Object.entries(p || {})) if (!PRODUCT_COLUMN_KEYS.has(k)) extra[k] = v;
  extra.collections = arr(p.collections).map(String);
  extra.image = p.image || images[0] || "";
  return extra;
}
function variantToRow(v, i, id, basePrice, stock) {
  return {
    id: String(v.id || `${id}_v${i + 1}`),
    product_id: id,
    sku: v.sku ? String(v.sku) : null,
    color: v.color || v.label || null,
    storage: v.storage || null,
    price_delta: Math.round(num(v.price, basePrice) - basePrice),
    stock: int(v.stock ?? stock)
  };
}
/** Dashboard/storefront product → `{ row, variants, collectionHandles }` for restore_products & friends.
 * @param {Record<string, any>} p */
export function productToRow(p) {
  const images = arr(p.images).map(String).filter(Boolean);
  if (!images.length && p.image) images.push(String(p.image));
  const extra = productExtra(p, images);
  const id = String(p.id || p.handle);
  const compare = p.compare ?? p.compareAt;
  const row = {
    id,
    handle: String(p.handle),
    title: txt(p.title),
    brand: p.brand || p.vendor || null,
    price: int(p.price),
    compare_at: num(compare, 0) > 0 ? int(compare) : null,
    stock: int(p.stock),
    condition: p.condition || null,
    specs: obj(p.specs),
    images,
    active: p.active !== false,
    sku: p.sku ? String(p.sku) : null,
    sort_order: int(p.sortOrder, 0),
    extra
  };
  const variants = arr(p.variants).map((v, i) => variantToRow(v, i, id, row.price, row.stock));
  return { row, variants, collectionHandles: extra.collections };
}

/** Inverse of productToRow. @param {Record<string, any>} row @param {Record<string, any>[]} [variants] @param {string[] | null} [collectionHandles] */
export function rowToProduct(row, variants = [], collectionHandles = null) {
  const extra = obj(row.extra);
  const images = arr(row.images).map(String);
  const base = row.price | 0;
  const product = {
    ...extra,
    id: row.id,
    handle: row.handle,
    title: txt(row.title),
    vendor: extra.vendor || row.brand || "",
    brand: row.brand || extra.vendor || "",
    price: int(row.price),
    compare: row.compare_at == null ? 0 : int(row.compare_at),
    stock: int(row.stock),
    condition: row.condition || extra.condition || "",
    specs: obj(row.specs),
    images,
    image: extra.image || images[0] || "",
    active: row.active !== false,
    sku: row.sku || "",
    sortOrder: int(row.sort_order, 0),
    collections: Array.isArray(collectionHandles) ? collectionHandles.map(String) : arr(extra.collections).map(String),
    variants: arr(variants).map((v) => ({
      id: v.id,
      sku: v.sku || "",
      color: v.color || "",
      label: v.color || "",
      storage: v.storage || "",
      price: Math.max(0, base + num(v.price_delta, 0)),
      stock: int(v.stock),
      available: int(v.stock) > 0
    })),
    updatedAt: row.updated_at || null,
    _source: "restore_products"
  };
  return product;
}

export function collectionToRow(c) {
  const { id, handle, title, description, active, visible, sortOrder, ...rest } = c || {};
  return {
    id: String(id || handle),
    handle: String(handle),
    title: txt(title),
    description: txt(description || ""),
    active: visible !== false && active !== false,
    sort_order: int(sortOrder, 0),
    extra: rest
  };
}
export function rowToCollection(row) {
  return {
    ...obj(row.extra),
    id: row.id,
    handle: row.handle,
    title: txt(row.title),
    description: txt(row.description),
    visible: row.active !== false,
    active: row.active !== false,
    sortOrder: int(row.sort_order, 0),
    _source: "restore_collections"
  };
}

export function couponToRow(c) {
  const { code, type, value, minTotal, min_total, expiresAt, expires_at, usageLimit, active, ...rest } = c || {};
  const exp = expiresAt || expires_at;
  return {
    code: String(code || "")
      .trim()
      .toUpperCase(),
    type: type === "fixed" ? "fixed" : "percent",
    value: int(value),
    min_total: int(minTotal ?? min_total, 0),
    expires_at: exp ? new Date(exp).toISOString() : null,
    usage_limit: usageLimit == null || usageLimit === "" ? null : int(usageLimit),
    active: active !== false,
    extra: rest
  };
}
export function rowToCoupon(row) {
  return {
    ...obj(row.extra),
    id: obj(row.extra).id || `coupon-${row.code}`,
    code: row.code,
    type: row.type,
    value: int(row.value),
    minTotal: int(row.min_total, 0),
    expiresAt: row.expires_at ? String(row.expires_at).slice(0, 10) : "",
    usageLimit: row.usage_limit,
    usedCount: int(row.used_count, 0),
    active: row.active !== false,
    _source: "restore_coupons"
  };
}

/* Bulk price helper (same rounding rule as the dashboard: nearest 5 MRU). */
export function bulkAdjustPrice(price, percent, direction = "up") {
  const factor = direction === "up" ? 1 + num(percent) / 100 : 1 - num(percent) / 100;
  return Math.max(0, Math.round((num(price) * factor) / 5) * 5);
}
