# Changelog

## 1.6.0 — Phase 4: quality gates (seed, e2e, 64 unit tests, typecheck, strict lint, Prettier)
- **Fresh stores sell from the first minute**: `scripts/seed-catalog.mjs` boots the real storefront state in jsdom and
  maps it with the production mappers into an idempotent SQL seed (21 products, 38 variants, 11 collections, 2 coupons)
  appended to every generated `supabase/ALL_IN_ONE.sql`. The dashboard "migrate catalog" step is no longer required.
  Proven by `tests/db/fresh-store.integration.mjs` (PGlite): first anonymous `restore_create_order_v2` succeeds, stock
  decrements, re-running the whole file creates no duplicates and keeps sold stock.
- **Playwright e2e** (`npm run test:e2e`, ~16 s, Chromium, local demo mode via in-flight `config.js` rewrite — no files
  touched): 01 order flow, 02 login + 18 dashboard routes with clean console, 03 create product → publish → storefront,
  04 language toggle persistence + analytics consent gate. CI uploads `playwright-report` on failure.
- **Bugs found by e2e 03 and fixed**: products created in the dashboard (bilingual `{ar,fr}` title) rendered as
  `[object Object]` on the storefront — `esc()` now resolves bilingual objects; the default image of a new product
  pointed to a deleted file (404) — replaced; `vendor: "Restore"` default removed.
- **64 unit tests** (was 16): pricing (shipping threshold, Bankily 10 %, coupons, caps), mapper round-trips, i18n key
  parity + placeholders, sanitizer with real DOMPurify, booted-runtime tests (login lock-out after 5 failures, stock,
  local orders, search normalisation, currency, safeHref), tooling (new-client output, check-brand failure path, CSP
  parity vercel.json ↔ `_headers`, no `unsafe-inline` in script-src).
- **Typecheck**: `// @ts-check` on 27 modules (services, data, domain, core, assemblers), `types/global.d.ts`,
  `jsconfig.json`, `npm run typecheck` green with **0** `@ts-ignore`. JSDoc on pricing, mappers, Supabase client/REST,
  submitOrder, decrementStock. `ui/**` typecheck deferred to 1.6.1 (stated scope).
- **ESLint strict**: no-unused-vars, eqeqeq, no-var, prefer-const, max-depth 4, max-lines 600, complexity 15 as errors
  for domain/data/core/scripts/tests; for legacy services/ui, complexity is a warning frozen by
  `scripts/check-complexity.mjs` + `.complexity-baseline.json` (40 functions, may only decrease). 19 real lint errors fixed.
- **Prettier** (printWidth 120, double quotes) applied to all JS; `format:check` in CI. Two files split to stay under
  600 lines after formatting: `services/01-default-content.js` → `01-default-pages.js` + `01-default-texts.js`;
  `ui/dashboard/22-events-forms.js` → `22b-events-settings.js`.
- New guard `scripts/check-assets.mjs` (dangling `assets/…` references fail `npm run lint`).
- CI order: lint → lint:js → format:check → typecheck → test → smoke → db → e2e → secret scan; generated client repos
  get a lighter CI (no Playwright/SBOM). Service-worker cache bumped (v15).

## 1.5.3 — first real deployment (Supabase + Cloudflare Pages) fixes
- 13 default images (hero-*, category-*) were deleted with the original brand assets but still referenced → broken
  hero on a fresh store. Replaced by neutral SVG gradients; all references updated; service-worker cache bumped (v14).
