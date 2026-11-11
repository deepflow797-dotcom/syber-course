/* app.js → Product page: repository row → storefront product (pure)
   Extracted verbatim from loadProductByHandle() in 11-product-page.js: no DOM, no network, unit-testable.
   Remote rows win over the local product; presentation-only fields (options, collections) always stay local. */

/** A non-empty array. */
const filled = (value) => Array.isArray(value) && value.length > 0;

/** First non-nullish value, as a number (0 when everything is missing). */
function firstNumber(...values) {
  const found = values.find((value) => value !== null && value !== undefined);
  return Number(found ?? 0);
}

/** First non-nullish value, unchanged. */
function firstDefined(...values) {
  return values.find((value) => value !== null && value !== undefined);
}

/** Remote specs win only when the row actually carries some. */
function pickSpecs(remote, local) {
  if (remote && Object.keys(remote).length) return remote;
  return local || {};
}

/** Remote images win only when the row actually carries some. */
function pickImages(remote, local) {
  if (filled(remote)) return remote;
  return local || [];
}

/** Primary image: the first remote image, else the local one. */
function pickImage(remote, local) {
  if (filled(remote)) return remote[0];
  return local;
}

/**
 * Variants of a remote product row, falling back to the local variants when the RPC returns none.
 * @param {any} row Remote `restore_products` row.
 * @param {any} local Locally hydrated product (may be null).
 */
export function mapRepoVariants(row, local) {
  if (!Array.isArray(row.restore_product_variants)) return local?.variants || [];
  return row.restore_product_variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    color: v.color,
    storage: v.storage,
    price: Math.max(0, Number(row.price || 0) + Number(v.price_delta || 0)),
    stock: Number(v.stock || 0),
    available: Number(v.stock || 0) > 0
  }));
}

/**
 * Merges a remote row over the local product, keeping local-only presentation fields (options, collections…).
 * @param {any} row Remote `restore_products` row.
 * @param {any} local Locally hydrated product (may be null).
 */
export function mapRepoProduct(row, local) {
  const base = local || {};
  return {
    ...base,
    handle: row.handle,
    title: row.title || base.title,
    brand: row.brand || base.brand,
    price: firstNumber(row.price, base.price),
    compareAt: firstDefined(row.compare_at, base.compareAt),
    stock: firstNumber(row.stock, base.stock),
    condition: row.condition || base.condition,
    specs: pickSpecs(row.specs, base.specs),
    images: pickImages(row.images, base.images),
    image: pickImage(row.images, base.image),
    variants: mapRepoVariants(row, local),
    options: base.options || [],
    collections: base.collections || [],
    description: base.description || row.title,
    active: row.active !== false,
    _source: "restore_products"
  };
}
