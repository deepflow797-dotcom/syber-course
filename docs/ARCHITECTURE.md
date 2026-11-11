# Architecture (1.6.0)

```
assets/js/
  config.js, data.js, theme-init.js, pixels.js   # plain scripts (window.*), loaded by the HTML pages
  state.js      → assembler for services/*       # window.RESTORE API (storefront + dashboard share it)
  app.js        → assembler for ui/storefront/*  # public storefront pages
  dashboard.js  → assembler for ui/dashboard/*   # staff dashboard
  services/     # business/application services: config, default content (01-default-pages/-texts/-content), staff auth, Supabase REST,
                # orders, publish, catalog, customers, reviews, currency, pages/settings, sync events
  ui/storefront/, ui/dashboard/                  # rendering + event delegation, one feature per file
  domain/       # pure functions (pricing, catalog mappers) — no DOM, no network, unit-tested
  data/         # Supabase client + repositories (catalog.repo → RPC restore_upsert_product / restore_delete_product)
  core/         # dom (esc, sanitizeRichHTML), utils
  i18n/         # ar.js, fr.js + index
```

## The `ctx` pattern
`state.js`, `app.js` and `dashboard.js` used to be three closure monoliths (2.5–2.9k lines each) whose functions
shared ~15 mutable variables. They were split **mechanically and scope-aware** (acorn + eslint-scope): every
top-level function/const moved to a feature module, every cross-module reference became `ctx.name`, and every
shared mutable variable became a `ctx` property. Behaviour is byte-for-byte the same — verified by rendering all
10 pages and 18 dashboard routes before/after in jsdom (identical DOM sizes, zero errors).

Rules enforced by `npm run lint` (`scripts/check-boundaries.mjs`, exit 1):
1. `core/ domain/ data/ i18n/` never import `ui/` or `services/`; `services/` never imports `ui/`; `domain/` never imports `data/`.
2. No file under `assets/js` above 600 lines.
3. No dead files: every JS file is imported by another module or loaded by an HTML page.

`npm run lint:js` (ESLint `no-undef`) catches undefined identifiers across modules — the class of bug that made the
dashboard **reviews** view crash in 1.2.x (`L is not defined`).

## Next refactoring steps (not done yet — honest scope)
- Modules still communicate through `ctx` instead of explicit imports; converting module-by-module to named
  imports is safe now that files are small and the smoke/eslint nets exist.
- `services/01-default-content.js` is demo content and could move to `data/defaults/`.

## Quality gates (1.6.0)

| Gate | Command | What it proves |
|---|---|---|
| Architecture | `npm run lint` | ≤600 lines/file, layer boundaries, syntax, brand-neutral, no dangling asset refs |
| ESLint strict | `npm run lint:js` | no-unused-vars, eqeqeq, no-var, prefer-const, max-depth 4, complexity 15 (legacy services/ui: warning + ratchet in `.complexity-baseline.json`) |
| Format | `npm run format:check` | Prettier, printWidth 120, double quotes |
| Types | `npm run typecheck` | `tsc` over `// @ts-check` modules (services, data, domain, core, assemblers) + `types/global.d.ts`; 0 `@ts-ignore` |
| Unit | `npm test` | 64 tests: pricing, mappers, i18n parity, sanitizer, booted runtime (jsdom), tooling |
| Smoke | `npm run test:smoke` | every page + 18 dashboard routes render in jsdom without errors |
| Database | `npm run test:db` | migrations + RPC + RLS on PostgreSQL 16 (PGlite) and the **fresh-store scenario** (ALL_IN_ONE.sql incl. seed → first order OK → idempotent) |
| E2E | `npm run test:e2e` | Playwright/Chromium: order flow, dashboard routes, product publish → storefront, i18n + consent |

`scripts/seed-catalog.mjs` is the only place the demo catalog becomes SQL; it reuses `bootStorefront()` (also used by
`tests/helpers/boot.mjs`) and `domain/catalog-mappers.js`, so seed, tests and the dashboard import share one code path.
Business logic stays in JS/SQL functions already covered by tests — the seed is plain `insert … on conflict do nothing`.