- CLIENT.md: `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically into Edge Functions and the CLI
  refuses to set them — only `ALLOWED_ORIGIN` must be set. Project-name collisions on pages.dev documented.
- Verified live: ALL_IN_ONE.sql in one paste (18 tables), owner SQL, `functions deploy` without Docker, Pages deploy.


## 1.5.2 — blocking fixes found by the second independent audit
- CLIENT.md owner SQL was wrong: `restore_staff.name` is jsonb (plain text failed with "invalid input syntax for type json"),
  and the `owner` role was never written to `auth.users.raw_app_meta_data` → RLS denied the dashboard. Both fixed in the
  generated checklist (+ sign-out/sign-in note).
- create-order: Turnstile is now opt-in (`TURNSTILE_REQUIRED=true` to enforce). Previously setting `ALLOWED_ORIGIN`
  without a Turnstile key made every order fail with 503.
- create-order: never emits `Access-Control-Allow-Origin: null`.
- CLIENT.md secrets line now includes `ALLOWED_ORIGIN`.


## 1.5.1 — fixes from the independent audit (2026-11-09)
- `package.json` description still said "Restore Mauritania" and was copied into every client → neutral text; `new-client`
  now sets the merchant's own description; `check-brand` scans package.json too.
- `npm run check` could stop at `lint:js` with `eslint: command not found` on some shells → script uses `npx --no-install eslint`.
- `_headers` (Cloudflare Pages / Netlify) is now generated in the template root too by `npm run brand`, always derived
  from `vercel.json` so both hosts carry the same CSP/HSTS/no-store policy.


## 1.5.0 — Sellable template: brand-neutral, one command per merchant, zero paid services
- **`assets/js/brand.config.js`** — the only place a merchant's identity lives (name AR/FR, legal name, tagline, logos,
  colours, country/currency, city, phone/WhatsApp/e-mail, staff e-mail domain, domain, coupon prefix). Default content,
  settings, pages, i18n fallbacks and the dashboard all read from it. `npm run brand` renders the static parts
  (titles, meta, manifest, robots, sitemap, text logos, favicon).
- **Original store's content removed**: 187 real product photos (Shopify CDN of a real merchant), hero/promo/press/video
  photos and the "Restore" name are gone. New neutral demo catalog (21 products, 38 variants, 11 collections, SVG art,
  `npm run demo-catalog`). Assets shrank from 26 MB to 1.1 MB. `scripts/check-brand.mjs` fails lint on any leak.
- **`npm run new-client`** — creates a fully separate copy per merchant: filled brand config, static branding, package name,
  `supabase/ALL_IN_ONE.sql` (schema + all migrations, one paste), `.env.local.example`, Cloudflare/Netlify `_headers`
  (same policy as vercel.json), keep-alive GitHub workflow (free Supabase pauses after 7 idle days), `CLIENT.md`
  step-by-step delivery checklist (merchant's own Supabase account, free hosting with commercial use allowed),
  `LICENSE-CLIENT.txt` (single-store licence). Verified: the generated client passes `npm run check` unchanged.
- `guide.html` — merchant manual in Arabic (login, settings, products, orders, coupons, reviews, FAQ, backups).
- `docs/UPDATING.md` — how to push a template fix to every merchant without touching their brand/config files.
- Username login now maps to `BRAND.staffEmailDomain` instead of a hard-coded domain.


## 1.4.0 — Phase 3: CI, supply chain, headers, consent, RLS tests
- `.github/workflows/ci.yml`: lint → eslint → unit → smoke → db tests → secret scan; separate `sbom` job (CycloneDX
  artifact + `npm audit --audit-level=high`). `.github/dependabot.yml` (npm + actions, weekly).
- **RLS tests on real PostgreSQL 16** (`npm run test:db`, with `set role anon/authenticated`): anon can read products
  but not orders/customers/staff/audit, cannot change prices or insert orders directly, CAN insert an abandoned cart
  but not update others'; customer A sees only own orders and cannot change status; staff sees/updates all;
  `restore_rate_hit` allows N then blocks and is not callable by anon. 13 new assertions, all green.
- `admin-create-staff` Edge Function now rate-limited via the shared `restore_rate_hit` (10 / 10 min per IP, fail-closed).
- Analytics pixels gated behind an explicit consent banner (AR/FR); nothing third-party loads before "Accept".
- `vercel.json`: HSTS preload, COOP/CORP, `dashboard.html` no-store + noindex.
- `SECURITY.md` updated with the real control list and residual risks.


## 1.3.0 — Phase 2: real modular split (no behaviour change)
- `state.js` (2 699 lines) → `services/` 15 modules; `app.js` (2 463) → `ui/storefront/` 17 modules;
  `dashboard.js` (2 935) → `ui/dashboard/` 25 modules. The three entry files are now ≤ 80-line assemblers.
  Largest file is 522 lines; hard cap 600 enforced by `scripts/check-boundaries.mjs` (exit 1).
- Split done with a scope-aware tool (acorn + eslint-scope), not by hand: cross-module references → `ctx.x`,
  shared mutable variables → `ctx` properties. Verified identical rendering of all 10 pages + 18 dashboard routes
  (jsdom, local demo mode) before vs after, and ESLint `no-undef` clean.
- **Fix:** dashboard *reviews* route crashed with `ReferenceError: L is not defined` (pre-existing). Added `L`.
- Dead files deleted: `i18n/legacy-i18n.js`, `core/storage.js`, `core/events.js`, `data/repositories/orders.repo.js`,
  `domain/cart.js`, `domain/order.js` (the last two were test-only duplicates of the storefront cart with different
  limits — never wired in). Guard now fails on any unreferenced file.
- New `npm run test:smoke` (`tests/smoke/pages.smoke.mjs`, jsdom): boots every page and every dashboard route,
  fails on any error. New `npm run lint:js` (ESLint no-undef / boundaries). `npm run check` runs everything.
- `sw.js` → `restore-shell-v12`, pre-cache list includes the new modules. `tests/header.test.mjs` points at the new file.
- `lint` now syntax-checks every module (`scripts/check-syntax.mjs`) instead of 4 hard-coded files.


## 1.2.1 — Database integration test + critical checkout fix
- **Fix (critical):** `restore_create_order_v2` (0002) used untyped `record` variables; any order whose first item had no
  `variantId`, or any order without a coupon, failed with *"record v_v is not assigned yet"* — i.e. the secure checkout path
  could not create plain orders. A variant from item #1 could also leak into item #2. `0005_fix_create_order_v2.sql`
  re-creates the function with typed composite variables and a per-item reset. Found by the new DB test, not in the field.
- New `npm run test:db` (`tests/db/migrations.integration.mjs`): applies 0001→0005 on an in-process PostgreSQL 16 (PGlite)
  with stubbed Supabase auth/storage, and verifies atomic upsert, rollback on bad input, RLS/EXECUTE grants, audit trigger
  (with and without JWT), delete cascade, and `restore_create_order_v2` with coupon + mixed items. `devDependency` only.
- `docs/VERIFICATION.md` updated with the actual results and the shorter remaining checklist for a hosted project.


## 1.2.0 — Atomic catalog writes + server-side audit (phase 1)
### Data / Architecture
- `supabase/migrations/0004_catalog_atomic.sql`: `restore_upsert_product(jsonb)` and `restore_delete_product(text)`
  (security definer, `is_staff()` check, shape validation only). Product + variants + collection links + catalog meta are
  written in **one transaction** — no more orphan variants on a dropped connection.
- Server-side audit: `restore_audit_log` + trigger `restore_audit_row()` on products, variants, collections, links, coupons
  and orders. Records `auth.uid()`, role and a before/after diff for every change, whatever the client (dashboard, SQL
  editor, scripts). Browser-side `R.addAudit` remains for the dashboard view only.
- Reporting indexes: `restore_orders(created_at desc, status)`, `restore_products(active, sort_order)`.
- `catalog.repo.js`: `upsertProduct` / `deleteProduct` are now a single RPC call each (signatures unchanged).
- Tests: `tests/catalog-repo.test.mjs` asserts exactly one request per write (18 tests total).
- Docs: `docs/BACKUP.md` (PITR / weekly `pg_dump` / restore drill), `docs/VERIFICATION.md` (what was and was not tested).

### Upgrade
Apply `0004_catalog_atomic.sql` after 0003. No client config change.

## 1.1.2 — Fix: broken storefront header (phase 0)
- `renderHeader()` (app.js) had a stray `</div>` after `#customer-account`, closing `.header-actions` early (present since
  storetemplatenum3). Regression test `tests/header.test.mjs`. SW cache → `restore-shell-v11`.

