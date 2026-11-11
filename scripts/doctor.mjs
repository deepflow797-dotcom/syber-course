#!/usr/bin/env node
/* Pre-flight check for a fresh clone or a new deployment: `npm run doctor`.
   Answers one question — "is this folder ready to serve the store, and if not, what exactly is missing?"
   Every check prints OK, WARN or FAIL. Exit code is 1 only when something would break the store at runtime.
   Deliberately dependency-free and read-only: safe to run on a merchant folder, in CI, or over SSH. */
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] || process.cwd();
const P = (...p) => path.join(root, ...p);
const read = (file) => fs.readFileSync(file, "utf8");
let failures = 0;
let warnings = 0;

const ok = (label, detail = "") => console.log(`  OK   ${label}${detail ? ` — ${detail}` : ""}`);
const warn = (label, detail = "") => {
  warnings++;
  console.log(`  WARN ${label}${detail ? ` — ${detail}` : ""}`);
};
const bad = (label, detail = "") => {
  failures++;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
};
const section = (title) => console.log(`\n${title}`);

/* ---------- 1. runtime ---------- */
section("Runtime");
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 20) ok("Node", `v${process.versions.node}`);
else bad("Node", `v${process.versions.node} — the CI target is Node 20+, upgrade before deploying`);
if (fs.existsSync(P("node_modules"))) ok("dependencies installed");
else warn("dependencies missing", "run `npm ci` before `npm run check`");

/* ---------- 2. required files ---------- */
section("Store files");
const REQUIRED = [
  "index.html",
  "collection.html",
  "product.html",
  "checkout.html",
  "dashboard.html",
  "assets/js/app.js",
  "assets/js/state.js",
  "assets/js/dashboard.js",
  "assets/js/config.js",
  "assets/js/brand.config.js",
  "assets/css/styles.css",
  "sw.js",
  "manifest.webmanifest",
  "vercel.json",
  "_headers"
];
for (const file of REQUIRED) {
  if (fs.existsSync(P(file))) ok(file);
  else bad(file, "missing — the store cannot boot or deploy without it");
}

/* ---------- 3. config built from the brand ---------- */
section("Configuration");
const configPath = P("assets/js/config.js");
if (fs.existsSync(configPath)) {
  const config = read(configPath);
  const mode = config.match(/mode:\s*"([^"]*)"/)?.[1];
  if (["auto", "local", "supabase"].includes(mode)) ok("config mode", mode);
  else bad("config mode", `unexpected value "${mode ?? "(absent)"}"`);
  if (/supabaseUrl:\s*""/.test(config))
    warn("Supabase URL empty", "local demo mode only; run `npm run build` once credentials are set");
  else ok("Supabase URL set");
  // a real JWT for service_role is a long base64 payload; the word alone is usually a warning comment
  if (/service_role"?\s*:\s*"?ey[A-Za-z0-9_-]{20,}/.test(config))
    bad("service_role key in config", "never ship the service role key to the browser");
} else {
  bad("assets/js/config.js", "run `npm run build`");
}

/* ---------- 4. CSP: one policy everywhere ---------- */
section("Content-Security-Policy");
let headerCSP = "";
try {
  const vercel = JSON.parse(read(P("vercel.json")));
  headerCSP = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy")?.value || "";
  if (headerCSP) ok("vercel.json header");
  else bad("vercel.json header", "no Content-Security-Policy");
} catch (error) {
  bad("vercel.json", error.message);
}
const pages = fs
  .readdirSync(root)
  .filter((f) => f.endsWith(".html"))
  .map((f) => ({ file: f, text: read(P(f)) }));
if (headerCSP.includes("'unsafe-inline'") && /script-src[^;]*'unsafe-inline'/.test(headerCSP))
  bad("policy allows inline scripts", "script-src must not contain 'unsafe-inline'");
const drifting = pages.filter((page) => {
  const meta = page.text.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1];
  return meta !== headerCSP;
});
if (!drifting.length) ok("every page meta CSP matches the header", `${pages.length} pages`);
else bad("meta CSP drift", drifting.map((p) => p.file).join(", "));
const headersFile = fs.existsSync(P("_headers")) ? read(P("_headers")) : "";
if (headersFile.includes(headerCSP.slice(0, 40))) ok("_headers matches the header policy");
else warn("_headers", "CSP not found verbatim in _headers (GitHub Pages deployments rely on it)");

