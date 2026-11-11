/* Unit tests for ui/storefront/11a-product-mappers.js — remote `restore_products` row → storefront product. */
import test from "node:test";
import assert from "node:assert/strict";
import { mapRepoProduct, mapRepoVariants } from "../assets/js/ui/storefront/11a-product-mappers.js";

const LOCAL = {
  handle: "phone-x",
  title: { ar: "هاتف", fr: "Téléphone" },
  brand: "LocalBrand",
  price: 1000,
  compareAt: 1500,
  stock: 4,
  condition: "used",
  specs: { storage: { value: "128" } },
  images: ["local-1.webp"],
  image: "local-1.webp",
  variants: [{ id: "l1", price: 1000 }],
  options: [{ name: "storage", values: ["128", "256"] }],
  collections: ["phones"],
  description: { ar: "وصف", fr: "Description" },
  active: true
};

const ROW = {
  handle: "phone-x",
  title: "Remote Title",
  brand: "RemoteBrand",
  price: "1200",
  compare_at: 1900,
  stock: "7",
  condition: "refurbished",
  specs: { storage: { value: "256" } },
  images: ["remote-1.webp", "remote-2.webp"],
  active: true,
  restore_product_variants: [
    { id: "v1", sku: "S1", color: "noir", storage: "256", price_delta: 100, stock: 3 },
    { id: "v2", sku: "S2", color: "blanc", storage: "128", price_delta: -500, stock: 0 }
  ]
};

test("mapRepoProduct: remote fields win and are coerced to the storefront types", () => {
  const p = mapRepoProduct(ROW, LOCAL);
  assert.equal(p.title, "Remote Title");
  assert.equal(p.brand, "RemoteBrand");
  assert.equal(p.price, 1200);
  assert.equal(p.compareAt, 1900);
  assert.equal(p.stock, 7);
  assert.equal(p.condition, "refurbished");
  assert.deepEqual(p.images, ["remote-1.webp", "remote-2.webp"]);
  assert.equal(p.image, "remote-1.webp", "primary image is the first remote image");
  assert.deepEqual(p.specs, { storage: { value: "256" } });
  assert.equal(p._source, "restore_products");
});

test("mapRepoProduct: presentation-only fields always come from the local product", () => {
  const p = mapRepoProduct(ROW, LOCAL);
  assert.deepEqual(p.options, LOCAL.options);
  assert.deepEqual(p.collections, ["phones"]);
  assert.deepEqual(p.description, LOCAL.description);
});

test("mapRepoProduct: an empty remote row keeps the local values (no null leaks)", () => {
  const p = mapRepoProduct({ handle: "phone-x" }, LOCAL);
  assert.equal(p.title, LOCAL.title);
  assert.equal(p.brand, "LocalBrand");
  assert.equal(p.price, 1000);
  assert.equal(p.compareAt, 1500);
  assert.equal(p.stock, 4);
  assert.equal(p.condition, "used");
  assert.deepEqual(p.stock, 4);
  assert.deepEqual(p.images, ["local-1.webp"]);
  assert.equal(p.image, "local-1.webp");
  assert.deepEqual(p.variants, LOCAL.variants, "no remote variants → local variants");
  assert.equal(p.description, LOCAL.description);
});

test("mapRepoProduct: a row without local product still produces a usable object", () => {
  const p = mapRepoProduct({ handle: "only-remote", title: "X", price: 5 }, null);
  assert.equal(p.handle, "only-remote");
  assert.equal(p.title, "X");
  assert.equal(p.price, 5);
  assert.equal(p.stock, 0);
  assert.deepEqual(p.images, []);
  assert.equal(p.image, undefined);
  assert.deepEqual(p.variants, []);
  assert.deepEqual(p.options, []);
  assert.equal(p.description, "X");
  assert.equal(p.active, true);
});

test("mapRepoProduct: active === false is respected, missing active stays true", () => {
  assert.equal(mapRepoProduct({ handle: "x", active: false }, null).active, false);
  assert.equal(mapRepoProduct({ handle: "x" }, null).active, true);
});

test("mapRepoVariants: prices are base + delta, clamped at 0, availability follows stock", () => {
  const variants = mapRepoVariants(ROW, LOCAL);
  assert.equal(variants.length, 2);
  assert.equal(variants[0].price, 1300);
  assert.equal(variants[0].available, true);
  assert.equal(variants[1].price, 700);
  assert.equal(variants[1].available, false);
  const clamped = mapRepoVariants({ price: 200, restore_product_variants: [{ id: "v", price_delta: -900 }] }, null);
  assert.equal(clamped[0].price, 0, "never a negative price");
});

test("mapRepoVariants: no variant array in the row falls back to the local variants", () => {
  assert.deepEqual(mapRepoVariants({}, LOCAL), LOCAL.variants);
  assert.deepEqual(mapRepoVariants({ restore_product_variants: null }, null), []);
});
