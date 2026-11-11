# Restore — متجر إلكترونيات مجددة في موريتانيا

Restore is a complete, bilingual (Arabic / French) electronics storefront and admin
dashboard for Nouakchott, Mauritania. It is a static site: no framework, no build step
required for local use, and deployable on Vercel. Checkout sends the full order to
WhatsApp; the dashboard publishes content, products, prices and theme changes without a
redeploy.

## Selling the template (one merchant = one isolated copy)
```
npm run new-client          # asks name / phone / e-mail / colour / domain → ../clients/<key>/
```
Then follow `../clients/<key>/CLIENT.md` (merchant's own free Supabase project + free Cloudflare/GitHub Pages).
Brand lives only in `assets/js/brand.config.js` (`npm run brand` re-renders titles/manifest/sitemap/logos).
Merchant manual: `guide.html`. **Handover / تسليم المتجر: `docs/HANDOVER.md`** (what to edit, how to deploy, how to
back up and restore, what to do when something breaks). Pushing fixes to existing merchants: `docs/UPDATING.md`.

## Code layout
See `docs/ARCHITECTURE.md` (services / ui / domain / data / core; `npm run check` = lint + eslint + unit + smoke + db tests).
Before a fresh deployment run `npm run doctor`: it checks the runtime, the files, that the CSP matches on every page,
that the icons are 8-bit, that the service-worker shell references real files, and that the backup module is present.

## What is included

- **Storefront:** home, collections, product pages, wishlist, account, checkout, blog,
  CMS pages, order tracking and warranty-request links. Arabic is the default, with RTL,
  Mauritania flag and light/dark mode. French switches the whole site to LTR.
- **Local payments:** Bankily, Masrvi, Sedad, Click and cash on delivery. Bankily carries
  the configurable 10% promotion. There is no online card charge on the site.
- **Checkout:** customer name, phone, city, address, notes, payment method, coupon code,
  automatic shipping fees, stock checks, abandoned-cart capture and a complete WhatsApp
  order message.
- **Products:** 137 imported demo products, 11 collections, variants, color-specific
  images, battery health, condition, storage, CPU/RAM/screen/keyboard specs, included
  items, FAQs, reviews, related products, stock and low-stock hiding.
- **Dashboard:** overview, orders (status, filters, invoice, shipping label, CSV export),
  abandoned carts, products and bulk pricing, categories, collections, bilingual content,
  navigation, footer, trust bar, homepage sections and hero slides, appearance and colors,
  fonts, marketing coupons and countdown offers, reviews, blog, pages and FAQs, payment
  methods and cities, team accounts, reports, SEO, pixels, store hours, maintenance mode,
  blocklist/rate limits, audit log, forced first-password change, preview and publish.
- **PWA:** installable manifest and service worker with an offline shell.
- **Storage modes:** local-first demo (`localStorage`) with optional Supabase REST sync.
  Supabase is not required to explore the dashboard.

## Run locally

```bash
cd restore-store
python3 -m http.server 8100 --bind 127.0.0.1
```

Open <http://127.0.0.1:8100/>. The dashboard is at
<http://127.0.0.1:8100/dashboard.html>.

### Local demo (development only)

The storefront and dashboard can run locally without Supabase. **Demo staff accounts
are disabled by default** and are not shipped with passwords.

To enable local demo on `localhost` only:

1. Set `"demoEnabled": true` in `assets/js/config.js` (keep it `false` in production).
2. Open the dashboard and sign in as `owner` or `manager`.
3. On first local demo login, enter a **new password you choose** (8+ chars, letters + numbers).
   The password is stored only as a local PBKDF2 hash in your browser.

For production, use Supabase Auth + the `restore_staff` table and the
`admin-create-staff` Edge Function. Never enable demo mode on a public deployment.

The dashboard asks for the store WhatsApp number. The default number is a placeholder:
`+222 46 00 00 00` (`22246000000`). Replace it before accepting real orders.

Use the dashboard **Publish** button after edits. Until publishing, changes remain in
`restore_draft_v1` and are visible only in preview. Publishing writes `restore_state_v1`
and notifies other open tabs immediately.

To reset local demo data, open **Settings → متقدم → إعادة تعيين البيانات المحلية**.

## Testing

```bash
npm install
npm run check          # lint → lint:js → format:check → typecheck → unit → smoke → db   (≈1 min, no browser)
npm run test:e2e:install && npm run test:e2e   # Playwright (Chromium), local demo mode, ≈20 s
npm run check:full     # everything above + secret scan
```

Every generated client (`npm run new-client`) ships with the same scripts minus Playwright, and its `ALL_IN_ONE.sql`
already contains the demo catalog, so the first order works right after the SQL paste. See `docs/ARCHITECTURE.md`
("Quality gates") for what each step proves.

## Deploy to Vercel

1. Push this directory to a Git repository.
2. Import it into Vercel as an **Other** project.
3. Vercel runs `node scripts/build-config.mjs`; add these environment variables if you
   want Supabase:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (the public anon/publishable key only)
4. Deploy. The site works in demo mode when the variables are absent.
5. Add your custom domain in Vercel and update the dashboard SEO base URL.

`vercel.json` configures cache headers, security headers and the build command. Service
workers require HTTPS in production.

### Supabase

See [`supabase/README.md`](supabase/README.md) and run
[`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor. It creates the
state, order, abandoned-cart and audit tables, RLS policies and the public
`restore-media` bucket.

The dashboard uploads images to Supabase Storage when remote mode is active. In local
mode images are resized and stored as data URLs inside the local draft/state.

> The anon key is public by design. Never put a `service_role` key in this repository.
> Disable public sign-ups so only staff accounts can write. For a high-traffic shop,
> put order inserts behind an Edge Function / CAPTCHA.

## Data model: where is the source of truth?

| Entity | Local demo | Supabase (after migrations 0002 + 0003) |
| --- | --- | --- |
| Products, variants, collections | `localStorage` JSON | **`restore_products`, `restore_product_variants`, `restore_collections`, `restore_collection_products`** |
| Coupons | JSON (`settings.coupons`) | **`restore_coupons`** (same rows `restore_create_order_v2` validates) |
| Theme, settings, pages, navigation | JSON | `restore_state.data` (JSON document) |
| Orders, customers, reviews, audit | — | relational tables (0001/0002) |

Flow: `dashboard.js` → `R.catalog` (state.js) → `data/repositories/catalog.repo.js` → PostgREST (RLS `is_staff()`).
Mapping between UI objects and rows lives only in `domain/catalog-mappers.js`. First time: dashboard → Products →
**Import catalog to tables** (or `scripts/migrate-state-to-tables.mjs`).

## Editing content

All storefront content lives in dashboard state, not in the HTML. The defaults are in
`assets/js/state.js`; the imported product catalog is in `assets/js/data.js`. Categories,
products, copy, images, colors, fonts, menus, banners, coupons, pages, FAQs and reviews
are editable from the dashboard after login. Product/section changes propagate to all
pages through shared state.

### URLs

- `collection.html?handle=<handle>` or `collection.html?q=<search>`
- `product.html?handle=<handle>`
- `page.html?slug=<slug>`
- `blog-post.html?slug=<slug>`

## File map

```
index.html, collection.html, product.html, checkout.html, wishlist.html,
account.html, blog.html, blog-post.html, page.html, dashboard.html
assets/css/styles.css      base layout and legacy component styles
assets/css/restore.css     Restore theme, RTL/LTR, dark mode, responsive rules
assets/css/dashboard.css   admin dashboard
assets/js/config.js        Supabase/public settings (no secrets, no shipped passwords)
assets/js/data.js          imported demo catalog
assets/js/state.js         state, auth, pricing, orders, Supabase adapter, sanitizers
assets/js/app.js           storefront renderer and interactions
assets/js/dashboard.js     admin application
assets/img/                logos, flags, PWA icons, hero/promo art
assets/products/           catalog photography
supabase/schema.sql        database, RLS and storage setup
supabase/functions/create-order/index.ts        server-side order validation (deploy in Supabase)
supabase/functions/admin-create-staff/index.ts  owner-only staff provisioning
sw.js, manifest.webmanifest
scripts/build-config.mjs   Vercel environment injection
```

## Local storage keys

| Key | Contents |
| --- | --- |
| `restore_state_v1` | Published store state |
| `restore_draft_v1` | Unpublished dashboard changes |
| `restore_managers_v1` | Local staff accounts and password hashes |
| `restore_orders_v1` | Demo orders |
| `restore_abandoned_v1` | Abandoned carts |
| `restore_audit_v1` | Audit log |
| `restore_session_v1` | Current demo session |
| `restore_lang_v1` | `ar` or `fr` |
| `restore_theme_v1` | `light` or `dark` |
| `restore_cart_v1` | Cart items |
| `restore_wish_v1` | Wishlist handles |
| `restore_dash_lang_v1` | Dashboard language |

There is deliberately no JSON backup/restore feature. Orders can be exported as CSV from
the dashboard.

## Production checklist

- [ ] **Disable demo mode:** keep `demoEnabled:false` in `assets/js/config.js` for public deployments.
- [ ] **Supabase Auth for staff:** create staff via `admin-create-staff`; assign `app_metadata.role` (`owner`/`manager`).
- [ ] **Deploy server-side order validation:** deploy `supabase/functions/create-order` with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ALLOWED_ORIGIN` (your site URL). The app now **requires** server validation in remote mode (`requireServerOrders:true`); if the function is unavailable, checkout fails instead of accepting client-priced totals.
- [ ] **Run hardened RLS schema:** apply `supabase/schema.sql` (staff-scoped policies, no public abandoned-cart/order inserts, atomic `restore_create_order` RPC, least-privilege grants).
- [ ] **Never expose secrets:** only the anon/publishable key belongs in client config. Never commit `service_role`, `.env.local`, or `.vercel/project.json`. If leaked, rotate/revoke tokens and purge git history.
- [ ] **Review CSP:** `script-src` and `style-src` both drop `unsafe-inline`/`unsafe-eval` — there are no inline scripts, no `style` attributes and no `<style>` blocks; dynamic styling goes through `data-sv` + `assets/js/ui/style-vars.js` (CSSOM) and the utility layer in `assets/css/restore.css`. Keep it that way: `npm run lint` fails on a new inline style. Third-party pixels increase attack surface—enable only what you need.
- [ ] **XSS hygiene:** user/CMS content is escaped in key rendering paths and a `sanitizeRichHTML` helper is available; review any new `innerHTML` sinks and sanitize rich HTML.
- [ ] **Service worker cache:** bump `CACHE` in `sw.js` after security/config changes.

## Notes and limitations

- Demo reviews, press quotes and customer names are fictional sample content.
- Product photography and catalog copy are prototype assets; confirm rights and replace
  with your own photos before a commercial launch.
- Local demo mode stores orders in the browser only. Configure Supabase for durable,
  multi-device orders.
- WhatsApp confirmation is manual, by design. Bankily/Masrvi/Sedad/Click are payment
  choices; actual transfer confirmation happens over WhatsApp. No card data is collected.
- **Architecture:** this is a static client app. Server-side validation (Edge Functions),
  strict RBAC, and atomic inventory/pricing are required for a high-trust production store.
- The placeholder email is `hello@restore.mr`; update it with your real contact details.
