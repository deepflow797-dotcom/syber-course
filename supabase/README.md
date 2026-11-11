# Restore + Supabase Setup

This guide walks you through connecting the Restore storefront/dashboard to Supabase for
persistent, cross-device data sync and staff authentication.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**.
2. Choose a region close to your users (e.g., `eu-west-1` for Mauritania/Europe).
3. Wait for the database to be ready (usually < 2 minutes).

---

## 2. Run the Database Schema

1. In the Supabase dashboard, open **SQL Editor** → **New Query**.
2. Paste the entire contents of `supabase/schema.sql` and **Run**.
3. This creates:
   - Tables: `restore_state`, `restore_orders`, `restore_abandoned`, `restore_audit`,
     `restore_staff`, `restore_customers`, `restore_reviews`, `restore_pages`
   - Helper functions: `is_staff()`, `is_owner()` (read `app_metadata.role` from JWT)
   - Row Level Security (RLS) policies for all tables
   - `restore-media` storage bucket with MIME restrictions (images only, ≤ 5 MB)

---

## 3. Configure Authentication

1. Go to **Authentication > Providers > Email**.
2. Enable **Email** provider.
3. **Disable** "Enable email confirmations" (staff accounts are created by the owner).
4. **Disable** "Enable public sign-ups" (storefront customers use a separate local flow;
   staff accounts are provisioned via the owner-only Edge Function).
5. Save.

---

## 4. Create the Owner Account

1. Go to **Authentication > Users** → **Add user**.
2. Email: `owner@restore.mr` (or your preferred owner email).
3. Password: a strong temporary password (the owner will be forced to change it on first login).
4. **User Metadata** (JSON):
   ```json
   {
     "role": "owner",
     "must_change_password": true
   }
   ```
5. Click **Create user**.

> The `role` claim in `app_metadata` is what `is_staff()` / `is_owner()` read.
> The dashboard writes `must_change_password` to `restore_staff` on first login.

---

## 5. Deploy the `admin-create-staff` Edge Function

Staff accounts are created from the dashboard **Team** tab. This requires a
server-side function that uses the `service_role` key (never exposed to the browser).

1. In the Supabase dashboard, open **Edge Functions** → **Create a new function**.
2. Name: `admin-create-staff`
3. Paste the code from `supabase/functions/admin-create-staff/index.ts` (see below).
4. Deploy.
5. In **Function Settings**, add the following **Secrets**:
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = the `service_role` key from **Project Settings > API**
6. The function is now callable at:
   `https://<project-ref>.supabase.co/functions/v1/admin-create-staff`

