#!/usr/bin/env node
/* Missing-asset lint: every literal "assets/…" path referenced from HTML/JS/CSS/manifest must exist on disk.
   (1.5.x de-branding deleted images but left references → broken hero; e2e 03 caught a 404 default image in 1.6.0.) */
import fs from "node:fs";
import path from "node:path";
const root = process.argv[2] || process.cwd();
const files = [];
const walk = (d, depth = 0) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (
      [
        "node_modules",
        ".git",
        "docs",
        "supabase",
        "clients",
        "vendor",
        "playwright-report",
        "test-results",
        "scripts",
        "tests",
        "e2e"
      ].includes(e.name)
    )
      continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (depth < 5) walk(p, depth + 1);
    } else if (/\.(html|js|mjs|css|webmanifest)$/.test(e.name)) files.push(p);
  }
};
walk(root);
const re = /["'(](assets\/[A-Za-z0-9_\-./@]+?\.(?:svg|png|jpe?g|webp|gif|ico|woff2?|ttf|mp4|webm|json|css|js))["')?#]/g;
const missing = new Map();
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  for (const m of s.matchAll(re)) {
    const ref = m[1];
    if (/\$\{|\*|%/.test(ref)) continue; // template / glob
    if (!fs.existsSync(path.join(root, ref))) missing.set(ref, [...(missing.get(ref) || []), path.relative(root, f)]);
  }
}
if (missing.size) {
  for (const [ref, from] of missing) console.error(`MISSING ASSET: ${ref}  ← ${[...new Set(from)].join(", ")}`);
  process.exit(1);
}
console.log(`assets ok: no dangling asset references in ${files.length} files`);
