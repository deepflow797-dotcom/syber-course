// @ts-check
/* state.js → Catalog (products / collections / coupons) — relational source of truth
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */
import { createCatalogRepo } from "../data/repositories/catalog.repo.js";
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
} from "../domain/catalog-mappers.js";

export function install(ctx) {
  Object.assign(ctx, {
    catalogOverlay,
    stripCatalog,
    catalogSignature,
    loadCatalog,
    loadCatalogNow,
    pollCatalog,
    requireStaff
  });
  const catalogRepo = ctx.REMOTE ? createCatalogRepo(ctx.supa, ctx.CFG) : null;
  const catalogInfo = { source: ctx.REMOTE ? "unknown" : "state", version: 0, loadedAt: 0, error: "" };
  const CATALOG_STATE_KEYS = ["products", "collections"];

  function catalogOverlay(products, collections, coupons) {
    ctx.state.products = products;
    if (collections) ctx.state.collections = collections;
    if (coupons) {
      ctx.state.settings = ctx.state.settings || {};
      ctx.state.settings.coupons = coupons;
    }
    ctx.writeJSON(ctx.LS_STATE, ctx.state);
  }
  function stripCatalog(candidate) {
    const out = ctx.clone(candidate);
    for (const key of CATALOG_STATE_KEYS) out[key] = [];
    if (out.settings) out.settings.coupons = [];
    out.catalogSource = "tables";
    return out;
  }
  /* Stable fingerprint of what the storefront actually renders — insensitive to key order
     and to the defaults hydrate() adds, so the first load never triggers a reload loop. */
  function catalogSignature(products, collections, coupons) {
    const p = (products || [])
      .map((x) => [x.handle, x.price, x.stock, x.active !== false, x.updatedAt || ""].join(":"))
      .sort();
    const c = (collections || []).map((x) => [x.handle, x.visible !== false].join(":")).sort();
    const k = (coupons || []).map((x) => [String(x.code).toUpperCase(), x.active !== false, x.value].join(":")).sort();
    return p.join("|") + "#" + c.join("|") + "#" + k.join("|");
  }
  ctx.catalogLoading = null;
  function loadCatalog(opts = {}) {
    if (ctx.catalogLoading) return ctx.catalogLoading; // de-duplicate concurrent calls
    ctx.catalogLoading = loadCatalogNow(opts).finally(() => {
      ctx.catalogLoading = null;
    });
    return ctx.catalogLoading;
  }
  async function loadCatalogNow({ staff = false, silent = true } = {}) {
    if (!catalogRepo) return false;
    try {
      const [prods, cols, cps] = await Promise.all([
        catalogRepo.listProducts({ staff }),
        catalogRepo.listCollections({ staff }),
        catalogRepo.listCoupons({ staff }).catch(() => [])
      ]);
      const meta = await catalogRepo.meta().catch(() => null);
      if (!prods.length && !cols.length) {
        catalogInfo.source = "state"; // tables empty → migration not applied / not imported yet
        catalogInfo.loadedAt = Date.now();
        return false;
      }
      const products = prods.map(({ row, variants, collectionHandles }) =>
        rowToProduct(row, variants, collectionHandles)
      );
      const collections = cols.length ? cols.map(rowToCollection) : null;
      const coupons = cps.map(rowToCoupon);
      const before = catalogSignature(ctx.state.products, ctx.state.collections, ctx.state.settings?.coupons);
      catalogOverlay(products, collections, coupons);
      ctx.state = ctx.hydrate(ctx.state); // normalise exactly like a fresh page load
      ctx.writeJSON(ctx.LS_STATE, ctx.state);
      const after = catalogSignature(ctx.state.products, ctx.state.collections, ctx.state.settings?.coupons);
      catalogInfo.source = "tables";
      catalogInfo.version = Number(meta?.version || 0);
      catalogInfo.loadedAt = Date.now();
      catalogInfo.error = "";
      if (before !== after && !silent)
        window.dispatchEvent(new CustomEvent("restore:changed", { detail: { source: "catalog" } }));
      return true;
    } catch (error) {
      catalogInfo.error = String(error?.message || error);
      console.warn("Restore: catalog load failed", error);
      return false;
    }
  }
  async function pollCatalog() {
    if (!catalogRepo || catalogInfo.source !== "tables") return;
    try {
      const meta = await catalogRepo.meta();
      if (meta && Number(meta.version || 0) !== catalogInfo.version) await loadCatalog({ silent: false });
    } catch {
      /* ignore */
    }
  }
  function requireStaff() {
    if (!catalogRepo) throw new Error("Supabase is not configured");
    if (!ctx.session || ctx.session.mode !== "supabase")
      throw new Error("سجّل الدخول بحساب موظف أولًا / Connexion staff requise");
  }
  const catalog = {
    get enabled() {
      return Boolean(catalogRepo);
    },
    get source() {
      return catalogInfo.source;
    },
    get info() {
      return { ...catalogInfo };
    },
    load: loadCatalog,
    reload: () => loadCatalog({ staff: ctx.session?.mode === "supabase", silent: true }),
    /* ---- products ---- */
    async saveProduct(product) {
      requireStaff();
      const errors = validateProduct(product);
      if (errors.length) throw new Error("validation: " + errors.join(", "));
      const mapped = productToRow(product);
      await catalogRepo.upsertProduct(mapped);
      await catalog.reload();
      ctx.addAudit(`catalog: product saved ${product.handle}`);
      return ctx.state.products.find((p) => p.handle === product.handle) || null;
    },
    async deleteProduct(product) {
      requireStaff();
      await catalogRepo.deleteProduct(String(product.id || product.handle));
      await catalog.reload();
      ctx.addAudit(`catalog: product deleted ${product.handle}`);
    },
    async setProductActive(product, active) {
      requireStaff();
      await catalogRepo.patchProduct(String(product.id || product.handle), { active: Boolean(active) });
      await catalog.reload();
      ctx.addAudit(`catalog: product ${active ? "activated" : "hidden"} ${product.handle}`);
    },
    async setProductStock(product, stock) {
      requireStaff();
      await catalogRepo.patchProduct(String(product.id || product.handle), {
        stock: Math.max(0, Math.round(Number(stock) || 0))
      });
      await catalog.reload();
      ctx.addAudit(`catalog: stock ${product.handle} → ${stock}`);
    },
    async bulkPrice({ collection = "all", percent = 0, direction = "up" }) {
      requireStaff();
      const targets = ctx.state.products.filter(
        (p) => p.active !== false && (collection === "all" || (p.collections || []).includes(collection))
      );
      const updates = targets.map((p) => ({
        id: String(p.id || p.handle),
        fields: { price: bulkAdjustPrice(p.price, percent, direction) }
      }));
      await catalogRepo.patchProducts(updates);
      await catalog.reload();
      ctx.addAudit(`catalog: bulk price ${direction} ${percent}% (${updates.length})`);
      return updates.length;
    },
    /* ---- collections ---- */
    async saveCollection(collection) {
      requireStaff();
      await catalogRepo.upsertCollection(collectionToRow(collection));
      await catalog.reload();
      ctx.addAudit(`catalog: collection saved ${collection.handle}`);
    },
    async deleteCollection(collection) {
      requireStaff();
      await catalogRepo.deleteCollection(String(collection.id || collection.handle));
      await catalog.reload();
      ctx.addAudit(`catalog: collection deleted ${collection.handle}`);
    },
    /* ---- coupons ---- */
    async saveCoupon(coupon) {
      requireStaff();
      const errors = validateCoupon(coupon);
      if (errors.length) throw new Error("validation: " + errors.join(", "));
      await catalogRepo.upsertCoupon(couponToRow(coupon));
      await catalog.reload();
      ctx.addAudit(`catalog: coupon saved ${String(coupon.code).toUpperCase()}`);
    },
    async deleteCoupon(coupon) {
      requireStaff();
      await catalogRepo.deleteCoupon(String(coupon.code).toUpperCase());
      await catalog.reload();
      ctx.addAudit(`catalog: coupon deleted ${String(coupon.code).toUpperCase()}`);
    },
    /* ---- one-time import of the legacy JSON catalog (dashboard button) ---- */
    async importFromState(source = ctx.state) {
      requireStaff();
      const products = (source.products || []).map(productToRow);
      const collections = (source.collections || []).map(collectionToRow);
      const coupons = (source.settings?.coupons || []).map(couponToRow);
      const result = await catalogRepo.importLegacy({ products, collections, coupons });
      await catalog.reload();
      ctx.addAudit(
        `catalog: imported legacy JSON (${result.products} products, ${result.collections} collections, ${result.coupons} coupons)`
      );
      return result;
    }
  };
  Object.assign(ctx, { catalogRepo, catalogInfo, CATALOG_STATE_KEYS, catalog });
}
