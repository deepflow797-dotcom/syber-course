import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  isProtected,
  listTemplateFiles,
  copyTemplate,
  deriveClientPackage,
  readSupabaseConfig,
  compareVersions,
  TEMPLATE_SKIP
} from "../scripts/lib/client-sync.mjs";

const mk = (root, files) => {
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
};

test("protected client files are exactly the merchant-specific ones", () => {
  for (const f of [
    "assets/js/config.js",
    "assets/js/brand.config.js",
    "CLIENT.md",
    "LICENSE-CLIENT.txt",
    "supabase/ALL_IN_ONE.sql",
    ".env.local.example",
    ".env",
    ".env.local",
    "backups/content-2026-01-01.json"
  ])
    assert.ok(isProtected(f), f);
  for (const f of [
    "assets/js/app.js",
    "supabase/schema.sql",
    "supabase/migrations/0002_relational.sql",
    "index.html",
    "package.json",
    "docs/BACKUP.md"
  ])
    assert.ok(!isProtected(f), f);
});

test("listTemplateFiles skips template-only entries; copyTemplate never overwrites protected files", () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), "tpl-"));
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "cli-"));
  mk(src, {
    "index.html": "new",
    "assets/js/app.js": "new",
    "assets/js/config.js": "TEMPLATE CONFIG",
    "e2e/x.spec.mjs": "x",
    "clients.json": "{}",
    "node_modules/a/index.js": "x",
    ".github/workflows/release.yml": "x",
    ".github/workflows/ci.yml": "template ci"
  });
  const files = listTemplateFiles(src);
  assert.deepEqual(files, [
    ".github/workflows/ci.yml",
    ".github/workflows/release.yml",
    "assets/js/app.js",
    "assets/js/config.js",
    "index.html"
  ]);
  for (const s of TEMPLATE_SKIP) assert.ok(!files.some((f) => f === s || f.startsWith(s + "/")), s);
  mk(dest, { "assets/js/config.js": "CLIENT CONFIG", "assets/js/app.js": "old" });
  const written = copyTemplate(src, dest, { protect: true });
  assert.equal(fs.readFileSync(path.join(dest, "assets/js/config.js"), "utf8"), "CLIENT CONFIG");
  assert.equal(fs.readFileSync(path.join(dest, "assets/js/app.js"), "utf8"), "new");
  assert.ok(!fs.existsSync(path.join(dest, ".github/workflows/release.yml")), "replaced workflows are not copied");
  assert.ok(!written.includes("assets/js/config.js"));
  // first cut (protect:false) does copy config.js so the client has a starting file
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), "cli2-"));
  copyTemplate(src, fresh, { protect: false });
  assert.equal(fs.readFileSync(path.join(fresh, "assets/js/config.js"), "utf8"), "TEMPLATE CONFIG");
});

test("deriveClientPackage pins the template, strips browser-only gates and keeps client identity", () => {
  const tpl = {
    name: "restore-store",
    version: "1.8.0",
    template: { repo: "Al-SAFWA/store-template" },
    scripts: {
      check: "a",
      "test:e2e": "x",
      lighthouse: "y",
      "csp:live": "z",
      "new-client": "n",
      release: "r",
      "check:full": "old"
    },
    devDependencies: { "@playwright/test": "1", lighthouse: "2", "chrome-launcher": "3", eslint: "9" }
  };
  const pkg = deriveClientPackage(tpl, { key: "ahmed", fr: "Ahmed Store", createdAt: "2026-01-02" });
  assert.equal(pkg.name, "store-ahmed");
  assert.equal(pkg.templateVersion, "1.8.0");
  assert.equal(pkg.template.repo, "Al-SAFWA/store-template");
  assert.deepEqual(pkg.client, { key: "ahmed", createdAt: "2026-01-02" });
  for (const k of ["test:e2e", "lighthouse", "csp:live", "new-client", "release"])
    assert.equal(pkg.scripts[k], undefined, k);
  assert.deepEqual(Object.keys(pkg.devDependencies), ["eslint"]);
  assert.match(pkg.scripts["check:full"], /npm run check/);
  assert.equal(tpl.scripts.lighthouse, "y", "input not mutated");
});

test("readSupabaseConfig + compareVersions", () => {
  const cfg =
    'const x = { supabaseUrl: "https://abc.supabase.co/", supabaseAnonKey: "sb_publishable_123", mode: "auto" };';
  assert.deepEqual(readSupabaseConfig(cfg), { url: "https://abc.supabase.co", anonKey: "sb_publishable_123" });
  assert.deepEqual(readSupabaseConfig('supabaseUrl: ""'), { url: "", anonKey: "" });
  assert.equal(compareVersions("1.7.1", "1.7.0"), 1);
  assert.equal(compareVersions("v1.7.0", "1.7.0"), 0);
  assert.equal(compareVersions("1.10.0", "1.9.9"), 1);
  assert.equal(compareVersions("1.7.0", "2.0.0"), -1);
});
