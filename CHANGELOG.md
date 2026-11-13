# Changelog

## 1.8.3 — security fixes from the audit of 1.8.2

Five defects found by auditing 1.8.2 are fixed here; four have a regression test that fails on 1.8.2 and passes now.
No merchant-facing feature changed; existing stores upgrade in place.

- **Attribute injection through a merchant URL (high).** `04-header-footer.js` and 18 other sites wrote store data
  straight into an HTML attribute (`<img src="${ctx.SET.logo}">`). A logo value of `x" data-pwned="1` closed the
  attribute and added its own, so anyone able to save a URL (owner, or a compromised staff session) could deface the
  storefront or swap a payment link. CSP does not mitigate this — the injected markup is same-origin HTML, not script.
  Every external attribute now goes through `ctx.escAttr(...)` or `ctx.urlAttr(...)`, and `urlAttr` additionally
  refuses `javascript:`, `vbscript:` and non-image `data:` URLs so a refused value renders as an empty `src`.
  The scheme check normalises C0 control characters and spaces first: `java\tscript:`, `java\nscript:` and
  `\u0000javascript:` are javascript: to a browser, and a naive prefix match on the raw string lets them through.
  Both the unit test and the browser test carry those payloads.
  A new guard, `node scripts/check-templates.mjs` (part of `npm run lint`), rejects an unescaped `${…}` inside an
  attribute, so the class of bug cannot be reintroduced without failing CI.
- **The weekly snapshot was published on the public site (high).** `content-backup.yml` ran `git add backups` and
  pushed, and the host serves the repository root, so `https://<store>/backups/content-YYYY-MM-DD.json` was
  downloadable. It contained catalogue, pages, links and approved reviews in a single file. The workflow now uploads
  the snapshot as a workflow artifact (90-day retention) and never commits it; `backups/` is in `.gitignore`, blocked
  in `_headers` and blocked by a `vercel.json` header rule for deployments that ignore `_headers`.
- **An update wrote protected template files into a merchant store (medium).** `client-sync.mjs` skipped a protected
  path only when the client already had it (`isProtected(rel) && fs.existsSync(dest)`), so a store without `.env`
  received the template's `.env` — template-only credentials then looked like the store's own. Protected paths are
  now always skipped, regardless of whether the destination exists.
- **The template pointed at a repository it does not own, and the release workflow trusted a placeholder client
  (medium).** `package.json.template.repo` was `Al-SAFWA/store-template` while this build lives in
  `deepflow797-dotcom/syber-course`, so every generated store's `template-update.yml` pulled from a repository the
  owner of this build may not control; it now names the real source. `clients.json` also carried a junk entry
  (`x/cs`) that `release.yml` cloned with `CLIENTS_TOKEN` on every tag and pushed to directly; it is removed.
- **`npm run build` ignored the `.env` the documentation tells the merchant to create (low, but a silent
  demo-mode trap).** `build-config.mjs` read only `process.env`, so a correctly filled `.env` produced "no Supabase
  environment variables set; keeping local demo configuration" and the store never connected. It now reads `.env`,
  with real environment variables (Vercel/CI) still taking precedence, and says which source it used.

Tests: 148 unit (142 + 6 regression in `tests/regression/audit-findings.test.mjs`), 9 e2e (8 + the browser proof
`e2e/06-attribute-injection.spec.mjs`), smoke on 12 pages. `npm test` previously ran only `tests/*.test.mjs`; it now
includes `tests/regression/` so the new tests are actually part of `npm run check`.

## 1.8.2

- tests/workflows.test.mjs no longer assumes automation/client exists (it is synced into stores too).

## 1.8.1

- Client CI: secret scan no longer trips on the public anon key or on warning comments.
- template-update.yml was invalid YAML (daily self-update never ran); fixed and covered by tests/workflows.test.mjs.
- GitHub Actions bumped to v5; Dependabot monthly, grouped, no major bumps.

## 1.8.0 — Phase 6: merge of the two 1.7.0 lines + zero-touch operations

Two independent Phase 5 implementations existed on top of 1.6.0. This release takes the **phase-8 line** (strict CSP
without `style-src 'unsafe-inline'`, DOMPurify 3.4.17 with a 3.3 floor, 40 functions ≤10 complexity, 133 unit tests,
diff-before-apply backup with undo, `print.html`, `docs/HANDOVER.md`, `npm run doctor`) as the base and ports the
**operations layer** from the other line on top of it. The application code of the phase-8 line is unchanged.

