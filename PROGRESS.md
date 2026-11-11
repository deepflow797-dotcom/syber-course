# PROGRESS — restore-store 1.6.0 → 1.7.0 (Phase 5)

Phase order: **P0 → P1 → P2 → P5 → P3 → P4 → P6 → P7 → P8** (CSP first so the backup UI and Lighthouse are written once).
Branch: `arena/58146d3d-syber-course`. Baseline: tag `v1.6.0-baseline` (commit `2c10eee`, untouched 1.6.0 source).

> This file used to be git-ignored and was lost once when the workspace reset. It is tracked now: every phase keeps its
> numbers and its evidence paths here, so the state can be reconstructed from the repository alone.

| Phase | Status | Evidence |
| --- | --- | --- |
| P0 Baseline | ✅ done | `reports/baseline-1.6.0.md`, `reports/p1-targets.txt`, `reports/evidence/p0-*`; tags `v1.6.0-baseline`, `p5-phase-0-done` |
| P1 Complexity ≤10 × 40 | ✅ done (ratchet 40 → 0, complexity 15 an error everywhere) | `reports/evidence/p1-check-final.txt` (109/109), `p1-e2e-final.txt` (6); commit `39c53b5`; tag `p5-phase-1-done` |
| P2 Typecheck on UI | ✅ done (0 errors, 0 `@ts-ignore`, 51 modules) | `p2-typecheck-final.txt`, `p2-check-final.txt` (109/109), `p2-e2e-final.txt` (6); commits `7eced68`…`89ab587`; tag `p5-phase-2-done` |
| P5 CSP without unsafe-inline (style-src) | ✅ done (0 inline styles, 0 violations on 11 pages, pixel-identical) | `p5-check.txt` (116/116), `p5-e2e.txt` (6), `p5-csp-audit.txt`, `p5-pixel-diff.txt`, `p5-print-check.txt`; commits `8d814da`…`ddaa043`; tag `p5-phase-5-done` |
| P3 Images + Lighthouse | ✅ done (CLS 0.765 → 0.017, icons −54…76 %) | `p3-check.txt` (117/117), `p3-e2e.txt` (6), `p3-metrics-after.txt`, `p3-bytes.txt`; commits `cac63e9`, `5b41dd5`; tag `p5-phase-3-done` |
| P4 Backup/import | ✅ done (versioned JSON, diff-before-apply, 1-click undo, 11 unit + 2 e2e) | `p4-check.txt` (128/128), `p4-e2e.txt` (8), `p4-summary.txt`; commit `c945a9d`; tag `p5-phase-4-done` |
| P6 Delivery docs + doctor | ✅ done (`docs/HANDOVER.md` ar+en, `npm run doctor`, 3 new tests) | `p6-check.txt` (131/131), `p6-e2e.txt` (8), `p6-doctor.txt`; commit `65274f0`; tag `p5-phase-6-done` |
| P7 Dependencies + security | ✅ done (DOMPurify 3.2.6 → 3.4.17, 3.3 floor guard, engines ≥20, audit 0) | `p7-check.txt` (133/133), `p7-e2e.txt` (8), `p7-audit.txt`; commit `cea962e`; tag `p5-phase-7-done` |
| P8 Delivery + final report | ✅ done (v1.7.0, CHANGELOG, lockfile 1.5.3 → 1.7.0) | `p8-check.txt` (133/133), `p8-e2e.txt` (8), `p8-doctor.txt`, `p8-metrics.txt` |

## Environment notes

- `npx playwright install chromium` cannot reach `cdn.playwright.dev` here. e2e runs against Chromium from npm
  (`@sparticuz/chromium`, unpacked outside the repo in `/tmp/chromium-bin`) with `LD_LIBRARY_PATH=/tmp/chromium-bin/lib`.
  No repository file is changed for this; CI downloads browsers normally.
- Node v22.22.3 (CI uses 20). Re-run `npm run check` under Node 20 in P7 if a Node 20 binary is obtainable.
- Perf numbers come from Chromium over CDP (`reports/tools/perf-metrics.mjs`), not from Lighthouse: `lighthouse` cannot be
  installed without network. Same engine, same metrics; the tool prints FCP/LCP/CLS/transferred for six pages.

## P1 — complexity (40 frozen functions → ≤10)

Every one of the 40 functions from `reports/p1-targets.txt` is ≤10, `.complexity-baseline.json` is
`{"count": 0, "functions": []}`, and `complexity: [15]` is an error for `services/**` and `ui/**` again.
New modules created by the split (all in `sw.js` SHELL): `01a-default-state.js`, `01b-default-products.js`,
`04a-staff-rows.js`, `15a-click-handlers.js`, `15b-seo.js`, `12a-checkout-markup.js`, `12b-checkout-flow.js`,
`11a-product-mappers.js`, `11b-product-blocks.js`, `22c-actions-forms.js`, `22d-actions-settings.js`.
Tests 64 → 99.

