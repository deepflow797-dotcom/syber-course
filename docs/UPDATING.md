# Updating merchants after a template fix

Each merchant is a separate folder/repo cut from a template version (`package.json → templateVersion`).

1. Fix the bug in the **template**, add a CHANGELOG entry, bump the version, run `npm run check`.
2. For each merchant folder: `git -C ../clients/<key> remote add template <template-repo>` (once), then
   `git -C ../clients/<key> fetch template && git -C ../clients/<key> merge template/main`.
   Files that are merchant-specific and never overwritten: `assets/js/brand.config.js`, `assets/js/config.js`,
   `assets/js/data.js` (if customised), `CLIENT.md`, `LICENSE-CLIENT.txt`, `_headers`, `.github/workflows/keepalive.yml`.
3. If the fix includes a new file in `supabase/migrations/`, the merchant must paste **only that file** into their SQL Editor
   (`ALL_IN_ONE.sql` is for first install only). Say so in the CHANGELOG entry.
4. Run `npm run brand` in the merchant folder (re-renders titles/manifest/sitemap from their brand config), commit, push → Pages redeploys.
