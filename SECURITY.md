# Security Policy

## Supported versions
This repository is a project template. Security fixes are applied to the current working tree/release branch in use.

## Reporting a vulnerability
- **Do not** open a public issue for suspected security vulnerabilities.
- Report privately to the store/project owner with: affected file/URL, impact, reproduction steps, and any proof-of-concept.
- For a live store deployment, replace this section with a real security contact (email/PGP/form) and response SLA.

## Threat model (summary)
- **Assets:** staff credentials/sessions, customer PII in orders/abandoned carts, published catalog/state, media uploads, order totals/stock integrity.
- **Trust boundaries:** browser (untrusted for prices/totals/stock/roles), Supabase anon key (public), Supabase Auth JWT claims (`app_metadata.role`), Edge Functions with `service_role` (trusted server boundary), staff-only dashboard operations.
- **Key controls:** RLS with `is_staff()/is_owner()`, no public abandoned-cart/order writes by default, server-side atomic order validation (`restore_create_order`/`create-order`), shared rate limiting, optional Turnstile (opt-in; fail-closed only when `TURNSTILE_REQUIRED=true`), CSP tightened (`script-src` and `style-src` without `unsafe-inline/eval`), local vendored DOMPurify sanitization, demo mode disabled by default.
- **Automated controls (1.4.0):** GitHub Actions CI on every push/PR (architecture guard, ESLint no-undef, unit, jsdom smoke of every page, PostgreSQL 16 migration + RLS tests, secret scan for JWT/service_role literals), weekly Dependabot (npm + actions), CycloneDX SBOM artifact + `npm audit --audit-level=high`.
- **Rate limiting:** `create-order` and `admin-create-staff` both call the shared `restore_rate_hit` RPC (service_role only; verified by test). Staff login uses Supabase Auth's built-in limits plus a client-side lockout after repeated failures.
- **Privacy:** analytics pixels (Meta/TikTok/GA) load only after explicit consent (`restore_consent_v1`); SRI is not applicable to those vendor loaders (they rotate files) — consent gating is the control. All first-party scripts are same-origin under a CSP without `unsafe-inline`/`unsafe-eval`; styles are same-origin too — no `style` attributes, no `<style>` blocks, dynamic values only through CSSOM (`data-sv`).
- **Headers (vercel.json):** HSTS (2 years, preload), COOP/CORP same-origin, nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy, CSP; `dashboard.html` is `no-store` + `noindex`.
- **Known residual risks:** static client architecture; `img-src` still allows `https:` (merchant-supplied product images); sessions are memory/sessionStorage-limited (no HttpOnly backend cookies); distributed rate limiting requires deployed RPC/table; third-party analytics pixels increase surface; entry files were modularized in 1.3.0 but modules still share a `ctx` object (see docs/ARCHITECTURE.md).
- **Secrets:** never commit `service_role`, `.env.local`, `.vercel/project.json`, or JWTs. Rotate immediately if exposed and purge git history.