Scope note (honest): 23 functions remain in the 11–15 band (e.g. `catalog-mappers.js rowToProduct` 15,
`10-home-sections.js renderCollection` 15). They were never frozen, pass the ≤15 rule, and 21 of the 23 files are
byte-identical to the baseline. Bringing them under 10 is a separate item and was not attempted.

## P2 — `// @ts-check` on every UI module

51 files (28 dashboard + 23 storefront, not 43: the P1 splits grew the surface) with `install(ctx)` typed by
`DashboardCtx` / `StorefrontCtx` from `types/global.d.ts`. Globals, not `export`ed: `import type` is illegal in a `.js`
file (`TS8006`) and a relative `.d.ts` specifier is untyped (`TS2307`). The contract is asserted in exactly two places —
`app.js` and `dashboard.js`. Error trajectory 72 → 79 → 58 → 43 → 31 → 23 → 16 → 10 → 1 → **0**; 0 `@ts-ignore`.

## P5 — CSP without `style-src 'unsafe-inline'`

Measured first (`reports/tools/csp-style-probe.mjs`): under `style-src 'self'` a `style` attribute and a `<style>` block
are ignored, but CSSOM is not (`el.style.setProperty`, `adoptedStyleSheets`, `insertRule` all apply). That decided it:

1. 122 static `style` attributes → utility classes in `assets/css/restore.css`.
2. 32 data-driven attributes → `data-sv="bg:…;w:…"`, applied by `assets/js/ui/style-vars.js` (one `MutationObserver` per
   page). Channel → property: `bg/fg/w/h` → `--sv-*`, `status/pay/bar/accent` keep the names the old sheets read.
3. `cssText`, `<style>` blocks and the print document moved to sheets (`guide.css`, `print.css`).
4. The print flow had to change shape: a `window.open("")` document has an opaque origin, so it can neither load a
   stylesheet nor carry a `<style>` block. It now prints from `print.html` (same-origin), which also styles the invoice
   properly for the first time.
5. Guard: `scripts/check-inline-styles.mjs` in `npm run lint` (also catches a page-level meta CSP that drifts from the
   header). Tests 109 → 116.

## P3 — images and layout stability

- CLS: the script-rendered shell now reserves its measured height at three breakpoints; collection 0.765 → 0.017 and every
  other page 0.000. Two traps recorded in the CSS comments: reserving *more* than the rendered height shifts the page by
  the difference, and fractional measured heights need `min-height` 1px under (102.5 → 102).
- Images: every storefront `<img>` has `width`/`height` at its true ratio (product art 150×150, logo 420×96 — an earlier
  guess of 120×32 was wrong), plus `decoding="async"`. `.card-media img` pins 196px because `width`/`height` change flex
  sizing. Pixel diff against the baseline: 0 differing pixels on five pages.
- Icons: 16-bit RGBA PNGs re-encoded losslessly to 8-bit by `scripts/png-optimize.mjs` (−71 %, −54 %, −76 %), verified
  byte-identical after decode. `scripts/check-webp.mjs` fails if an icon regresses.
- Real transfer (gzip, cold cache): index 68 K, collection 54 K, product/checkout/account/blog 48 K — 43 K of that is JS.
  An earlier "431 K of JS" reading was uncompressed bytes; the tool now reads `encodedDataLength`.

## P4 — backup / import

Built in two layers on purpose:

- `assets/js/domain/backup-format.js` — **pure** (no DOM, no storage, no network): envelope
  `{format:"restore-backup", formatVersion:1, exportedAt, app, version, counts, data}`, validation that returns an error
  **code** per failure (`not-a-backup`, `future-format`, `bad-products`, `empty-data`, `invalid-json` …), a
  human diff, and a merge that replaces sections but never drops a setting the file predates. 11 unit tests cover a
  lossless round trip, all 12 rejection paths, the diff and that merge rule.
- `assets/js/services/15-backup.js` + `assets/js/ui/dashboard/24-backup.js` — storage, download, and the import modal
  (counts + "3 → 5 products" style diff + *merge* vs *replace*) with a snapshot taken before applying, so **undo is one
  button**. Real round trip in Playwright: export → change the store → import the file → counts identical → undo restores
  the changed state (`e2e/05-backup.spec.mjs`, 2 tests).

Notes (honest):
- Tables mode: the file always contains products/collections (read from memory, which is hydrated from the tables), so a
  backup restores onto a bare store; the apply path swaps local state and then calls `publish()` once, so a failed publish
  rolls back instead of leaving half a state behind.
- The undo snapshot lives in `localStorage` under `restore_state_v1_before_import`; it is per browser, not per account,
  and it is not pruned — one key, overwritten by the next import.
- The import is a plain `JSON.parse` of a user-supplied file: no code is evaluated, sections are type-checked before
  merging, and unknown keys are ignored.

## Next item when resuming

**P6 delivery docs + doctor.** `docs/` has ARCHITECTURE/UPDATING/VERIFICATION/BACKUP; add the client-facing handover
(what to edit, how to publish, how to restore) and a `scripts/doctor.mjs` that checks a fresh clone: node version, config
built, required files present, CSP header == meta CSP, icons 8-bit, service worker shell list matching disk.