## 1.1.1 — Fix: storefront reload loop after catalog overlay (phase 0)
- `loadCatalog()` compared raw JSON before/after the overlay; `hydrate()` changes key order and adds defaults, so every page
  load fired `restore:changed` → `location.reload()`. Now uses a stable fingerprint (handle, price, stock, active,
  updatedAt), normalises through `hydrate()` first, de-duplicates concurrent loads, and `loadRemoteState()` overlays the
  catalog before notifying the page (no empty-store flash).


## 1.1.0 — Catalog source of truth (relational tables)
### Data / Architecture
- **Single source of truth for products, collections and coupons.** In Supabase mode the dashboard now reads and writes
  `restore_products` / `restore_product_variants` / `restore_collection_products` / `restore_collections` / `restore_coupons`
  through `assets/js/data/repositories/catalog.repo.js`. `publish()` no longer writes these entities into `restore_state.data`
  (they are stripped; the JSON state keeps only theme/settings/pages). `restore_create_order_v2` and the dashboard therefore
  read the same rows — the dual-source bug (JSON vs tables) is gone.
- New pure mappers `assets/js/domain/catalog-mappers.js` (object ↔ row, validation, bulk price rule) shared by the dashboard,
  the storefront loader and `scripts/migrate-state-to-tables.mjs` (rewritten to reuse them).
