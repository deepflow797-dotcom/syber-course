import test from "node:test";
import assert from "node:assert/strict";
import {
  productToRow,
  rowToProduct,
  collectionToRow,
  rowToCollection,
  couponToRow,
  rowToCoupon,
  validateProduct,
  validateCoupon,
  bulkAdjustPrice,
  HANDLE_RE
} from "../assets/js/domain/catalog-mappers.js";

const product = {
  id: "p1",
  handle: "iphone-13",
  title: { ar: "آيفون 13", fr: "iPhone 13" },
  vendor: "Apple",
  price: 125000,
  compare: 140000,
  stock: 4,
  condition: "Excellent",
  images: ["a.jpg", "b.jpg"],
  active: true,
  sku: "RS-0001",
  collections: ["iphone", "deals"],
  battery: 91,
  warrantyMonths: 12,
  description: { ar: "و", fr: "d" },
  variants: [{ id: "v1", title: "Noir / 128", o1: "Noir", o2: "128 GB", price: 125000, available: true }]
};

test("product → row → product keeps every business field (round trip)", () => {
  const { row, variants, collectionHandles } = productToRow(product);
  const back = rowToProduct(
    row,
    variants.map((v) => ({ ...v, product_id: row.id })),
    collectionHandles
  );
  assert.equal(back.handle, "iphone-13");
  assert.deepEqual(back.title, product.title);
  assert.equal(back.price, 125000);
  assert.equal(back.compare, 140000);
  assert.equal(back.stock, 4);
  assert.deepEqual(back.images, ["a.jpg", "b.jpg"]);
  assert.deepEqual([...back.collections].sort(), ["deals", "iphone"]);
  assert.equal(back.battery, 91);
  assert.equal(back.warrantyMonths, 12);
  assert.deepEqual(back.description, product.description);
  assert.equal(back.variants.length, 1);
});
test("productToRow puts unknown keys into extra, not into columns", () => {
  const { row } = productToRow({ ...product, someCustomFlag: true });
  assert.equal(row.someCustomFlag, undefined);
  assert.equal(row.extra.someCustomFlag, true);
  assert.equal(row.extra.price, undefined);
});
test("productToRow coerces bad numbers to safe integers", () => {
  const { row } = productToRow({ handle: "x", title: "X", price: "12.7", stock: -3, compare: "nope" });
  assert.equal(row.price, 13);
  assert.equal(row.stock, 0);
  assert.ok(row.compare_at == null || row.compare_at === 0);
});
test("rowToProduct tolerates null jsonb columns from the database", () => {
  const p = rowToProduct(
    { id: "z", handle: "z", title: null, price: 10, stock: 1, images: null, specs: null, extra: null },
    null,
    null
  );
  assert.equal(p.handle, "z");
  assert.ok(Array.isArray(p.images));
  assert.equal(p.price, 10);
});
test("collection round trip preserves handle, title and visibility", () => {
  const row = collectionToRow({ handle: "deals", title: { ar: "عروض", fr: "Promos" }, visible: false });
  assert.equal(row.active, false);
  const back = rowToCollection(row);
  assert.equal(back.handle, "deals");
  assert.equal(back.visible, false);
  assert.deepEqual(back.title, { ar: "عروض", fr: "Promos" });
});
test("coupon round trip: code upper-cased, percent default, expiry ISO ↔ yyyy-mm-dd", () => {
  const row = couponToRow({
    code: " welcome10 ",
    type: "bogus",
    value: "10",
    minTotal: 500,
    expiresAt: "2027-03-01",
    usageLimit: ""
  });
  assert.equal(row.code, "WELCOME10");
  assert.equal(row.type, "percent");
  assert.equal(row.value, 10);
  assert.equal(row.usage_limit, null);
  assert.equal(row.expires_at, "2027-03-01T00:00:00.000Z");
  const back = rowToCoupon(row);
  assert.equal(back.expiresAt, "2027-03-01");
  assert.equal(back.minTotal, 500);
  assert.equal(back.active, true);
});
test("validateProduct rejects bad handles, missing titles and negative price/stock", () => {
  assert.deepEqual(validateProduct(product), []);
  assert.ok(validateProduct({ ...product, handle: "Has Space" }).includes("handle_invalid"));
  assert.ok(validateProduct({ ...product, handle: "-leading" }).includes("handle_invalid"));
  assert.ok(validateProduct({ ...product, title: { ar: "", fr: "" } }).includes("title_required"));
  assert.ok(validateProduct({ ...product, price: -1 }).includes("price_invalid"));
  assert.ok(validateProduct({ ...product, stock: -1 }).includes("stock_invalid"));
  assert.deepEqual(validateProduct(null), ["product_required"]);
});
test("validateCoupon rejects >100 percent, bad codes and unknown types", () => {
  assert.deepEqual(validateCoupon({ code: "OK10", type: "percent", value: 10 }), []);
  assert.ok(validateCoupon({ code: "OK10", type: "percent", value: 101 }).includes("value_invalid"));
  assert.ok(validateCoupon({ code: "a", type: "fixed", value: 1 }).includes("code_invalid"));
  assert.ok(validateCoupon({ code: "OK", type: "gift", value: 1 }).includes("type_invalid"));
});
test("HANDLE_RE accepts storefront handles and rejects path tricks", () => {
  for (const ok of ["iphone-13", "a1", "mac_book_pro-2020"]) assert.ok(HANDLE_RE.test(ok), ok);
  for (const bad of ["a", "../x", "UPPER", "x/y", "a".repeat(121)]) assert.ok(!HANDLE_RE.test(bad), bad);
});
test("bulkAdjustPrice rounds to 5 MRU in both directions and floors at 0", () => {
  assert.equal(bulkAdjustPrice(1000, 10), 1100);
  assert.equal(bulkAdjustPrice(1000, 10, "down"), 900);
  assert.equal(bulkAdjustPrice(1003, 0), 1005);
  assert.equal(bulkAdjustPrice(100, 200, "down"), 0);
});
