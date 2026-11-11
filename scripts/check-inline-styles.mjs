#!/usr/bin/env node
/* CSP guard — exits 1 on anything the browser blocks under `style-src 'self'`:
   1. a `style="…"` attribute in markup or in a template string,
   2. a `<style>` block in an HTML page,
   3. `style.cssText` / `setAttribute("style", …)` (an inline style in disguise),
   4. a `style-src` that still lists `'unsafe-inline'`.
   Data-driven values belong in `data-sv="…"` (see assets/js/core/style-vars.js), everything else is a
   utility class from assets/css/restore.css. Feeds are not scanned: they are user content, not templates. */
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] || process.cwd();
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "reports",
  "docs",
  "supabase",
  "clients",
  "playwright-report",
  "test-results",
  "scripts",
  "tests",
  "e2e"
]);
const problems = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(html|js|mjs)$/.test(entry.name)) check(file);
  }
}

/** Strips one line of code, tracking multi-line block comments through `state`. */
function stripComment(line, state) {
  let out = "";
  let rest = line;
  while (rest.length) {
    if (state.inBlock) {
      const end = rest.indexOf("*/");
      if (end === -1) return out;
      rest = rest.slice(end + 2);
      state.inBlock = false;
      continue;
    }
    const start = rest.indexOf("/*");
    const lineComment = rest.indexOf("//");
    if (lineComment !== -1 && (start === -1 || lineComment < start)) return out + rest.slice(0, lineComment);
    if (start === -1) return out + rest;
    out += rest.slice(0, start);
    rest = rest.slice(start + 2);
    state.inBlock = true;
  }
  return out;
}

function check(file) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const src = fs.readFileSync(file, "utf8");
  const state = { inBlock: false };
  src.split("\n").forEach((line, i) => {
    const where = `${rel}:${i + 1}`;
    const code = stripComment(line, state);
    if (!code.trim()) return;
    if (/\sstyle="/.test(code)) problems.push(`${where} inline style attribute — use a utility class or data-sv`);
    if (/<style[\s>]/.test(code)) problems.push(`${where} <style> block — move it to assets/css/`);
    if (/\.style\.cssText\s*=/.test(code)) problems.push(`${where} style.cssText — use a class`);
    if (/setAttribute\(\s*["']style["']/.test(code)) problems.push(`${where} setAttribute("style") — use a class`);
  });
}

walk(root);

for (const headerFile of ["vercel.json", "_headers"]) {
  const file = path.join(root, headerFile);
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, "utf8");
  const styleSrc = src.match(/style-src[^;"]*/);
  if (styleSrc && styleSrc[0].includes("'unsafe-inline'"))
    problems.push(`${headerFile} style-src still allows 'unsafe-inline'`);
}

if (problems.length) {
  console.error(`INLINE STYLE: ${problems.length} finding(s) the CSP would block`);
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}
console.log("inline-style ok: no style attributes, style blocks, cssText or unsafe-inline");
