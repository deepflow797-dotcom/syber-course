// @ts-check
/* Catalog repository — the ONLY place that talks to the relational catalog tables.
   Injected `request(path, options, auth)` is R.supa from state.js (handles apikey/JWT/refresh).
   Public reads use the anon key; writes require a staff session (RLS: is_staff()). */

const enc = encodeURIComponent;
const UPSERT = { Prefer: "resolution=merge-duplicates,return=representation" };

export function createCatalogRepo(request, cfg = {}) {
  const T = {
    products: cfg.productsTable || "restore_products",
    variants: cfg.variantsTable || "restore_product_variants",
    collections: cfg.collectionsTable || "restore_collections",
    cp: cfg.collectionProductsTable || "restore_collection_products",
    coupons: cfg.couponsTable || "restore_coupons",
    meta: cfg.catalogMetaTable || "restore_catalog_meta"
  };
  const RPC = {
    upsert: cfg.upsertProductRpc || "restore_upsert_product",
    del: cfg.deleteProductRpc || "restore_delete_product"
  };
  const get = (path, auth = false) => request(path, {}, auth);
  const post = (path, body, headers, auth = true) =>
    request(path, { method: "POST", body: JSON.stringify(body), headers }, auth);
  const patch = (path, body, auth = true) =>
    request(path, { method: "PATCH", body: JSON.stringify(body), headers: { Prefer: "return=representation" } }, auth);
  const del = (path, auth = true) => request(path, { method: "DELETE", headers: { Prefer: "return=minimal" } }, auth);

  async function bump(auth) {
    try {
      await post(
        `/rest/v1/${T.meta}`,
        { id: "main", version: Date.now(), updated_at: new Date().toISOString() },
        { Prefer: "resolution=merge-duplicates,return=minimal" },
        auth
      );
    } catch {
      /* non-fatal */
    }
  }

  return {
    tables: T,

    /* ---------------- reads ---------------- */
    async meta() {
      const rows = await get(`/rest/v1/${T.meta}?id=eq.main&select=version,updated_at`);
      return Array.isArray(rows) ? rows[0] || null : null;
    },
    /** staff=true → includes inactive products (RLS allows staff only). */
    async listProducts({ staff = false, limit = 2000 } = {}) {
      const rows = await get(
        `/rest/v1/${T.products}?select=*,${T.variants}(*),${T.cp}(sort_order,${T.collections}(handle))&order=sort_order.asc,created_at.desc&limit=${limit}`,
        staff
      );
      return (Array.isArray(rows) ? rows : []).map((r) => ({
        row: r,
        variants: Array.isArray(r[T.variants]) ? r[T.variants] : [],
        collectionHandles: (Array.isArray(r[T.cp]) ? r[T.cp] : [])
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map((x) => x?.[T.collections]?.handle)
          .filter(Boolean)
      }));
    },
    async listCollections({ staff = false } = {}) {
      const rows = await get(`/rest/v1/${T.collections}?select=*&order=sort_order.asc,created_at.asc`, staff);
      return Array.isArray(rows) ? rows : [];
    },
    async listCoupons({ staff = false } = {}) {
      const rows = await get(`/rest/v1/${T.coupons}?select=*&order=created_at.desc`, staff);
      return Array.isArray(rows) ? rows : [];
    },

    /* ---------------- writes (staff) ---------------- */
    /** Atomic: one RPC (migration 0004) does product + variants + collection links + meta in a single transaction. */
    async upsertProduct({ row, variants = [], collectionHandles = [] }) {
      const saved = await post(
        `/rest/v1/rpc/${RPC.upsert}`,
        { p: { row, variants, collectionHandles } },
        { Prefer: "return=representation" }
      );
      return Array.isArray(saved) ? saved[0] : saved;
    },
    async patchProduct(id, fields) {
      const out = await patch(`/rest/v1/${T.products}?id=eq.${enc(id)}`, fields);
      await bump(true);
      return Array.isArray(out) ? out[0] : out;
    },
    async patchProducts(updates) {
      // [{id, fields}]
      for (const u of updates) await patch(`/rest/v1/${T.products}?id=eq.${enc(u.id)}`, u.fields);
      await bump(true);
      return updates.length;
    },
    async deleteProduct(id) {
      await post(`/rest/v1/rpc/${RPC.del}`, { p_id: String(id) }, { Prefer: "return=minimal" }); // variants + links cascade, meta bumped server-side
    },

    async upsertCollection(row) {
      const saved = await post(`/rest/v1/${T.collections}?on_conflict=id`, row, UPSERT);
      await bump(true);
      return Array.isArray(saved) ? saved[0] : saved;
    },
    async deleteCollection(id) {
      await del(`/rest/v1/${T.collections}?id=eq.${enc(id)}`);
      await bump(true);
    },

    async upsertCoupon(row) {
      const saved = await post(`/rest/v1/${T.coupons}?on_conflict=code`, row, UPSERT);
      await bump(true);
      return Array.isArray(saved) ? saved[0] : saved;
    },
    async deleteCoupon(code) {
      await del(`/rest/v1/${T.coupons}?code=eq.${enc(code)}`);
      await bump(true);
    },

    /** One-shot import of the legacy JSON catalog into the tables (used by the dashboard "migrate" button). */
    async importLegacy({ products = [], collections = [], coupons = [] }) {
      for (const c of collections)
        await post(`/rest/v1/${T.collections}?on_conflict=id`, c, {
          Prefer: "resolution=merge-duplicates,return=minimal"
        });
      for (const p of products) await this.upsertProduct(p);
      for (const c of coupons)
        await post(`/rest/v1/${T.coupons}?on_conflict=code`, c, {
          Prefer: "resolution=merge-duplicates,return=minimal"
        });
      await bump(true);
      return { products: products.length, collections: collections.length, coupons: coupons.length };
    }
  };
}
