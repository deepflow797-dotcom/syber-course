/* Tooling tests: new-client output, brand lint failure path, CSP parity between vercel.json and generated _headers. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT } from "./helpers/boot.mjs";

const run = (args, cwd = ROOT) => spawnSync(process.execPath, args, { cwd, encoding: "utf8" });
const out = fs.mkdtempSync(path.join(os.tmpdir(), "nc-"));
const gen = run([
  "scripts/new-client.mjs",
  "--key",
  "acme",
  "--ar",
  "متجر أكمي",
  "--fr",
  "Acme Shop",
  "--phone",
  "22241234567",
  "--email",
  "owner@acme.example",
  "--color",
  "#16a34a",
  "--domain",
  "acme.pages.dev",
  "--out",
  out
]);
const dest = path.join(out, "acme");
const read = (f) => fs.readFileSync(path.join(dest, f), "utf8");

test("new-client exits 0 and creates the client folder", () => {
  assert.equal(gen.status, 0, gen.stderr || gen.stdout);
  assert.ok(fs.existsSync(path.join(dest, "index.html")));
});
test("new-client output: brand.config.js carries the merchant identity, not the template's", () => {
  const b = read("assets/js/brand.config.js");
  assert.ok(
    b.includes('"Acme Shop"') && b.includes("متجر أكمي") && b.includes("acme.pages.dev") && b.includes("#16a34a"),
    b.slice(0, 400)
  );
});
test("new-client output: package.json renamed and pinned to the template version", () => {
  const pkg = JSON.parse(read("package.json"));
  const tpl = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.name, "store-acme");
  assert.equal(pkg.templateVersion, tpl.version);
  assert.equal(pkg.client.key, "acme");
});
test("new-client output: ALL_IN_ONE.sql = schema + every migration + seed, in order", () => {
  const sql = read("supabase/ALL_IN_ONE.sql");
  const idx = [
    "schema.sql",
    "0002_relational.sql",
    "0003_catalog_source_of_truth.sql",
    "0004_catalog_atomic.sql",
    "0005_fix_create_order_v2.sql",
    "seed: demo catalog"
  ].map((m) => sql.indexOf(m));
  assert.ok(
    idx.every((i) => i >= 0),
    JSON.stringify(idx)
  );
  assert.deepEqual(
    idx,
    [...idx].sort((a, b) => a - b)
  );
  assert.equal((sql.match(/insert into public\.restore_products \(/g) || []).length, 21);
});
test("new-client output contains no secrets and no template brand leaks", () => {
  assert.ok(
    !/eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}|sb_secret_[a-zA-Z0-9_]+|serviceRoleKey\s*:\s*"[^"]+"/.test(
      read("assets/js/config.js")
    )
  );
  const brand = run(["scripts/check-brand.mjs"], dest);
  assert.equal(brand.status, 0, brand.stderr);
  assert.ok(!fs.existsSync(path.join(dest, "node_modules")));
});
test("new-client output: _headers, zero-secret automation workflows, manifest", () => {
  assert.ok(read("_headers").includes("Content-Security-Policy"));
  for (const wf of ["keepalive.yml", "content-backup.yml", "template-update.yml", "ci.yml"])
    assert.ok(fs.existsSync(path.join(dest, ".github/workflows", wf)), wf);
  assert.ok(!fs.existsSync(path.join(dest, ".github/workflows/release.yml")), "template-only workflow not copied");
  assert.ok(!fs.existsSync(path.join(dest, "automation")));
  assert.ok(!fs.existsSync(path.join(dest, "e2e")));
  assert.ok(!fs.existsSync(path.join(dest, "clients.json")));
  assert.ok(!read(".github/workflows/keepalive.yml").includes("secrets."), "keepalive needs no secrets");
  assert.ok(read(".github/workflows/keepalive.yml").includes("scripts/keepalive.mjs"));
  const manifest = JSON.parse(read("template-manifest.json"));
  assert.equal(manifest.templateVersion, JSON.parse(read("package.json")).templateVersion);
  assert.ok(manifest.files.includes("assets/js/app.js"));
  assert.ok(!manifest.files.some((f) => f.startsWith("e2e/") || f === "clients.json"));
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts.lighthouse, undefined);
  assert.equal(pkg.devDependencies["@playwright/test"], undefined);
  assert.ok(pkg.scripts["update:check"]);
  assert.ok(read("CLIENT.md").includes("ALL_IN_ONE.sql"));
  assert.ok(read("CLIENT.md").includes("Self-update"));
});
test("check-brand FAILS when a banned brand string is present in a shopper-visible file", () => {
  const leak = fs.mkdtempSync(path.join(os.tmpdir(), "leak-"));
  fs.mkdirSync(path.join(leak, "assets/js"), { recursive: true });
  fs.writeFileSync(path.join(leak, "assets/js/x.js"), 'const s = "cdn.shopify.com/x.png";');
  fs.copyFileSync(path.join(ROOT, "scripts/check-brand.mjs"), path.join(leak, "check-brand.mjs"));
  const r = spawnSync(process.execPath, ["check-brand.mjs"], { cwd: leak, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /BRAND LEAK/);
  fs.rmSync(leak, { recursive: true, force: true });
});
test("CSP parity: generated _headers carries the same Content-Security-Policy as vercel.json, without unsafe-inline in script-src", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const vcsp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy").value;
  const line = read("_headers")
    .split("\n")
    .find((l) => l.trim().startsWith("Content-Security-Policy:"));
  assert.ok(line, "_headers has no CSP");
  assert.equal(line.trim().slice("Content-Security-Policy:".length).trim(), vcsp);
  const script = vcsp
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("script-src"));
  assert.ok(script && !script.includes("'unsafe-inline'"), script);
  assert.ok(!/default-src[^;]*'unsafe-inline'/.test(vcsp));
});
test("template vercel.json and template _headers also agree (apply-brand keeps them in sync)", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const vcsp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy").value;
  const line = fs
    .readFileSync(path.join(ROOT, "_headers"), "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith("Content-Security-Policy:"));
  assert.equal(line.trim().slice("Content-Security-Policy:".length).trim(), vcsp);
});
test.after(() => fs.rmSync(out, { recursive: true, force: true }));
/* ---------- P6: doctor + handover docs ---------- */

test("doctor exits 0 on a ready repository", () => {
  const result = run(["scripts/doctor.mjs"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /READY — 0 blocking problem/);
});

test("doctor fails and names the page when a page loses its meta CSP", () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-"));
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "reports") continue;
    fs.cpSync(path.join(ROOT, entry.name), path.join(sandbox, entry.name), { recursive: true });
  }
  const page = path.join(sandbox, "guide.html");
  fs.writeFileSync(page, fs.readFileSync(page, "utf8").replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, ""));
  const result = run(["scripts/doctor.mjs"], sandbox);
  assert.equal(result.status, 1, "a page without a policy must be a blocking problem");
  assert.match(result.stdout, /FAIL meta CSP drift — guide\.html/);
});

test("the handover document exists and covers the three questions a merchant asks", () => {
  const docs = fs.readFileSync(path.join(ROOT, "docs/HANDOVER.md"), "utf8");
  assert.match(docs, /أين أعدّل ماذا/, "where to edit");
  assert.match(docs, /النشر/, "how to deploy");
  assert.match(docs, /النسخ الاحتياطي والاستعادة/, "how to back up and restore");
  assert.match(docs, /service_role/, "the one forbidden thing is stated");
  assert.match(docs, /Handover \(English\)/, "the English half exists too");
});
