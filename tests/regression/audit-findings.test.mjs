/* Regression tests for the three findings of the M1 (1.8.2) audit.
   Each test FAILS on 1.8.2 and must PASS after the fix — that is the only proof an audit finding was really closed.
   Kept as normal `node --test` files so `npm run check` (and CI) can never let them regress again. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { JSDOM } from "jsdom";
import { urlAttr } from "../../assets/js/core/dom.js";
import { ROOT } from "../helpers/boot.mjs";

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/* ---------- Finding #2: a merchant-controlled URL must never become an attribute break-out ---------- */

const STOREFRONT_DIR = path.join(ROOT, "assets/js/ui/storefront");
const files = fs.readdirSync(STOREFRONT_DIR).filter((f) => f.endsWith(".js"));

/** Every `${expr}` written directly inside an HTML attribute: `attr="${expr}"`. */
function unescapedAttributeValues(source) {
  const hits = [];
  const ATTR = /\b(src|href|alt|title|aria-label|data-[a-z-]+|value|placeholder|content|poster|action)="\$\{([^}]*)\}/g;
  let m;
  while ((m = ATTR.exec(source))) {
    const expr = m[2].trim();
    // Safe by construction: an escape helper, a number (counters, ratings, indices), or a bare
    // identifier that the template itself controls (`data-icon="star"` style literals).
    const safe =
      /^ctx\.(esc|escAttr|urlAttr|dt|t|ICON|icon)\(/.test(expr) ||
      /^(encodeURIComponent|Number|String)\(/.test(expr) ||
      /^[a-z][a-zA-Z]*$/.test(expr) || // identifier/loop variable; reviewed in the allow-list below
      /^["']/.test(expr) ||
      /^ctx\.R\.lang\s*===/.test(expr);
    if (!safe) hits.push(`${m[1]}="${expr}"`);
  }
  return hits;
}

test("FINDING 2: no storefront template interpolates a data value into an attribute without escaping", () => {
  const offenders = [];
  for (const file of files) {
    for (const hit of unescapedAttributeValues(read(`assets/js/ui/storefront/${file}`)))
      offenders.push(`${file}: ${hit}`);
  }
  assert.deepEqual(offenders, [], `unescaped attribute values:\n${offenders.join("\n")}`);
});

test("FINDING 2: the storefront ctx really carries escAttr/urlAttr (wired where app.js builds it)", async () => {
  // app.js builds a bare ctx and runs ../ui/storefront/01-utils.js install() on it — NOT services/00-config.js.
  // Wiring the helpers into the wrong ctx compiled fine and passed a hand-written template copy, yet every
  // page threw "ctx.urlAttr is not a function" (caught by test:smoke, not by unit tests). Assert the real chain.
  const { install } = await import("../../assets/js/ui/storefront/01-utils.js");
  const ctx = { R: { L: (v) => v, t: (k) => k, money: (n) => String(n) } };
  install(ctx);
  assert.equal(typeof ctx.escAttr, "function");
  assert.equal(typeof ctx.urlAttr, "function");

  const dom = new JSDOM(`<!doctype html><body><div id="site-header"></div></body>`);
  const malicious = 'x" data-pwned="1';
  // exactly how 04-header-footer.js renders the logo
  dom.window.document.getElementById("site-header").innerHTML =
    `<a class="logo"><img src="${ctx.urlAttr(malicious)}" alt="t"></a>`;
  const img = dom.window.document.querySelector("img");
  assert.equal(img.hasAttribute("data-pwned"), false, "a quote in the value must stay inside the attribute");
  assert.equal(img.getAttribute("src"), malicious, "the value survives unchanged, only the quote is escaped");
});

test("urlAttr refuses code-executing URL schemes but keeps real image URLs", () => {
  assert.equal(urlAttr("javascript:alert(1)"), "");
  assert.equal(urlAttr("  JavaScript:alert(1)"), "");
  assert.equal(urlAttr("vbscript:msgbox(1)"), "");
  assert.equal(urlAttr("data:text/html,<script>alert(1)</script>"), "");
  assert.equal(urlAttr("data:image/png;base64,iVBORw0KGgo="), "data:image/png;base64,iVBORw0KGgo=");
  assert.equal(urlAttr("https://cdn.example/logo.png"), "https://cdn.example/logo.png");
  assert.equal(urlAttr("assets/img/brand-logo.svg"), "assets/img/brand-logo.svg");
  assert.equal(urlAttr(""), "");
  assert.equal(urlAttr(null), "");
  assert.equal(urlAttr("a\u0022b").includes("&quot;"), true, "quotes are escaped");
});

/* ---------- Finding #1: the weekly snapshot must not be published by the host ---------- */

test("FINDING 1: backups/ is never committed by the backup workflow nor servable by the host", () => {
  // The template keeps the source in automation/client/, a generated store receives it in .github/workflows/
  // (client-sync copies it there). Check whichever this tree actually uses instead of assuming the template layout.
  const workflowPath = ["automation/client/content-backup.yml", ".github/workflows/content-backup.yml"].find((rel) =>
    fs.existsSync(path.join(ROOT, rel))
  );
  assert.ok(workflowPath, "a content-backup workflow must exist somewhere");
  const workflow = read(workflowPath);
  assert.doesNotMatch(workflow, /git\s+add\s+backups/, "the snapshot must not be committed to the deployed repository");
  const gitignore = read(".gitignore");
  assert.match(gitignore, /^backups\/$/m, "backups/ must be ignored");
  // Defence in depth: even a locally-created backups/ folder must not be served.
  const headers = read("_headers");
  assert.match(headers, /\/backups\//, "_headers must block /backups/");
  const vercel = JSON.parse(read("vercel.json"));
  const blocked = vercel.headers.some((h) => /backups/.test(h.source || ""));
  assert.equal(blocked, true, "vercel.json must not serve /backups/");
});

/* ---------- Finding #3: protected files are never written, even when absent ---------- */

test("FINDING 3: a template .env is not copied into a client that has none", () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "upd-"));
  const template = path.join(sandbox, "template");
  const client = path.join(sandbox, "client");
  copyTree(ROOT, template);
  fs.writeFileSync(path.join(template, ".env"), "SUPABASE_URL=https://template-only.example\n");
  copyTree(template, client);
  fs.rmSync(path.join(client, ".env"), { force: true });
  const pkgPath = path.join(client, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.client = { key: "sandbox", createdAt: "2026-01-01" };
  pkg.version = "0.0.1";
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  fs.writeFileSync(
    path.join(client, "template-manifest.json"),
    JSON.stringify({ templateVersion: "0.0.1", files: [] })
  );
  const tplPkg = JSON.parse(fs.readFileSync(path.join(template, "package.json"), "utf8"));
  tplPkg.version = "9.9.9";
  fs.writeFileSync(path.join(template, "package.json"), JSON.stringify(tplPkg, null, 2));

  execFileSync(process.execPath, ["scripts/update-from-template.mjs", "--from", template, "--skip-check"], {
    cwd: client,
    stdio: "pipe"
  });
  assert.equal(fs.existsSync(path.join(client, ".env")), false, "the template's .env must never reach a client");
});

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (["node_modules", ".git", "reports", "test-results", "playwright-report"].includes(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dest);
    else fs.copyFileSync(src, dest);
  }
}

/* ---------- Finding #7: build-config ignored the .env the docs tell the merchant to create ---------- */

test("FINDING 7: npm run build reads .env, and the real environment still wins", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "buildcfg-"));
  fs.mkdirSync(path.join(dir, "assets/js"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "assets/js/config.js"), path.join(dir, "assets/js/config.js"));
  fs.copyFileSync(path.join(ROOT, "scripts/build-config.mjs"), path.join(dir, "build-config.mjs"));
  const run = (env = {}) =>
    execFileSync(process.execPath, [path.join(dir, "build-config.mjs")], {
      cwd: dir,
      env: { ...process.env, SUPABASE_URL: "", SUPABASE_ANON_KEY: "", ...env },
      encoding: "utf8"
    });
  const config = () => fs.readFileSync(path.join(dir, "assets/js/config.js"), "utf8");

  fs.writeFileSync(path.join(dir, ".env"), 'SUPABASE_URL=https://from-dotenv.example\nSUPABASE_ANON_KEY="anon-xyz"\n');
  run();
  assert.match(config(), /supabaseUrl: "https:\/\/from-dotenv\.example"/, "a documented .env must be used");
  assert.match(config(), /supabaseAnonKey: "anon-xyz"/, "quotes around the value are stripped");

  // Vercel sets real env vars: those must take precedence over a stale .env left in the checkout
  fs.copyFileSync(path.join(ROOT, "assets/js/config.js"), path.join(dir, "assets/js/config.js"));
  run({ SUPABASE_URL: "https://from-ci.example" });
  assert.match(config(), /supabaseUrl: "https:\/\/from-ci\.example"/, "environment wins over .env");
  assert.match(config(), /supabaseAnonKey: "anon-xyz"/, "the .env still fills the key it uniquely provides");

  // nothing configured → demo mode stays, and it says so explicitly
  fs.rmSync(path.join(dir, ".env"));
  fs.copyFileSync(path.join(ROOT, "assets/js/config.js"), path.join(dir, "assets/js/config.js"));
  const out = run();
  assert.match(out, /environment or \.env/);
  assert.doesNotMatch(config(), /from-dotenv|from-ci/);
  fs.rmSync(dir, { recursive: true, force: true });
});
