/* Fresh-store scenario (PGlite, real PostgreSQL 16): generate a client with scripts/new-client.mjs, run its
   supabase/ALL_IN_ONE.sql exactly as the merchant pastes it (schema + migrations + seed), then prove that
   1) the demo catalog is in the tables (21 products, 11 collections), 2) an anonymous order succeeds on the
   FIRST try without any dashboard step, 3) re-running the whole file is idempotent (no duplicates, no error).
   Run: npm run test:db (second step) */
import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
let failures = 0;
const check = (label, ok, extra = "") => {
  console.log(ok ? "OK  " : "FAIL", label, extra);
  if (!ok) failures++;
};

const out = path.join(os.tmpdir(), "fresh-store-" + process.pid);
rmSync(out, { recursive: true, force: true });
execSync(
  `node scripts/new-client.mjs --key fresh --ar "متجر جديد" --fr "Fresh Store" --phone 22200000009 --email fresh@example.org --color "#16a34a" --domain fresh.pages.dev --out "${out}"`,
  { cwd: ROOT, stdio: "pipe" }
);
const allInOne = path.join(out, "fresh/supabase/ALL_IN_ONE.sql");
check("new-client produced ALL_IN_ONE.sql", existsSync(allInOne));
const sql = readFileSync(allInOne, "utf8").replace(
  /create extension if not exists pgcrypto;/g,
  "-- pgcrypto not in PGlite"
);
check("ALL_IN_ONE contains the seed section", sql.includes("-- ===== seed: demo catalog"));

const db = new PGlite({ extensions: { uuid_ossp } });
const q = (s, p) => db.query(s, p);
await db.exec(`
  do $$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
  end $$;
  create schema if not exists auth; create schema if not exists storage;
  create table if not exists storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table if not exists storage.objects (id uuid default gen_random_uuid() primary key, bucket_id text, name text, owner uuid, metadata jsonb);
  alter table storage.objects enable row level security;
  create table if not exists auth.users (id uuid primary key, email text);
  create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
  create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create or replace function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;`);

const applyAll = async (label) => {
  try {
    await db.exec(sql);
    check(label, true);
  } catch (e) {
    check(label, false, e.message.split("\n")[0]);
  }
};
await applyAll("ALL_IN_ONE.sql runs on an empty database (first paste)");

const counts = async () => ({
  products: (await q("select count(*)::int n from public.restore_products")).rows[0].n,
  variants: (await q("select count(*)::int n from public.restore_product_variants")).rows[0].n,
  collections: (await q("select count(*)::int n from public.restore_collections")).rows[0].n,
  links: (await q("select count(*)::int n from public.restore_collection_products")).rows[0].n,
  coupons: (await q("select count(*)::int n from public.restore_coupons")).rows[0].n
});
const c1 = await counts();
check("seed: 21 products in the tables", c1.products === 21, JSON.stringify(c1));
check("seed: 11 collections", c1.collections === 11);
check("seed: variants and collection links present", c1.variants >= 30 && c1.links >= 21);
check(
  "seed: every product is active with a price > 0",
  (await q("select count(*)::int n from public.restore_products where not active or price <= 0")).rows[0].n === 0
);
check(
  "seed: titles are bilingual {ar,fr}",
  (await q("select count(*)::int n from public.restore_products where title->>'ar' is null or title->>'fr' is null"))
    .rows[0].n === 0
);

const handle = (await q("select handle from public.restore_products order by sort_order, handle limit 1")).rows[0]
  .handle;
const stockBefore = (await q("select stock from public.restore_products where handle=$1", [handle])).rows[0].stock;
await q(
  "select set_config('request.jwt.claims', '{}', false), set_config('request.jwt.claim.role', 'anon', false), set_config('request.jwt.claim.sub', '', false)"
);
let order = null,
  orderErr = "";
try {
  order = (
    await q("select public.restore_create_order_v2($1::jsonb) o", [
      JSON.stringify({
        items: [{ handle, qty: 1 }],
        customer: { name: "First Buyer", phone: "22233334444" },
        payment: { id: "cash" }
      })
    ])
  ).rows[0].o;
} catch (e) {
  orderErr = e.message.split("\n")[0];
}
check(
  "first order succeeds without any dashboard step",
  !!order?.id,
  orderErr || `id=${order?.id} total=${order?.total}`
);
check(
  "order total equals the seeded price",
  !!order &&
    Number(order.total) ===
      Number((await q("select price from public.restore_products where handle=$1", [handle])).rows[0].price),
  String(order?.total)
);
check(
  "stock decremented by 1",
  (await q("select stock from public.restore_products where handle=$1", [handle])).rows[0].stock === stockBefore - 1
);
let unknown = false;
try {
  await q("select public.restore_create_order_v2($1::jsonb)", [
    JSON.stringify({
      items: [{ handle: "does-not-exist", qty: 1 }],
      customer: { name: "x", phone: "1" },
      payment: { id: "cash" }
    })
  ]);
} catch {
  unknown = true;
}
check("unknown product is still rejected", unknown);

await q("select set_config('request.jwt.claim.role', '', false)");
await applyAll("ALL_IN_ONE.sql runs a second time without error");
const c2 = await counts();
check("second run creates no duplicates", JSON.stringify(c2) === JSON.stringify(c1), JSON.stringify(c2));
check(
  "second run does not reset stock already sold",
  (await q("select stock from public.restore_products where handle=$1", [handle])).rows[0].stock === stockBefore - 1
);
check("order survived the re-run", (await q("select count(*)::int n from public.restore_orders")).rows[0].n === 1);

rmSync(out, { recursive: true, force: true });
console.log(failures ? `\nDONE with ${failures} failure(s)` : "\nDONE — fresh store sells from the first minute");
process.exit(failures ? 1 : 0);