### Edge Function Source (`supabase/functions/admin-create-staff/index.ts`)

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is an authenticated owner
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !user) throw new Error("Invalid token");

    const { data: staff } = await supabaseAdmin
      .from("restore_staff")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!staff || staff.role !== "owner") {
      throw new Error("Only the owner can create staff accounts");
    }

    // Read request body
    const { email, password, name, role, whatsapp } = await req.json();
    if (!email || !password || !name?.ar) {
      throw new Error("email, password, and name.ar are required");
    }
    if (role !== "owner" && role !== "manager") {
      throw new Error("role must be 'owner' or 'manager'");
    }

    // Create the auth user
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, must_change_password: true },
    });
    if (createErr) throw createErr;

    // Insert into restore_staff
    const { error: staffErr } = await supabaseAdmin.from("restore_staff").insert({
      auth_id: newUser.user.id,
      username: email,
      email,
      name,
      role,
      whatsapp: whatsapp || "",
      must_change_password: true,
    });
    if (staffErr) throw staffErr;

    return new Response(JSON.stringify({ success: true, id: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

---

## 6. Configure the Storefront / Dashboard

1. Open `assets/js/config.js` in your editor.
2. Set:
   ```js
   window.RESTORE_CONFIG = {
     supabaseUrl: "https://<project-ref>.supabase.co",
     supabaseAnonKey: "<your-anon-key>",
     createStaffFunction: "admin-create-staff",
     staffTable: "restore_staff",
   };
   ```
   Or, in Vercel, add Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

3. The dashboard will now:
   - Authenticate staff via Supabase Auth (email/password).
   - Persist draft/published state, orders, reviews, pages, customers to Supabase.
   - Sync across devices via BroadcastChannel + periodic polling.
   - Allow the owner to create new manager accounts from the **Team** tab.

---

## 7. First Publish

1. Open `dashboard.html` and sign in as the owner.
2. You will be prompted to:
   - Set the store WhatsApp number.
   - Activate at least one payment method.
   - Change your password.
3. Click **Publish** (top right). This writes the `main` row to `restore_state`.
4. Visit the storefront (`index.html`) — it now reads the published state from Supabase.

---

## 8. Storage Bucket

Uploaded images (logos, hero slides, product images, payment app icons) go to the
public `restore-media` bucket. RLS allows:
- **Public read** (anon, authenticated)
- **Staff insert/update/delete** (owner/manager only)

No further configuration is needed.

---

## 9. Local Development (Optional)

You can run the store fully locally without Supabase:
```bash
cd restore-store
python3 -m http.server 8100 --bind 127.0.0.1
```
Demo mode is **disabled by default** and must stay off in production. For localhost
development only, set `demoEnabled: true` in `assets/js/config.js`, then sign in as
`owner` or `manager` and choose a password on first login (the password is never
shipped in the repository).

All local data stays in `localStorage`. For production, configure Supabase Auth and
staff roles instead of demo mode.

---

## 10. Security Notes

| Aspect | Protection |
|--------|------------|
| **Anon key** | Public by design; RLS enforces row access. It is not a substitute for server-side validation. |
| **Service role key** | Only in Edge Function secrets, never in the repo or client code. |
| **Staff writes** | Require `is_staff()` = true (JWT `app_metadata.role` in `owner`, `manager`). |
| **Owner actions** | Require `is_owner()` = true. |
| **Customer data** | Authenticated customers can read/update their own rows (`auth_id = auth.uid()`); staff can manage as needed. No `password_hash` is stored. |
| **Orders** | Direct public insert is disabled by default. **Deploy `create-order` Edge Function** (`ALLOWED_ORIGIN`, optional `TURNSTILE_SECRET_KEY`) which calls atomic `restore_create_order` to validate prices/totals and decrement stock server-side. Staff read/update; customers read own. |
| **Abandoned carts** | Public **insert only** (no public read/update/delete). Staff can manage all. |
| **Reviews** | Public read approved; authenticated customer creates own; staff moderate all. |
| **Pages** | Public read visible; staff manage all. |
| **Images** | Public read, staff-only upload/update/delete; MIME allow-list; 5 MB limit. |
| **Demo mode** | Disabled by default. Local demo passwords are chosen on first login and never committed. |

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Dashboard login fails with "Supabase is not configured" | `config.js` missing or empty | Fill in `supabaseUrl` and `supabaseAnonKey`. |
| "admin-create-staff returned 404" | Edge Function not deployed or wrong name | Deploy function named exactly `admin-create-staff`. |
| New manager can't log in | `must_change_password` not handled | First login forces password change; ensure they complete it. |
| Images don't upload | Bucket policy | Verify `restore_media_staff_insert` policy exists and `is_staff()` returns true. |
| Orders don't appear in dashboard | RLS | Ensure `restore_orders_staff_all` policy uses `is_staff()`. |
| CSP violations in browser console | Inline scripts | All inline scripts moved to `assets/js/theme-init.js` and `assets/js/pixels.js`. Verify `vercel.json` headers match `meta` CSP. |

---

## 12. Going to Production

1. **Custom domain**: Add your domain (e.g., `restore.mr`) in Vercel → Settings → Domains.
2. **HTTPS**: Automatic via Vercel.
3. **CSP**: The `vercel.json` already includes a strict CSP header. If you add more
   third-party scripts (chat widgets, analytics), update both the `<meta>` tag in HTML
   and the `vercel.json` header.
4. **Backups**: Supabase Point-in-Time Recovery (PITR) is enabled by default on Pro+ plans.
5. **Monitoring**: Enable Supabase Logs → Database → Slow queries; Vercel Analytics for frontend.

---

## File Reference

| File | Purpose |
|------|---------|
| `supabase/schema.sql` | Tables, RLS, helpers, storage bucket |
| `supabase/functions/admin-create-staff/index.ts` | Owner-only staff provisioning |
| `assets/js/config.js` | Client-side Supabase config (URL, anon key) |
| `vercel.json` | CSP, security headers, cache control |
| `assets/js/state.js` | Core state, auth, sync, Supabase REST helpers |
| `assets/js/dashboard.js` | Dashboard UI, staff management, publishing |
## Phase 3 data model (migration 0002, draft)
- Apply `supabase/migrations/0002_relational.sql` after `schema.sql` when ready to migrate.
- Run `APPLY=0 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-state-to-tables.mjs` (dry run), then `APPLY=1` to backfill.
- `restore_state` remains the source for settings/theme/navigation/hero/content; catalog/orders move to relational tables.

ERD (text):
  restore_categories 1---* restore_products 1---* restore_product_variants
  restore_collections *---* restore_products (restore_collection_products)
  restore_products 1---* restore_order_items *---1 restore_orders
  restore_product_variants 1---* restore_order_items
  restore_coupons (code PK) referenced logically by orders.coupon_code
  restore_state(settings/content) supports shipping/city/payment config; v2 RPC extends to read it as needed.

Atomicity exception (documented): `restore_create_order`/`restore_create_order_v2` perform validation + stock decrement + order insert in one DB transaction via `security definer` RPC (service_role only) because there is no dedicated backend.


## 0003_catalog_source_of_truth.sql
Makes the catalog tables the only source of truth for products/collections/coupons.
Adds `extra jsonb`, `sku`, `sort_order`, public read of **active** coupons, `restore_catalog_meta` (change marker polled by
the storefront) and the read-only view `restore_products_with_collections`. No business logic — storage only.
Apply after 0002, then import the legacy JSON once (dashboard button or `scripts/migrate-state-to-tables.mjs`).


## 0004_catalog_atomic.sql
Atomic product write/delete RPCs (`restore_upsert_product`, `restore_delete_product`) and the server-side audit trail
(`restore_audit_log` + `restore_audit_row()` trigger). Storage and integrity only — no pricing logic. Apply after 0003.

## 0005_fix_create_order_v2.sql
Critical fix: typed variables in `restore_create_order_v2` (orders without variants / without coupon crashed on 0002).
Apply after 0004. Verified by `npm run test:db`.
