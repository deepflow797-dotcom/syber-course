#!/usr/bin/env node
/* Architecture guard — exits 1 on any violation.
   1. core/ domain/ data/ never import ui/ (or services/); services/ never import ui/.
   2. No JS file under assets/js may exceed MAX_LINES.
   3. Every JS file under assets/js must be reachable: imported by another file or loaded by an HTML page (no dead files). */
import fs from "fs";
import path from "path";
const MAX_LINES = 600;
function walk(d, out = []) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.m?js$/.test(f.name)) out.push(p);
  }
  return out;
}
const files = fs.existsSync("assets/js") ? walk("assets/js").map((f) => f.replace(/\\/g, "/")) : [];
const html = fs
  .readdirSync(".")
  .filter((f) => f.endsWith(".html"))
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");
const referenced = new Set();
const allSrc = [];
let fail = 0;
for (const rel of files) {
  const src = fs.readFileSync(rel, "utf8");
  allSrc.push(src);
  const lines = src.split("\n").length;
  if (lines > MAX_LINES) {
    console.error(`SIZE: ${rel} has ${lines} lines (max ${MAX_LINES})`);
    fail = 1;
  }
  const imports = [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  for (const imp of imports) {
    if (!imp.startsWith(".")) continue;
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(rel), imp));
    referenced.add(resolved);
    const layer = rel.match(/assets\/js\/([^/]+)\//)?.[1] || "root";
    const target = resolved.match(/assets\/js\/([^/]+)\//)?.[1] || "root";
    if (["core", "domain", "data", "i18n"].includes(layer) && ["ui", "services"].includes(target)) {
      console.error(`BOUNDARY: ${rel} (${layer}) imports ${target} -> ${imp}`);
      fail = 1;
    }
    if (layer === "services" && target === "ui") {
      console.error(`BOUNDARY: ${rel} imports ui -> ${imp}`);
      fail = 1;
    }
    if (layer === "domain" && target === "data") {
      console.error(`BOUNDARY: ${rel} (domain) imports data -> ${imp}`);
      fail = 1;
    }
  }
}
for (const rel of files) {
  if (referenced.has(rel) || html.includes(rel) || allSrc.some((x) => x.includes(`"${rel}"`))) continue; // dynamic <script src> strings count
  console.error(`DEAD: ${rel} is not imported by any module nor loaded by any HTML page`);
  fail = 1;
}
if (fail) process.exit(1);
console.log(`architecture ok: ${files.length} files, all ≤ ${MAX_LINES} lines, layers respected, no dead files`);
