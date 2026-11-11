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
  bulkAdjustPrice
} from "../assets/js/domain/catalog-mappers.js";

const product = {
  handle: "iphone-13-128",
  title: { ar: "آيفون 13", fr: "iPhone 13" },
  vendor: "Apple",
  type: "phone",
  condition: "like-new",
  price: 125000,
  compare: 140000,
  stock: 4,
  battery: 91,
  active: true,
  image: "a.jpg",
  images: ["a.jpg", "b.jpg"],
  description: { ar: "وصف", fr: "desc" },
  includes: ["cable"],
  specs: { ram: "4GB" },
  colors: [{ name: "Noir", hex: "#000" }],
  colorImages: {},
  variants: [{ id: "v1", sku: "IP13-128-BLK", color: "Noir", storage: "128", price: 125000, stock: 2 }],
  collections: ["iphone", "deals"],
  sku: "IP13",
  warrantyMonths: 6
};

test("productToRow keeps relational columns and pushes the rest into extra", () => {
  const { row, variants, collectionHandles } = productToRow(product);
  assert.equal(row.id, "iphone-13-128");
  assert.equal(row.price, 125000);
  assert.equal(row.compare_at, 140000);
  assert.equal(row.stock, 4);
  assert.equal(row.brand, "Apple");
  assert.deepEqual(row.images, ["a.jpg", "b.jpg"]);
  assert.equal(row.extra.battery, 91);
  assert.equal(row.extra.warrantyMonths, 6);
  assert.deepEqual(row.extra.description, { ar: "وصف", fr: "desc" });
  assert.ok(!("price" in row.extra), "price must never be duplicated in extra");
  assert.ok(!("stock" in row.extra));
  assert.deepEqual(collectionHandles, ["iphone", "deals"]);
  assert.equal(variants.length, 1);
  assert.equal(variants[0].price_delta, 0);
  assert.equal(variants[0].product_id, "iphone-13-128");
});

test("row → product → row round-trips", () => {
  const m = productToRow(product);
  const back = rowToProduct({ ...m.row, updated_at: "2026-10-29T00:00:00Z" }, m.variants, m.collectionHandles);
  assert.equal(back.handle, product.handle);
  assert.equal(back.price, product.price);
  assert.equal(back.compare, product.compare);
  assert.equal(back.vendor, "Apple");
  assert.equal(back.battery, 91);
  assert.equal(back.image, "a.jpg");
  assert.deepEqual(back.collections, ["iphone", "deals"]);
  assert.equal(back.variants[0].price, 125000);
  assert.equal(back._source, "restore_products");
  const again = productToRow(back);
  assert.deepEqual(again.row.extra.description, m.row.extra.description);
  assert.equal(again.row.price, m.row.price);
});

test("rowToProduct tolerates missing extra / null columns", () => {
  const p = rowToProduct({
    id: "x",
    handle: "x",
    title: { ar: "x", fr: "x" },
    price: 10,
    stock: null,
    images: null,
    extra: null
  });
  assert.equal(p.stock, 0);
  assert.deepEqual(p.images, []);
  assert.deepEqual(p.collections, []);
  assert.equal(p.compare, 0);
});

test("validateProduct catches bad handle / price", () => {
  assert.deepEqual(validateProduct(product), []);
  assert.ok(validateProduct({ ...product, handle: "Bad Handle!" }).includes("handle_invalid"));
  assert.ok(validateProduct({ ...product, price: -1 }).includes("price_invalid"));
  assert.ok(validateProduct({ ...product, title: { ar: "", fr: "" } }).includes("title_required"));
});

test("collection mapping keeps visible ↔ active", () => {
  const row = collectionToRow({
    handle: "iphone",
    title: { ar: "آيفون", fr: "iPhone" },
    visible: false,
    image: "c.png"
  });
  assert.equal(row.active, false);
  assert.equal(row.extra.image, "c.png");
  assert.equal(row.id, "iphone");
  const back = rowToCollection(row);
  assert.equal(back.visible, false);
  assert.equal(back.image, "c.png");
});

test("coupon mapping: code uppercased, minTotal ↔ min_total, expiresAt ↔ expires_at", () => {
  const row = couponToRow({
    id: "coupon-1",
    code: "restore10",
    type: "percent",
    value: 10,
    active: true,
    minTotal: 5000,
    expiresAt: "2026-12-31"
  });
  assert.equal(row.code, "RESTORE10");
  assert.equal(row.min_total, 5000);
  assert.ok(row.expires_at.startsWith("2026-12-31"));
  const back = rowToCoupon({ ...row, used_count: 3 });
  assert.equal(back.minTotal, 5000);
  assert.equal(back.expiresAt, "2026-12-31");
  assert.equal(back.id, "coupon-1");
  assert.equal(back.usedCount, 3);
  assert.deepEqual(validateCoupon(back), []);
  assert.ok(validateCoupon({ code: "x", type: "percent", value: 150 }).includes("value_invalid"));
});

test("bulkAdjustPrice rounds to nearest 5", () => {
  assert.equal(bulkAdjustPrice(1000, 10, "up"), 1100);
  assert.equal(bulkAdjustPrice(1003, 10, "down"), 905);
  assert.equal(bulkAdjustPrice(100, 200, "down"), 0);
});