## P6 — handover and doctor

- `docs/HANDOVER.md` — Arabic first, English second: a table of *what to change where*, deployment steps, backup/restore,
  a "when something breaks" list, and the evidence table. It is the document a merchant actually opens.
- `npm run doctor` (`scripts/doctor.mjs`, dependency-free, read-only) — 9 sections, 40 checks, exit 1 only on things that
  would break the store. It found a real hole on its first run: `guide.html` and `print.html` had **no `<meta>` CSP at
  all**, which on GitHub Pages (no `_headers`) means no policy. Both pages now carry it, and the P5 guard was extended to
  require a *matching* policy on every page instead of only checking for `unsafe-inline`.
- 3 new tests (`tests/scripts.test.mjs`): doctor passes on this repo; doctor fails and names the page when a page loses its
  policy (copied tree in a temp dir); the handover doc still answers the three merchant questions.

## P7 — dependencies and sanitizer

- **Real finding:** the vendored DOMPurify was **3.2.6** — the version with published mXSS bypasses — and it is the only
  thing standing between merchant-authored HTML and the shopper's DOM. Replaced with upstream **3.4.17** (28 KB, license
  banner intact, MPL-2.0/Apache-2.0 unchanged).
- Three independent checks now keep it honest: `scripts/check-webp.mjs` enforces a **3.3 floor** read from the banner
  (negative-tested: rewriting the banner to 3.2.6 exits 1), `tests/sanitizer.test.mjs` runs four mXSS-shaped payloads
  through it in jsdom, and the same payloads were run in real Chromium — 0 leaked, `<b>ok</b><p>hi</p>` preserved.
- `engines.node` `>=18` → `>=20` (CI already builds on 20; the docs claimed it while the manifest allowed 18).
- `npm audit --audit-level=low`: **0 vulnerabilities**. Six majors behind on dev-only tooling (eslint 10, jsdom 31,
  typescript 7, pglite 0.5, globals, prettier) — deliberately not jumped in a release phase: each needs its own green run.

## P8 — release

- `package.json` **1.6.0 → 1.7.0**; `package-lock.json` was still stamped **1.5.3** and is now 1.7.0 (`npm ci` re-verified).
- `CHANGELOG.md` 1.7.0 entry: what changed per phase, plus a "Notes and residuals" section that states what was *not* done
  (no Lighthouse package offline, no bundling, undo snapshot is per browser, 23 functions still in the 11–15 band).
- Final gate on the release tree: `npm run check` exit 0 (133 unit tests, PostgreSQL/RLS suite green), `npm run test:e2e`
  8 passed, `npm run doctor` READY (0 blocking, 1 expected warning for the empty Supabase URL in template form).

Measured on the final tree (Chromium, cold cache, gzip):

| Page | FCP | LCP | CLS | wire | raw |
| --- | --- | --- | --- | --- | --- |
| index | 648 ms | 1328 ms | 0.000 | 67 K | 593 K |
| collection | 64 ms | 472 ms | 0.017 | 54 K | 583 K |
| product | 376 ms | 376 ms | 0.000 | 47 K | 576 K |
| checkout | 376 ms | 376 ms | 0.000 | 47 K | 576 K |
| account | 60 ms | 420 ms | 0.000 | 47 K | 576 K |
| blog | 356 ms | 996 ms | 0.000 | 49 K | 578 K |

The `raw` column is why the number is worth quoting carefully: 576 K of JavaScript on disk is 43 K on the wire. The tool
now prints both, because an earlier reading of "431 K of JS" was the uncompressed figure and overstated the page weight
by an order of magnitude.

## Follow-up after delivery — the one-paste database file

The question "is this the final result?" was worth asking: the ZIP was complete as *code*, but `README.md` told the
merchant to paste `supabase/ALL_IN_ONE.sql` and **that file did not exist in the template** — `new-client` generates it
per merchant folder, and the repo-level copy was never produced. Anyone following the README on a fresh clone would have
been stuck at step one.

- `scripts/build-sql.mjs` + **`npm run sql`** builds it for the repository itself: `schema.sql` + all 5 migrations + the
  demo-catalog seed, in the same format `new-client` emits.
- `tests/db/allinone.integration.mjs` proves it on an empty PostgreSQL 16 (PGlite): applies cleanly, seeds
  **21 products / 38 variants / 11 collections**, and a **second paste is idempotent** (21 → 21 rows). Wired into
  `npm run test:db`, so `npm run check` now covers it.
- The file is **shipped in the repository and the ZIP** (113 KB), not gitignored — a merchant should not need `npm ci` and
  a build step before they can create their database. `npm run doctor` reports it under a new "Database" section.
- `START-HERE.md` and `docs/HANDOVER.md` (both languages) now document the step.

Fresh-clone walkthrough, executed and verified: `npm ci` → `npm run check` exit 0 (133 tests) → `npm run test:e2e` 8/8 →
`npm run doctor` READY → paste `ALL_IN_ONE.sql` → 21 products.
