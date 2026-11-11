#!/usr/bin/env node
/* Creates a COMPLETELY SEPARATE copy of the store for one merchant (own folder → own git repo → own Supabase → own domain).
   Nothing is shared between clients. Zero paid services.
   Usage (interactive):  npm run new-client
   Usage (non-interactive): node scripts/new-client.mjs --key ahmed --ar "متجر أحمد" --fr "Ahmed Store" --phone 22241234567 --email a@b.c --color "#16a34a" --domain ahmed.pages.dev --out ../clients */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, arr) =>
      a.startsWith("--") ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "true"] : null
    )
    .filter(Boolean)
);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = async (key, q, dflt = "") =>
  args[key] ?? (process.stdin.isTTY ? (await rl.question(`${q}${dflt ? ` [${dflt}]` : ""}: `)).trim() || dflt : dflt);

const key = (await ask("key", "Short key (latin, used for folder/repo/subdomain)", "client1"))
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, "-");
const ar = await ask("ar", "Store name (Arabic)", "متجري");
const fr = await ask("fr", "Store name (Latin/French)", "My Store");
const tagAr = await ask("tagline", "Tagline (Arabic)", "منتجات أصلية وتوصيل سريع");
const phone = (await ask("phone", "Phone / WhatsApp (digits with country code)", "22200000000")).replace(/\D/g, "");
const email = await ask("email", "Contact e-mail", `contact@${key}.com`);
const city = await ask("city", "City (Arabic)", "نواكشوط");
const color = await ask("color", "Primary colour (hex)", "#2563eb");
const domain = await ask("domain", "Domain or subdomain (can be empty now)", `${key}.pages.dev`);
const out = path.resolve(await ask("out", "Output folder", "../clients"));
rl.close();

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(out, key);
if (fs.existsSync(dest)) {
  console.error(`✖ ${dest} already exists`);
  process.exit(1);
}
const skip = new Set(["node_modules", ".git", "clients", "Unselected files", ".vercel", "sbom.cdx.json"]);
const copy = (a, b) => {
  fs.mkdirSync(b, { recursive: true });
  for (const e of fs.readdirSync(a, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const s = path.join(a, e.name),
      d = path.join(b, e.name);
    e.isDirectory() ? copy(s, d) : fs.copyFileSync(s, d);
  }
};
copy(src, dest);
const W = (f, c) => fs.writeFileSync(path.join(dest, f), c);
const dial = "+" + phone.slice(0, 3);
const phoneDisplay = `${dial} ${phone.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ")}`;

// 1. brand config
let brand = fs.readFileSync(path.join(src, "assets/js/brand.config.js"), "utf8");
const set = (k, v) => {
  brand = brand.replace(new RegExp(`(\\n  ${k}: )[^\\n]*`), (m, p) => `${p}${JSON.stringify(v)},`);
};
set("key", key);
set("name", { ar, fr });
set("legalName", { ar, fr });
set("tagline", { ar: tagAr, fr: tagAr });
set("city", { ar: city, fr: city });
set("address", { ar: `${city}`, fr: `${city}` });
set("phone", dial + phone.slice(3));
set("phoneDisplay", phoneDisplay);
set("whatsapp", phone);
set("email", email);
set("staffEmailDomain", email.split("@")[1] || "example.com");
set("domain", domain);
brand = brand.replace(/primary: "#[0-9a-fA-F]{6}"/, `primary: "${color}"`);
W("assets/js/brand.config.js", brand);

// 2. static branding (titles, manifest, sitemap, logos)
execSync(`node scripts/apply-brand.mjs "${dest}"`, { cwd: src, stdio: "inherit" });

// 3. package.json name + version pin of the template this client was cut from
const pkg = JSON.parse(fs.readFileSync(path.join(dest, "package.json"), "utf8"));
pkg.name = `store-${key}`;
pkg.description = `${fr} — online store`;
pkg.templateVersion = pkg.version;
pkg.client = { key, createdAt: new Date().toISOString().slice(0, 10) };
// client repos have no Playwright suite (removed below): strip e2e from scripts and devDependencies
for (const k of Object.keys(pkg.scripts))
  pkg.scripts[k] = pkg.scripts[k]
    .replace(/ e2e\b/g, "")
    .replace(/ "e2e\/\*\*\/\*\.mjs"/g, "")
    .replace(/ "\*\.mjs"/g, "");
delete pkg.scripts["test:e2e"];
delete pkg.scripts["test:e2e:install"];
pkg.scripts["check:full"] = "npm run check && bash scripts/check-secrets.sh";
delete pkg.devDependencies["@playwright/test"];
W("package.json", JSON.stringify(pkg, null, 2) + "\n");

// 4. one-paste SQL for the merchant's own Supabase project
const sqlFiles = [
  "supabase/schema.sql",
  ...fs
    .readdirSync(path.join(src, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => "supabase/migrations/" + f)
];
// seed: demo catalog in the tables so the very first order validates (jsdom boot of the client's own data/brand)
let seedSql = "";
try {
  seedSql = execSync(`node scripts/seed-catalog.mjs "${dest}"`, {
    cwd: src,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  });
} catch {
  console.warn("warning: catalog seed skipped (is jsdom installed? run npm install in the template)");
}
W(
  "supabase/ALL_IN_ONE.sql",
  `-- ${fr} — complete database setup. Paste the WHOLE file into Supabase → SQL Editor → Run (once).\n-- Generated ${new Date().toISOString()} from template ${pkg.templateVersion}: ${sqlFiles.join(", ")}${seedSql ? ", seed" : ""}\n\n` +
    sqlFiles.map((f) => `-- ===== ${f} =====\n` + fs.readFileSync(path.join(src, f), "utf8")).join("\n\n") +
    (seedSql ? "\n\n" + seedSql : "")
);

// 5. env example filled
W(
  ".env.local.example",
  `# ${fr} — copy to .env.local (never commit). Public values only; service_role stays in Supabase → Edge Function secrets.\nSUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co\nSUPABASE_ANON_KEY=eyJ...\n# SUPABASE_SERVICE_ROLE_KEY=  <- only when deploying Edge Functions from this machine\n`
);

// 6. keep-alive (free Supabase projects pause after 7 idle days)
fs.mkdirSync(path.join(dest, ".github/workflows"), { recursive: true });
W(
  ".github/workflows/keepalive.yml",
  `name: Keep Supabase awake\non:\n  schedule:\n    - cron: "17 6 */3 * *"   # every 3 days\n  workflow_dispatch:\npermissions: {}\njobs:\n  ping:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Light read through PostgREST (anon key is public by design)\n        run: |\n          test -n "\${{ secrets.SUPABASE_URL }}" || { echo "Set repo secrets SUPABASE_URL and SUPABASE_ANON_KEY"; exit 1; }\n          curl -fsS "\${{ secrets.SUPABASE_URL }}/rest/v1/restore_catalog_meta?select=id&limit=1" -H "apikey: \${{ secrets.SUPABASE_ANON_KEY }}" -H "Authorization: Bearer \${{ secrets.SUPABASE_ANON_KEY }}" > /dev/null && echo "awake"\n`
);

// 5b. keep generated JS/JSON Prettier-clean so the client's own `npm run check` passes out of the box
try {
  execSync(
    `npx --no-install prettier --log-level warn --write "${path.join(dest, "assets/js/brand.config.js")}" "${path.join(dest, "package.json")}"`,
    { cwd: src, stdio: "inherit" }
  );
} catch {
  console.warn("warning: prettier not installed in the template — run `npm run format` inside the client");
}

// 6b. lighter CI for the merchant repo (no Playwright/SBOM: a client repo only needs the fast guards)
W(
  ".github/workflows/ci.yml",
  `name: CI\non:\n  push:\n    branches: [main, master]\n  pull_request:\npermissions:\n  contents: read\njobs:\n  check:\n    runs-on: ubuntu-latest\n    timeout-minutes: 10\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: npm\n      - run: npm ci\n      - run: npm run lint\n      - run: npm run lint:js\n      - run: npm run typecheck\n      - run: npm test\n      - run: npm run test:smoke\n      - name: Secret scan\n        run: |\n          ! grep -rnE "eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}" --include=*.js --include=*.mjs --include=*.json --include=*.html --exclude-dir=node_modules . || (echo "JWT-looking literal found" && exit 1)\n          ! grep -rn "service_role" assets/ --include=*.js || (echo "service_role must never appear in client code" && exit 1)\n`
);
fs.rmSync(path.join(dest, "e2e"), { recursive: true, force: true });
fs.rmSync(path.join(dest, "playwright.config.mjs"), { force: true });

// 7. Cloudflare Pages / Netlify headers (same policy as vercel.json)
const vercel = JSON.parse(fs.readFileSync(path.join(src, "vercel.json"), "utf8"));
W(
  "_headers",
  vercel.headers
    .map(
      (h) =>
        `${h.source.replace(/\(\.\*\)/g, "*").replace(/\/\(([^)]+)\)/, (m, g) => "/" + g.split("|")[0])}\n` +
        h.headers.map((x) => `  ${x.key}: ${x.value}`).join("\n")
    )
    .join("\n\n") + "\n"
);

// 8. delivery checklist
W(
  "CLIENT.md",
  `# ${fr} / ${ar} — delivery checklist
Template version: ${pkg.templateVersion} · created ${pkg.client.createdAt} · key: \`${key}\` · domain: \`${domain}\`

Everything below is free. Nothing is shared with any other merchant.

## A. Supabase (merchant's own account — use the merchant's e-mail: ${email})
1. https://supabase.com → Sign up with **${email}** → New project → name \`${key}\`, region closest to the merchant, strong DB password (save it).
2. Project → **SQL Editor** → New query → paste the whole file \`supabase/ALL_IN_ONE.sql\` → **Run**. Expect "Success. No rows returned".
3. Project → **Authentication → Users → Add user** → e-mail + password of the merchant (this is the dashboard owner login). Copy the user's UUID.
4. SQL Editor → run BOTH statements (replace PASTE-UUID twice). \`name\` is JSON, and the \`owner\` role must also be
   written into the user's JWT (\`app_metadata.role\`) — RLS reads it from there; without it the dashboard shows nothing:
   \`\`\`sql
   insert into public.restore_staff (auth_id, username, email, name, role, active, must_change_password)
   values ('PASTE-UUID', '${key}', '${email}', '{"ar":${JSON.stringify(ar)},"fr":${JSON.stringify(fr)}}'::jsonb, 'owner', true, true);

   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"owner"}'::jsonb
   where id = 'PASTE-UUID';
   \`\`\`
   If the merchant was already logged in to the dashboard: sign out and sign in again so the new JWT carries the role.
5. Project → **Storage** → confirm bucket \`restore-media\` exists (created by the SQL). If not: New bucket \`restore-media\`, public.
6. Project → **Settings → API** → copy **Project URL** and **anon public** key into \`assets/js/config.js\` (\`supabaseUrl\`, \`supabaseAnonKey\`). Never paste the service_role key anywhere in this repo.
7. Edge Functions (needs Supabase CLI once on your machine: \`npm i -g supabase\`):
   \`\`\`bash
   supabase login
   supabase link --project-ref <PROJECT-REF>
   supabase secrets set ALLOWED_ORIGIN=https://${domain}
   # SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically (the CLI refuses to set SUPABASE_* names).
   # If Cloudflare rejects the project name, use the name it gives you and re-run this line with the real URL.
   # optional bot protection later: TURNSTILE_SECRET_KEY=... TURNSTILE_REQUIRED=true
   supabase functions deploy create-order --no-verify-jwt
   supabase functions deploy admin-create-staff --no-verify-jwt
   \`\`\`

## B. Hosting (free, commercial use allowed) — Cloudflare Pages (recommended) or GitHub Pages
1. Create a **new private GitHub repo** for this merchant only, push this folder (\`git init && git add . && git commit -m "init" && git push\`).
2. Repo → Settings → Secrets → add \`SUPABASE_URL\` and \`SUPABASE_ANON_KEY\` (for the keep-alive workflow).
3. Cloudflare Pages → Create project → connect the repo → Framework: None, build command: *(empty)*, output dir: \`/\` → Deploy. URL: \`https://${key}.pages.dev\`.
   (GitHub Pages alternative: Settings → Pages → Deploy from branch → main / root.)
4. Custom domain later: Pages → Custom domains → add → follow DNS instructions. Then set \`domain\` in \`assets/js/brand.config.js\`, run \`npm run brand\`, commit.

## C. Hand-over to the merchant
- Dashboard: \`https://${domain}/dashboard.html\` — login = the e-mail/password from step A3. Ask them to change the password on first login.
- Send them \`guide.html\` (\`https://${domain}/guide.html\`) — the merchant manual in Arabic.
- The demo catalog is already in the tables (seeded by ALL_IN_ONE.sql) — orders work from the first minute. Replace the demo products/images from the dashboard. (If you skipped the seed: Products → "نقل الكتالوج إلى الجداول" once.)
- Settings → logo, colours, phone, WhatsApp, cities, payment methods.

## D. Verify (5 minutes)
- [ ] Storefront opens, no console errors; products visible.
- [ ] Dashboard login works; add a product; it appears on the storefront after publish.
- [ ] Place a test order on the storefront → appears in Dashboard → Orders.
- [ ] Keep-alive workflow runs green (Actions → run manually once).
`
);

// 9. license for this copy
W(
  "LICENSE-CLIENT.txt",
  `Single-store licence
Licensee: ${fr} (${ar}) · key: ${key} · issued: ${pkg.client.createdAt}
This copy may be used for ONE online store operated by the licensee on its own domain(s).
The licensee may modify it for its own use. The licensee may NOT resell, sublicense, redistribute
or offer it as a template/service to third parties. Updates/support terms are agreed separately.
The template author keeps all rights in the template. Third-party components keep their own licences (see LEGAL.md).
`
);
console.log(`\n✔ Client created at ${dest}\n  next: open ${path.join(dest, "CLIENT.md")} and follow A → D`);
