import test from "node:test";
import assert from "node:assert/strict";
import { createCatalogRepo } from "../assets/js/data/repositories/catalog.repo.js";
import { productToRow } from "../assets/js/domain/catalog-mappers.js";

/* Mock PostgREST: records every call so we can assert the write sequence. */
function mockRequest(responses = {}) {
  const calls = [];
  const fn = async (path, options = {}, auth = false) => {
    calls.push({
      path,
      method: options.method || "GET",
      auth,
      body: options.body ? JSON.parse(options.body) : null,
      headers: options.headers || {}
    });
    for (const [prefix, value] of Object.entries(responses))
      if (path.startsWith(prefix)) return typeof value === "function" ? value(path) : value;
    return [];
  };
  return { fn, calls };
}

test("upsertProduct is ONE atomic RPC call carrying row + variants + collection handles (staff token)", async () => {
  const { fn, calls } = mockRequest({ "/rest/v1/rpc/restore_upsert_product": [{ id: "p1", handle: "p1" }] });
  const repo = createCatalogRepo(fn);
  const mapped = productToRow({
    handle: "p1",
    title: { ar: "a", fr: "b" },
    price: 100,
    stock: 1,
    variants: [{ sku: "S1", price: 120, stock: 1 }],
    collections: ["deals", "iphone"]
  });
  const saved = await repo.upsertProduct(mapped);
  assert.equal(calls.length, 1, "exactly one network request");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].path, "/rest/v1/rpc/restore_upsert_product");
  assert.equal(calls[0].auth, true, "must use the staff token");
  assert.equal(calls[0].body.p.row.handle, "p1");
  assert.equal(calls[0].body.p.variants[0].price_delta, 20);
  assert.deepEqual(calls[0].body.p.collectionHandles, ["deals", "iphone"]);
  assert.equal(saved.id, "p1");
});

test("deleteProduct is ONE RPC call", async () => {
  const { fn, calls } = mockRequest();
  await createCatalogRepo(fn).deleteProduct("p1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/rest/v1/rpc/restore_delete_product");
  assert.deepEqual(calls[0].body, { p_id: "p1" });
  assert.equal(calls[0].auth, true);
});

test("listProducts (public) uses anon, listProducts({staff}) uses token; nested select is requested", async () => {
  const { fn, calls } = mockRequest({
    "/rest/v1/restore_products": [
      {
        id: "p",
        handle: "p",
        restore_product_variants: [],
        restore_collection_products: [
          { sort_order: 1, restore_collections: { handle: "b" } },
          { sort_order: 0, restore_collections: { handle: "a" } }
        ]
      }
    ]
  });
  const repo = createCatalogRepo(fn);
  const pub = await repo.listProducts();
  assert.equal(calls[0].auth, false);
  assert.match(calls[0].path, /select=\*,restore_product_variants\(\*\),restore_collection_products/);
  assert.deepEqual(pub[0].collectionHandles, ["a", "b"]);
  await repo.listProducts({ staff: true });
  assert.equal(calls[1].auth, true);
});

test("deleteCoupon targets the code primary key and bumps meta", async () => {
  const { fn, calls } = mockRequest();
  await createCatalogRepo(fn).deleteCoupon("RESTORE10");
  assert.equal(calls[0].method, "DELETE");
  assert.equal(calls[0].path, "/rest/v1/restore_coupons?code=eq.RESTORE10");
  assert.equal(calls[1].path, "/rest/v1/restore_catalog_meta");
});
