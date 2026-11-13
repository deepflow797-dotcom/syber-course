#!/usr/bin/env node
/**
 * One-time migration: read restore_state.data from Supabase and backfill the relational
 * catalog tables (products, variants, collection links, collections, coupons).
 * Uses the SAME mappers as the dashboard (assets/js/domain/catalog-mappers.js) so there is
 * one definition of row shapes.
 *
 * DRY RUN by default. Set APPLY=1 to write. Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * After a successful import the dashboard switches to "tables" mode automatically and
 * publish() stops writing products/collections/coupons into restore_state.data.
 */
import { productToRow, collectionToRow, couponToRow } from "../assets/js/domain/catalog-mappers.js";
import { createCatalogRepo } from "../assets/js/data/repositories/catalog.repo.js";

const APPLY = process.env.APPLY === "1";
const URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!URL || !KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Example: APPLY=0 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-state-to-tables.mjs"
  );
  process.exit(1);
}

/* request(path, options) compatible with the repository; service-role key bypasses RLS. */
async function request(path, options = {}) {
  if (!APPLY && options.method && options.method !== "GET") {
    console.log("  [dry-run]", options.method, path.split("?")[0]);
    return [];
  }
  const res = await fetch(URL + path, {
    method: options.method || "GET",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body
  });
  if (!res.ok) throw new Error(`${options.method || "GET"} ${path} → ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

const repo = createCatalogRepo(request);
const rows = await request("/rest/v1/restore_state?id=eq.main&select=data");
const data = rows?.[0]?.data || {};
const products = (Array.isArray(data.products) ? data.products : []).map(productToRow);
const collections = (Array.isArray(data.collections) ? data.collections : []).map(collectionToRow);
const coupons = (Array.isArray(data.settings?.coupons) ? data.settings.coupons : []).map(couponToRow);

console.log(
  JSON.stringify(
    { apply: APPLY, counts: { products: products.length, collections: collections.length, coupons: coupons.length } },
    null,
    2
  )
);
for (const c of collections) console.log("[collection]", c.handle);
for (const p of products)
  console.log(
    "[product]",
    p.row.handle,
    `(${p.variants.length} variants, collections: ${p.collectionHandles.join(",") || "-"})`
  );
for (const c of coupons) console.log("[coupon]", c.code);

const result = await repo.importLegacy({ products, collections, coupons });
console.log(APPLY ? "Imported:" : "Dry run complete (set APPLY=1 to write):", result);