/* ---------- 5. inline styles (P5 guarantee) ---------- */
section("Styles");
const inlineStyle = pages.filter((page) => /\sstyle=/.test(page.text) || /<style[\s>]/.test(page.text));
if (!inlineStyle.length) ok("no inline style attributes or <style> blocks", `${pages.length} pages`);
else bad("inline styles", inlineStyle.map((p) => p.file).join(", "));

/* ---------- 6. images ---------- */
section("Images");
const dimless = [];
for (const page of pages) {
  for (const match of page.text.matchAll(/<img\b[^>]*>/g)) {
    if (!/\bwidth=/.test(match[0]) || !/\bheight=/.test(match[0])) dimless.push(page.file);
  }
}
const uniqueDimless = [...new Set(dimless)];
if (!uniqueDimless.length) ok("static <img> tags carry width/height");
else warn("images without dimensions", uniqueDimless.join(", "));
for (const icon of ["pwa-192.png", "pwa-512.png", "apple-touch-icon.png"]) {
  const file = P("assets/img", icon);
  if (!fs.existsSync(file)) {
    warn(icon, "missing (PWA install prompt will be degraded)");
    continue;
  }
  const buf = fs.readFileSync(file);
  if (buf[24] === 8) ok(icon, `${Math.round(buf.length / 1024)} KB, 8-bit`);
  else warn(icon, `${buf[24]}-bit PNG — re-encode with scripts/png-optimize.mjs`);
}

/* ---------- 7. service worker shell list vs disk ---------- */
section("Service worker");
try {
  const sw = read(P("sw.js"));
  const listed = [...sw.matchAll(/"(assets\/[^"]+)"/g)].map((m) => m[1]);
  const missing = listed.filter((rel) => !fs.existsSync(P(rel)));
  if (!listed.length) warn("sw.js", "no shell list found");
  else if (!missing.length) ok("every file in the shell list exists", `${listed.length} files`);
  else bad("sw.js shell references missing files", missing.join(", "));
  const jsOnDisk = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(P(dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith(".js") && !rel.includes("config.js") && !rel.includes("brand.config.js"))
        jsOnDisk.push(rel);
    }
  };
  walk("assets/js");
  const unlisted = jsOnDisk.filter((rel) => !listed.includes(rel));
  // the dashboard is an online-only tool: its 33 modules are intentionally absent from the storefront shell
  const storefrontUnlisted = unlisted.filter(
    (rel) => !/assets\/js\/(ui\/dashboard|dashboard\.js|services\/0[1-9])/.test(rel)
  );
  if (storefrontUnlisted.length)
    warn(
      "storefront modules not cached offline",
      `${storefrontUnlisted.length}: ${storefrontUnlisted.slice(0, 4).join(", ")}`
    );
  else ok("storefront modules are all cached offline", `dashboard modules excluded by design (${unlisted.length})`);
} catch (error) {
  bad("sw.js", error.message);
}

/* ---------- 8. deployment surface ---------- */
section("Deployment");
for (const file of ["robots.txt", "sitemap.xml"]) {
  if (fs.existsSync(P(file))) ok(file);
  else warn(file, "missing");
}
const manifestPath = P("manifest.webmanifest");
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(read(manifestPath));
    const icons = manifest.icons || [];
    const broken = icons.filter((icon) => !fs.existsSync(P(String(icon.src || "").replace(/^\.?\//, ""))));
    if (broken.length) bad("manifest icons", broken.map((icon) => icon.src).join(", "));
    else ok("manifest icons resolve", `${icons.length} icons`);
  } catch (error) {
    bad("manifest.webmanifest", error.message);
  }
}
if (fs.existsSync(P(".env")) || fs.existsSync(P(".env.local")))
  warn(".env present", "never commit real credentials; check .gitignore");

/* ---------- 9. backup usability (P4) ---------- */
section("Backup");
const backupModule = P("assets/js/domain/backup-format.js");
if (fs.existsSync(backupModule)) {
  const src = read(backupModule);
  const version = src.match(/BACKUP_FORMAT_VERSION\s*=\s*(\d+)/)?.[1];
  ok("backup format available", `version ${version ?? "?"}`);
  if (Number(version) > 1)
    warn("backup format bumped", "older files must still import; check tests/backup-format.test.mjs");
} else {
  warn("backup module missing", "the dashboard cannot export/import a store");
}

/* ---------- summary ---------- */
console.log(`\n${failures ? "FAILED" : "READY"} — ${failures} blocking problem(s), ${warnings} warning(s).`);
if (warnings && !failures) console.log("Warnings do not block serving; read them before a fresh deployment.");
if (failures) console.log("Fix the FAIL lines above, then run `npm run doctor` again.");
process.exit(failures ? 1 : 0);
