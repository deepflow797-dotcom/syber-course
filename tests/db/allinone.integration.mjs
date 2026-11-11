/* Proves the file the docs tell a merchant to paste actually works — on this repository, not just in a generated
   client folder. `tests/db/fresh-store.integration.mjs` covers the new-client path; this covers `supabase/ALL_IN_ONE.sql`
   as shipped, on an empty PostgreSQL 16 (PGlite), including a second run (idempotency). */
import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { readFileSync, existsSync } from "node:fs";

const file = "supabase/ALL_IN_ONE.sql";
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
};

check(`${file} exists (run \`npm run sql\` to build it)`, existsSync(file));
if (!existsSync(file)) process.exit(1);

const sql = readFileSync(file, "utf8").replace(
  /create extension if not exists pgcrypto;/g,
  "-- pgcrypto not in PGlite"
);
check("contains every migration section", (sql.match(/-- ===== supabase\/migrations\//g) || []).length >= 4);
check("contains the demo seed", sql.includes("-- ===== seed: demo catalog"));

const db = new PGlite({ extensions: { uuid_ossp } });
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

try {
  await db.exec(sql);
  check("runs on an empty database (first paste)", true);
} catch (error) {
  check("runs on an empty database (first paste)", false, error.message.split("\n")[0]);
}

const count = async (table) => (await db.query(`select count(*)::int n from ${table}`)).rows[0].n;
const products = await count("restore_products");
const variants = await count("restore_product_variants");
const collections = await count("restore_collections");
check(
  "demo catalog seeded",
  products > 0 && variants > 0 && collections > 0,
  `${products} products, ${variants} variants, ${collections} collections`
);

try {
  await db.exec(sql);
  check("second paste is idempotent (no error)", true);
} catch (error) {
  check("second paste is idempotent (no error)", false, error.message.split("\n")[0]);
}
const products2 = await count("restore_products");
check("no duplicated rows on re-run", products2 === products, `${products} → ${products2}`);
