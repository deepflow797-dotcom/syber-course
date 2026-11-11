#!/usr/bin/env node
/* The template must stay brand-neutral: no leftover names of the original store in anything a shopper or merchant can see. */
import fs from "fs";
import path from "path";
const banned = [/ريستور/, /Restore Maurit/i, /restore\.mr\b/i, /cdn\.shopify\.com/i, /hello@restore/i];
const files = [];
const walk = (d, depth) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (["node_modules", ".git", "docs", "supabase", "tests", "scripts", "clients"].includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (depth < 4) walk(p, depth + 1);
    } else if (/\.(js|html|css|webmanifest|xml|txt|json)$/.test(e.name) && !/CHANGELOG|package-lock/.test(e.name))
      files.push(p);
  }
};
walk(".", 0);
let fail = 0;
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  for (const re of banned) {
    const m = s.match(re);
    if (m) {
      console.error(`BRAND LEAK: ${f} contains "${m[0]}"`);
      fail = 1;
    }
  }
}
if (fail) process.exit(1);
console.log(`brand neutral: ${files.length} files clean`);
