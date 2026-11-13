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
import { copyTemplate, listTemplateFiles, deriveClientPackage, CLIENT_CI_YML } from "./lib/client-sync.mjs";

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
const repo = await ask("repo", "GitHub repo of this store for automatic updates (owner/name, can be empty)", "");
rl.close();

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(out, key);
if (fs.existsSync(dest)) {
  console.error(`✖ ${dest} already exists`);
  process.exit(1);
}
copyTemplate(src, dest, { protect: false });
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
const templatePkg = JSON.parse(fs.readFileSync(path.join(src, "package.json"), "utf8"));
const pkg = deriveClientPackage(templatePkg, {
  key,
  fr,
  createdAt: new Date().toISOString().slice(0, 10),
  templateRepo: templatePkg.template?.repo
});
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

// 6. automation (no secrets needed): keep-alive, weekly content backup, self-update from the template's releases
fs.mkdirSync(path.join(dest, ".github/workflows"), { recursive: true });
const automation = path.join(src, "automation/client");
if (fs.existsSync(automation))
  for (const f of fs.readdirSync(automation))
    fs.copyFileSync(path.join(automation, f), path.join(dest, ".github/workflows", f));
fs.rmSync(path.join(dest, "automation"), { recursive: true, force: true });
fs.rmSync(path.join(dest, ".github/workflows/release.yml"), { force: true });
// 6a. template-manifest.json: which files the template owns in this copy (lets a later update delete obsolete ones)
W(
  "template-manifest.json",
  JSON.stringify(
    { templateVersion: pkg.templateVersion, generatedAt: new Date().toISOString(), files: listTemplateFiles(src) },
    null,
    2
  ) + "\n"
);
// 6b. register the store in the template's clients.json so a release pushes the update to it (push mode)
if (repo) {
  const cj = path.join(src, "clients.json");
  const list = fs.existsSync(cj) ? JSON.parse(fs.readFileSync(cj, "utf8")) : { clients: [] };
  if (!list.clients.some((c) => c.repo === repo)) {
    list.clients.push({ repo, key });
    fs.writeFileSync(cj, JSON.stringify(list, null, 2) + "\n");
  }
}

// 5b. keep generated JS/JSON Prettier-clean so the client's own `npm run check` passes out of the box
try {
  execSync(
    `node "${path.join(src, "node_modules/prettier/bin/prettier.cjs")}" --log-level warn --write assets/js/brand.config.js package.json`,
    { cwd: dest, stdio: "inherit" } // run inside the client so its own .prettierrc / ignore files apply
  );
} catch {
  console.warn("warning: prettier not installed in the template — run `npm run format` inside the client");
}

// 6c. lighter CI for the merchant repo (no Playwright/SBOM: a client repo only needs the fast guards)
W(".github/workflows/ci.yml", CLIENT_CI_YML);

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
2. No repository secrets needed: keep-alive, weekly backup and self-update read the public URL/key from \`config.js\`.
3. Cloudflare Pages → Create project → connect the repo → Framework: None, build command: *(empty)*, output dir: \`/\` → Deploy. URL: \`https://${key}.pages.dev\`.
   (GitHub Pages alternative: Settings → Pages → Deploy from branch → main / root.)
4. Custom domain later: Pages → Custom domains → add → follow DNS instructions. Then set \`domain\` in \`assets/js/brand.config.js\`, run \`npm run brand\`, commit.

## C. Hand-over to the merchant
- Dashboard: \`https://${domain}/dashboard.html\` — login = the e-mail/password from step A3. Ask them to change the password on first login.
- Send them \`guide.html\` (\`https://${domain}/guide.html\`) — the merchant manual in Arabic.
- The demo catalog is already in the tables (seeded by ALL_IN_ONE.sql) — orders work from the first minute. Replace the demo products/images from the dashboard. (If you skipped the seed: Products → "نقل الكتالوج إلى الجداول" once.)
- Settings → logo, colours, phone, WhatsApp, cities, payment methods.

## C2. Automation (already in the repo — nothing to configure)
- **Keep Supabase awake**: every 3 days (\`.github/workflows/keepalive.yml\`) — reads the public URL/key from \`config.js\`, no secrets.
- **Weekly content backup**: Mondays → \`backups/content-YYYY-MM-DD.json\` committed to the repo (public catalog/pages/reviews; orders need \`docs/BACKUP.md\`).
- **Self-update from the template**: daily check of the template's latest release (\`template-update.yml\`); protected files (\`config.js\`, \`brand.config.js\`, this file, licence, \`ALL_IN_ONE.sql\`, \`.env*\`, \`backups/\`) are never touched; the update is pushed only when \`npm run check\` passes, then the host redeploys. If the template repo is private, add secret \`TEMPLATE_TOKEN\` (fine-grained PAT, Contents: read) — or let the template push instead (its \`release.yml\` + \`clients.json\`).
- New SQL migrations cannot be applied without the database password: the workflow opens a GitHub issue listing the files to paste into SQL Editor.

## D. Verify (5 minutes)
- [ ] Storefront opens, no console errors; products visible.
- [ ] Dashboard login works; add a product; it appears on the storefront after publish.
- [ ] Place a test order on the storefront → appears in Dashboard → Orders.
- [ ] Actions → "Keep Supabase awake" → Run workflow → green. (Backup and update workflows run on their schedule.)
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