- **Zero-touch operations** (`docs/AUTOMATION.md`). Every generated store carries three workflows that need no secrets
  (public URL/key are read from `config.js`): `keepalive.yml` (every 3 days, Supabase never pauses),
  `content-backup.yml` (Mondays → `backups/content-YYYY-MM-DD.json`, last 12 kept), `template-update.yml` (daily: fetch
  the template's latest GitHub release, apply, `npm run check`, push only if green → host redeploys).
- **Template release in one command**: `npm run release -- x.y.z` (bump, CHANGELOG guard, `check:full`, commit, tag) →
  `release.yml` on the tag creates the GitHub release and pushes the update to every store in `clients.json`
  (one `CLIENTS_TOKEN` secret in the template repo). `scripts/update-from-template.mjs` works in pull mode (client
  side) and push mode (`--from DIR`); plan / apply / report are separate, `--dry-run` prints the plan.
- **One rulebook for new-client and update**: `scripts/lib/client-sync.mjs` (files never shipped to clients, files never
  touched in a client — `config.js`, `brand.config.js`, `CLIENT.md`, licence, `ALL_IN_ONE.sql`, `.env*`, `backups/` —
  manifest-based deletion of obsolete template files, client `package.json` derivation, client CI). 4 unit tests.
  `new-client --repo owner/name` registers the store; `template-manifest.json` records the installed version.
- Migrations that need the database password are never applied by a robot: the update opens a GitHub issue listing the
  files to paste into SQL Editor.
- **Numbers:** 142 unit tests, 8 e2e, smoke on all pages + 18 dashboard routes, PostgreSQL migration/RLS/fresh-store
  suites green, `npm run doctor` READY. Verified end-to-end: new-client → client `npm run check` 137/137 →
  simulated template 1.8.1 (changed file, deleted file, new migration) → update applied exactly, local `config.js`
  edit preserved, second run "already up to date".

- **Windows fixes** (found on the first run on a merchant laptop): `tests/style-vars.test.mjs` built paths with
  `URL.pathname` (`C:\C:\...` on Windows) — now `fileURLToPath`; `npm run serve` and the Playwright web server use
  `scripts/serve.mjs` (Node, serves `_headers` CSP, no Python dependency). The smoke runner passed its root directory with a trailing `\` to child processes, which on Windows escapes the closing quote and mangles the arguments — roots are now `path.resolve`d (`pages.smoke.mjs`, `helpers/boot.mjs`, `build-sql.mjs`). `scripts/check-secrets.sh` (bash) is replaced by
  `scripts/check-secrets.mjs` (Node) so `check:full` and the pre-commit hook run on Windows; `.gitattributes` pins LF
  so a Windows checkout with `autocrlf` cannot break `format:check`; Prettier is invoked through Node instead of a
  `.bin` shim. The smoke child wrote its debug dump to `/dev/null`, which on Windows is a file named `null` that cannot be opened — the dump is now written only when `DUMP` is set. First run of the template CI on GitHub: the secret-scan step grepped the bare word `service_role` under `assets/` and failed on the two *warning comments* that tell people never to put that key there — it now fails only on an actual key/assignment (template CI and generated client CI).

- **Dress rehearsal 1.5.2 → 1.8.0** (the real demo1 repository as it was deployed): three things broke and were
  fixed. `release.yml` ran `scripts/update-from-template.mjs` from the *client's* tree, which an old client does not
  have yet — it now runs the template's copy, fails the job (instead of staying green) when a client could not be
  updated, and errors loudly when `CLIENTS_TOKEN` is missing. The merchant's hand-edited `config.js` is excluded from
  `format:check` (`.prettierignore`). `ALL_IN_ONE.sql` is protected from a plain copy but is now rebuilt inside the
  client (`build-sql.mjs`) so it carries every migration and the seed, and the DB test that asserts the seed passes.
  Result: old demo1 → 1.8.0, client `npm run check` green, `config.js` untouched, 4 migrations reported.

- **First live push to a client (demo1) surfaced two more things.** The `CLIENTS_TOKEN` PAT needs the **Workflows**
  permission as well (GitHub refuses a push that adds `.github/workflows/*.yml` without it) — documented in
  `docs/AUTOMATION.md`. The client CI's JWT scan now excludes `assets/js/config.js`: the anon key is a JWT on older
  Supabase projects and is public by design. GitHub Actions bumped to `checkout@v5` / `setup-node@v5` /
  `upload-artifact@v5` (Node 24 runners).

- **First live push to a client (demo1) surfaced two more things.** The `CLIENTS_TOKEN` PAT needs the **Workflows** permission as well (GitHub refuses a push that adds `.github/workflows/*.yml` without it) — documented in
  `docs/AUTOMATION.md`. The client CI's JWT scan now excludes `assets/js/config.js`: the anon key is a JWT on older
  Supabase projects and is public by design. GitHub Actions bumped to `checkout@v5` / `setup-node@v5` /
  `upload-artifact@v5` (Node 24 runners).

- **`template-update.yml` was not valid YAML** (a multi-line `--body` string spilled to column 0): GitHub listed it
  by file path and would never have run it — i.e. the daily self-update was silently dead on every client. Fixed; a
  new `tests/workflows.test.mjs` checks every shipped workflow for this class of error. 142 unit tests.

### Not carried over from the other 1.7.0 line (deliberately, to keep the merge safe)
- `modulepreload` generation, svgo/sharp image pipeline and the Lighthouse gate (extra devDependencies; the phase-8 line
  already measured FCP/LCP/CLS directly). Candidates for 1.9.
- Its accessibility pass (aria labels on carousel dots, `inert` cart drawer, contrast tweaks) — scattered across 60 UI
  files that the phase-8 line rewrote for CSP; to be re-applied on top of this code base.
- Its own backup module (superseded by the phase-8 one with diff + undo).

## 1.7.0 — Phase 5: performance, backup/restore, handover

Ten phases, each one verified before the next: baseline → complexity → types → CSP → images/Lighthouse → backup →
handover → dependencies → release.

- **CSP without `unsafe-inline` for styles (P5).** `style-src 'self'`: 122 static `style` attributes became utility
  classes, 32 data-driven ones went through `data-sv` + `assets/js/ui/style-vars.js` (CSSOM, which the policy allows).
  The print flow had to stop using `window.open("")` (opaque origin cannot load a stylesheet) and now prints from
  `print.html`. `scripts/check-inline-styles.mjs` fails the build on any inline style, `cssText`, `<style>` block, or a
  page whose `<meta>` CSP drifts from `vercel.json` — including a page with no policy at all (found by `npm run doctor`
  on `guide.html`/`print.html`, which GitHub Pages served unprotected).
- **Layout stability (P3).** The script-rendered shell reserves its measured height at three breakpoints:
  CLS on `collection.html` **0.765 → 0.017**, every other page 0.000. Every storefront `<img>` carries true intrinsic
  dimensions. The PWA icons were 16-bit PNGs of flat art and were re-encoded losslessly to 8 bits (−71 %, −54 %, −76 %),
  verified byte-identical after decode; `scripts/png-optimize.mjs` does it, `scripts/check-webp.mjs` keeps it that way.
  Measured (not claimed): FCP 68–652 ms, LCP 324–1396 ms, 48–68 KB transferred per page.
- **Backup & restore (P4).** Dashboard ▸ Settings ▸ Advanced: download one versioned JSON file (settings, catalog,
  sections, pages, blog, reviews) and import it back with a **diff shown before anything is written**, merge or replace,
  and a one-click undo backed by a pre-import snapshot. Newer format versions are refused with a readable message instead
  of corrupting the store. 11 unit tests on the pure format module + 2 Playwright round trips.
- **Handover (P6).** `docs/HANDOVER.md` (Arabic + English): what to edit where, how to deploy, how to restore, what to do
  when something breaks. `npm run doctor` checks a fresh clone or a new deployment: runtime, required files, config mode,
  CSP parity on every page, inline styles, image dimensions, icon bit depth, service-worker shell vs disk, manifest icons,
  backup availability.
- **Dependency and sanitizer security (P7).** Vendored **DOMPurify 3.2.6 → 3.4.17**: 3.2.x carries published mXSS
  bypasses, and this is the library standing between merchant HTML and the shopper's DOM. `npm run lint` now enforces a
  **3.3 floor** from the library's own license banner, four mXSS-shaped payloads are regression-tested in jsdom and in real
  Chromium, and `engines.node` is `>=20` to match CI. `npm audit`: 0 vulnerabilities.
- **Numbers:** 64 → **133 unit tests**, 4 → **8 e2e** scenarios, 10 pages smoke-tested, PostgreSQL migration + RLS suite
  still green. Complexity: the 40 frozen functions are ≤10 (ratchet baseline 0) and `complexity 15` is an error again.

### Notes and residuals
- `lighthouse` cannot be installed in the offline build environment, so P3 measured the same metrics (FCP, LCP, CLS,
  transferred bytes) directly in Chromium over CDP, against `v1.6.0-baseline` in a separate git worktree. Numbers are in
  `reports/evidence/p3-*`.
- Remaining JS weight is the boot chain: 43 KB gzipped, 68–97 requests. Bundling the 92 modules is the next real
  performance win and was deliberately left out of a phase that also rewrites CSP and storage.
- The pre-import undo snapshot is per browser (`localStorage`), not per account.
- 23 functions sit in the 11–15 complexity band (never frozen, pass the ≤15 rule); tightening them to ≤10 is a separate
  task.


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
- Tightened CSP: `script-src` has no `unsafe-eval`/`unsafe-inline`; added local vendored DOMPurify 3.4.17 (MPL-2.0/Apache-2.0) wrapper for `sanitizeRichHTML`.
- Removed leaked local deployment/env artifacts (`.env.local`, `.vercel/project.json`), strengthened `.gitignore`, and added `scripts/check-secrets.sh` + `.githooks/pre-commit`. `.zip` files ignored.

### Architecture / Data
- Added additive ES module foundation (`assets/js/core`, `i18n`, `domain`, `data`) and domain tests (pricing/order/cart) runnable via `npm test`.
- Added `supabase/migrations/0002_relational.sql` (relational catalog/orders/coupons draft, reporting views, atomic relational order RPC) and `scripts/migrate-state-to-tables.mjs` (dry-run by default).
- Kept legacy `state.js`/`app.js`/`dashboard.js` entrypoints working for compatibility.

### Docs
- Added `SECURITY.md`, updated `LEGAL.md` (DOMPurify), and updated `README.md`/`supabase/README.md`.