- New migration `supabase/migrations/0003_catalog_source_of_truth.sql`: `extra jsonb` / `sku` / `sort_order` columns,
  public read of active coupons (checkout preview), `restore_catalog_meta` change marker, `restore_products_with_collections` view.
- `state.js` exposes `R.catalog` (`enabled`, `source`, `saveProduct`, `deleteProduct`, `setProductActive`, `bulkPrice`,
  `saveCollection`, `saveCoupon`, `deleteCoupon`, `importFromState`, `reload`). The storefront overlays the tables onto
  `state.products/collections/settings.coupons` at load and polls `restore_catalog_meta.version` for changes.
- Dashboard: products / collections / coupons views show the active data source; every write goes through the repository with
  an audit entry. If the tables are empty (migration not applied yet) a one-click **"Import catalog to tables"** button appears
  and the legacy draft flow keeps working until then. Local demo mode is unchanged.
- Tests: `tests/catalog-mappers.test.mjs` (round-trips, validation) and `tests/catalog-repo.test.mjs` (write sequence against a
  mock PostgREST, staff-token enforcement). `npm test` → 15 tests.

### Upgrade
1. Apply `0003_catalog_source_of_truth.sql` in the Supabase SQL editor (after 0002).
2. Open the dashboard → Products → click **Import catalog to tables** (or run `APPLY=1 node scripts/migrate-state-to-tables.mjs`).
3. Publish once so `restore_state.data` is rewritten without products/collections/coupons.

## 1.0.0
### Security
- Removed shipped demo passwords; local demo is explicit opt-in on localhost and first-login password is user-chosen (PBKDF2 hash).
- Hardened Supabase RLS/grants: staff-scoped policies, abandoned carts insert-only for public, direct public order inserts disabled by default.
- Added server-side order validation path (`create-order` Edge Function + atomic `restore_create_order` RPC) with stock decrement and fail-closed client behavior in remote mode.
- `create-order` is fail-closed in production when Turnstile is not configured; added shared rate-limit RPC/table (`restore_rate_limits`, `restore_rate_hit`) and origin restrictions.
- Staff session metadata moved to `sessionStorage`; access/refresh tokens are memory-only (never persisted). Added 2-minute pre-expiry refresh and 30-minute dashboard idle logout.
- Tightened CSP: `script-src` has no `unsafe-eval`/`unsafe-inline`; added local vendored DOMPurify 3.2.6 (MPL-2.0/Apache-2.0) wrapper for `sanitizeRichHTML`.
- Removed leaked local deployment/env artifacts (`.env.local`, `.vercel/project.json`), strengthened `.gitignore`, and added `scripts/check-secrets.sh` + `.githooks/pre-commit`. `.zip` files ignored.

### Architecture / Data
- Added additive ES module foundation (`assets/js/core`, `i18n`, `domain`, `data`) and domain tests (pricing/order/cart) runnable via `npm test`.
- Added `supabase/migrations/0002_relational.sql` (relational catalog/orders/coupons draft, reporting views, atomic relational order RPC) and `scripts/migrate-state-to-tables.mjs` (dry-run by default).
- Kept legacy `state.js`/`app.js`/`dashboard.js` entrypoints working for compatibility.

### Docs
- Added `SECURITY.md`, updated `LEGAL.md` (DOMPurify), and updated `README.md`/`supabase/README.md`.
