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
| P4 Backup/import | ⬜ todo | depends on P5 (done) |
| P6 Delivery docs + doctor | ⬜ todo | |
| P7 Dependencies + security | ⬜ todo | |
| P8 Delivery + final report | ⬜ todo | |

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

## Next item when resuming

**P4 backup/import.** It was blocked on P5, which is done: the backup UI can now be written without inline styles.
Plan: an export that serialises the published store state (settings, catalog, pages, texts, home sections) to a versioned
JSON file, an import that validates the schema and shows a diff before applying, and a round-trip unit test. Reuse
`ctx.R` accessors rather than reading `localStorage` directly, and keep the file importable without network.
