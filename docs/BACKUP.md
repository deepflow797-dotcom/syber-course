# Backup & restore (Supabase)

## 1. Point-in-time recovery (recommended for production)
Supabase Dashboard → Project → Database → Backups → enable **PITR** (Pro plan add-on).
Gives second-level restore for the retention window. Nothing to script.

## 2. Weekly logical dump (free tier / extra safety)
Run from any machine with `pg_dump` ≥ 15 (connection string: Dashboard → Settings → Database → URI, use the *session* pooler or direct host).

```bash
export PGURL="postgresql://postgres.<ref>:<password>@<host>:5432/postgres"
pg_dump "$PGURL" \
  --schema=public --no-owner --no-privileges \
  --table='public.restore_*' \
  --format=custom --file="restore-$(date +%F).dump"
```
Keep at least 4 weekly + 3 monthly dumps in a bucket that is **not** the Supabase project (e.g. Backblaze/Drive). Encrypt them: `gpg -c restore-*.dump`.

Automate with GitHub Actions (`schedule: cron '0 3 * * 0'`) storing `PGURL` as a repository secret, or with a cron job on any VPS.

## 3. Restore drill (do this once before selling the product)
1. Create a **new** empty Supabase project.
2. Apply migrations in order: `schema.sql` (0001) → `0002` → `0003` → `0004`.
3. Restore data only:
   ```bash
   pg_restore --data-only --no-owner --disable-triggers -d "$NEW_PGURL" restore-YYYY-MM-DD.dump
   ```
   `--disable-triggers` avoids duplicate audit rows (`restore_audit_log`) during the load.
4. Re-create the Storage bucket for media and copy objects (`supabase storage cp -r` or the dashboard).
5. Point `assets/js/config.js` (built by `scripts/build-config.mjs`) to the new URL/anon key, deploy, log in, verify: products list, one test order, one dashboard edit → row in `restore_audit_log`.
6. Record the date and duration of the drill in `docs/VERIFICATION.md`.

## 4. What is NOT in the DB dump
- Storage objects (product images) → back up the bucket separately.
- Edge Function secrets (`TURNSTILE_SECRET`, etc.) → keep in your password manager.
- Auth users are in schema `auth` → add `--schema=auth` to the dump if you want staff/customers restored with their password hashes.
