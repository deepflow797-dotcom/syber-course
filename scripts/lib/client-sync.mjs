/* Shared rules for "what a client copy is, relative to the template".
   Used by scripts/new-client.mjs (first cut) and scripts/update-from-template.mjs (every later release), so a client
   produced today and a client updated in a year are shaped by the same code. */
import fs from "node:fs";
import path from "node:path";

/** Template entries that never go into a client copy. */
export const TEMPLATE_SKIP = new Set([
  "node_modules",
  ".git",
  "clients",
  "Unselected files",
  ".vercel",
  "sbom.cdx.json",
  "reports",
  "test-results",
  "PROGRESS.md",
  ".kilocode",
  "playwright-report",
  "e2e",
  "playwright.config.mjs",
  "clients.json",
  "template-manifest.json",
  "automation" // workflows for clients are installed into .github/workflows by new-client / update
]);

/** Template files that are replaced by a client-specific version (see new-client / update script). */
export const TEMPLATE_REPLACED = new Set([".github/workflows/ci.yml", ".github/workflows/release.yml"]);

/** Client files that an update must NEVER overwrite or delete (merchant identity, secrets, generated-per-client). */
export const CLIENT_PROTECTED = [
  "assets/js/config.js",
  "assets/js/brand.config.js",
  "CLIENT.md",
  "LICENSE-CLIENT.txt",
  "supabase/ALL_IN_ONE.sql",
  ".env.local.example",
  ".env",
  ".env.local",
  ".env.production"
];
export const CLIENT_PROTECTED_PREFIXES = ["backups/", ".git/", "node_modules/"];

/** @param {string} rel posix relative path */
export function isProtected(rel) {
  return CLIENT_PROTECTED.includes(rel) || CLIENT_PROTECTED_PREFIXES.some((p) => rel.startsWith(p));
}

/** All template-owned files (posix relative paths) under `root`, honouring TEMPLATE_SKIP. */
export function listTemplateFiles(root) {
  /** @type {string[]} */
  const out = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (TEMPLATE_SKIP.has(e.name)) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (TEMPLATE_SKIP.has(r)) continue;
      if (e.isDirectory()) walk(path.join(dir, e.name), r);
      else out.push(r);
    }
  };
  walk(root, "");
  return out.sort();
}

/** Copy template → client. Returns the list of files written. Protected client files are left alone. */
export function copyTemplate(src, dest, { protect = true } = {}) {
  const written = [];
  for (const rel of listTemplateFiles(src)) {
    if (TEMPLATE_REPLACED.has(rel)) continue;
    // Protected means protected: a client file is never written from the template, whether or not it already
    // exists. The old `&& fs.existsSync(dest)` guard copied the template's .env into a store that had none
    // (audit finding #3 of 1.8.2).
    if (protect && isProtected(rel)) continue;
    const to = path.join(dest, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(src, rel), to);
    written.push(rel);
  }
  return written;
}

/**
 * Turn the template package.json into the client one (name, pins, no browser-only gates).
 * @param {Record<string, any>} templatePkg
 * @param {{ key: string, fr: string, createdAt: string, templateRepo?: string }} client
 */
export function deriveClientPackage(templatePkg, client) {
  const pkg = JSON.parse(JSON.stringify(templatePkg));
  pkg.name = `store-${client.key}`;
  pkg.description = `${client.fr} — online store`;
  pkg.templateVersion = templatePkg.version;
  pkg.template = { repo: client.templateRepo || templatePkg.template?.repo || "" };
  pkg.client = { key: client.key, createdAt: client.createdAt };
  for (const k of Object.keys(pkg.scripts))
    pkg.scripts[k] = pkg.scripts[k]
      .replace(/ e2e\b/g, "")
      .replace(/ "e2e\/\*\*\/\*\.mjs"/g, "")
      .replace(/ "\*\.mjs"/g, "");
  for (const k of [
    "test:e2e",
    "test:e2e:install",
    "csp:live",
    "lighthouse",
    "lighthouse:report",
    "new-client",
    "release"
  ])
    delete pkg.scripts[k];
  for (const d of ["@playwright/test", "lighthouse", "chrome-launcher"]) delete pkg.devDependencies[d];
  pkg.scripts["check:full"] = "npm run check && node scripts/check-secrets.mjs";
  return pkg;
}

/** Client CI: the fast guards only (no Chromium, no SBOM). */
export const CLIENT_CI_YML = `name: CI
on:
  push:
    branches: [main, master]
  pull_request:
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run lint:js
      - run: npm run typecheck
      - run: npm test
      - run: npm run test:smoke
      - run: npm audit --audit-level=high --omit=dev
      - name: Secret scan
        run: |
          ! grep -rnE "eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}" --include=*.js --include=*.mjs --include=*.json --include=*.html --exclude-dir=node_modules --exclude=config.js . || (echo "JWT-looking literal found" && exit 1)
          ! grep -rnE "service_role[A-Za-z_]*\\s*[:=]\\s*['\\"][A-Za-z0-9._-]{20,}" assets/ --include=*.js || (echo "service_role key assignment found in client code" && exit 1)
`;

/** Read the public Supabase coordinates from a client's config.js (they are public by design — every visitor gets them). */
export function readSupabaseConfig(configJs) {
  const url = configJs.match(/supabaseUrl:\s*"(https:\/\/[^"]+)"/)?.[1] || "";
  const anonKey = configJs.match(/supabaseAnonKey:\s*"([^"]+)"/)?.[1] || "";
  return { url: url.replace(/\/$/, ""), anonKey };
}

/** semver-ish compare: 1 if a > b, -1 if a < b, 0 if equal. */
export function compareVersions(a, b) {
  const pa = String(a).replace(/^v/, "").split(".").map(Number);
  const pb = String(b).replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}
