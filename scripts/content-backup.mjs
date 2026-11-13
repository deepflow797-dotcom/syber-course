#!/usr/bin/env node
/* Unattended content backup through the public (anon) API — no secrets, no database password.
   Captures what RLS lets a visitor read: published state, products + variants, categories, collections, links, visible
   pages, approved reviews. Orders / customers / staff are NOT readable by anon on purpose → see docs/BACKUP.md (pg_dump)
   or the dashboard's full JSON backup. Writes backups/content-YYYY-MM-DD.json and keeps the newest KEEP files.
   Usage: node scripts/content-backup.mjs [--keep 12] */
import fs from "node:fs";
import path from "node:path";
import { readSupabaseConfig } from "./lib/client-sync.mjs";

const keepIdx = process.argv.indexOf("--keep");
const KEEP = keepIdx >= 0 ? Number(process.argv[keepIdx + 1]) || 12 : 12;
const { url, anonKey } = readSupabaseConfig(fs.readFileSync("assets/js/config.js", "utf8"));
if (!url || !anonKey) {
  console.log("content-backup: config.js has no Supabase URL/key yet — skipped");
  process.exit(0);
}
const TABLES = {
  restore_state: "id,data,updated_at",
  restore_products: "*,restore_product_variants(*)",
  restore_categories: "*",
  restore_collections: "*",
  restore_collection_products: "*",
  restore_pages: "*",
  restore_reviews: "*",
  restore_catalog_meta: "*"
};
const doc = {
  format: "restore-content-backup",
  version: 1,
  source: url,
  exportedAt: new Date().toISOString(),
  tables: {}
};
let failures = 0;
for (const [table, select] of Object.entries(TABLES)) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=5000`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
  });
  if (!res.ok) {
    doc.tables[table] = { error: `${res.status}` };
    if (table === "restore_state" || table === "restore_products") failures++;
    continue;
  }
  doc.tables[table] = await res.json();
}
fs.mkdirSync("backups", { recursive: true });
const file = path.join("backups", `content-${doc.exportedAt.slice(0, 10)}.json`);
fs.writeFileSync(file, JSON.stringify(doc, null, 1) + "\n");
const all = fs
  .readdirSync("backups")
  .filter((f) => /^content-\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort();
for (const old of all.slice(0, Math.max(0, all.length - KEEP))) fs.rmSync(path.join("backups", old));
const counts = Object.entries(doc.tables).map(
  ([t, v]) => `${t.replace("restore_", "")}=${Array.isArray(v) ? v.length : v.error}`
);
console.log(`content-backup: ${file} (${counts.join(" ")})`);
if (failures) process.exit(1);
