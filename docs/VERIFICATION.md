> **⏰ REMINDER FOR THE OWNER (open item since 1.2.1):** migrations `0004_catalog_atomic.sql` and
> `0005_fix_create_order_v2.sql` are NOT yet applied to the hosted Supabase project. Do not deploy ≥ 1.2.0 to the
> live store before running them in the SQL Editor (see supabase/README.md). Without 0005, checkout orders fail.

# Verification log

## 1.2.0 (phases 0 + 1)

### Verified locally (no Supabase project available in this environment)
| Check | Result |
| --- | --- |
| `node --check` on app.js, state.js, dashboard.js, catalog.repo.js | pass |
| `npm test` | 18/18 (domain 5, catalog-mappers 7, catalog-repo 4, header 2) |
| `scripts/check-boundaries.mjs` | pass |
| Header regression test (`tests/header.test.mjs`) fails when the stray `</div>` is reintroduced | confirmed |
| `upsertProduct` / `deleteProduct` = exactly one request each (mock PostgREST) | confirmed |

### Tested on real PostgreSQL 16 (PGlite in-process, `npm run test:db`) — 2026-11-09
Stubbed only `auth.uid()/auth.jwt()/auth.role()`, `auth.users`, `storage.buckets/objects` and the three Supabase roles;
everything else is the real migrations 0001→0005.

| Scenario | Result |
| --- | --- |
| Apply 0001 → 0002 → 0003 → 0004 → 0005 in order | all OK |
| Staff `restore_upsert_product` (row + 2 variants + 2 collection links) | row returned, variants/links written in order, `restore_catalog_meta` bumped |
| Second upsert with fewer variants/links | sets replaced (1/1), no duplicates; audit diff contains only `price {old,new}` |
| Audit row carries `actor` = staff uuid and `actor_role` = authenticated | OK |
| UPDATE from SQL editor (no JWT) | audited with `actor null` — trigger works server-side |
| Invalid handle / negative price / bad variant value | error raised, **row counts identical before/after** → no partial writes |
| Customer (non-staff) calls upsert/delete | `forbidden`; `anon` has no EXECUTE; `authenticated` cannot INSERT into `restore_audit_log` |
| `restore_delete_product` | variants + links gone, audit DELETE rows |
| `restore_create_order_v2` with coupon RESTORE10 | **crashed on 0002** ("record v_v is not assigned yet") → fixed in 0005 → total 108000, stock 4→3, order audited |
| Mixed order (variant item + plain item) | correct unit prices, variant stock 1→0, plain stock 5→3, parent product stock untouched |

### Still NOT tested on a hosted Supabase project — must be done by the owner
1. Apply `0004_catalog_atomic.sql` in the SQL editor; it must run without errors after 0003.
2. Dashboard → edit a product → Network tab shows **one** `POST /rest/v1/rpc/restore_upsert_product` (plus the reload GETs).
3. `select * from restore_audit_log order by at desc limit 5;` shows that edit with your `actor` uuid.
4. Edit a product price directly in the SQL editor → a new `restore_audit_log` row with `actor null` appears (server-side trigger works without the dashboard).
5. PostgREST specifics: `POST /rest/v1/rpc/restore_upsert_product` returns the row object (not an array) with `Prefer: return=representation`.
6. Storefront: open `index.html` in Supabase mode → at most one automatic reload; no flicker loop.
7. Backup drill from `docs/BACKUP.md` §3.
