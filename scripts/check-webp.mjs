#!/usr/bin/env node
/* Guard for the PWA icons: a 16-bit PNG of flat art wastes half its bytes (the browser downloads all of it).
   Fails when an icon under assets/img is not 8-bit, or is larger than the budget below. */
import fs from "node:fs";
import path from "node:path";

const BUDGETS = { "pwa-192.png": 16 * 1024, "pwa-512.png": 32 * 1024, "apple-touch-icon.png": 16 * 1024 };
const dir = path.join(process.argv[2] || process.cwd(), "assets/img");
let fail = 0;
for (const [name, budget] of Object.entries(BUDGETS)) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) continue;
  const buf = fs.readFileSync(file);
  const bitDepth = buf[24];
  const size = buf.length;
  if (bitDepth !== 8) {
    console.error(`ICON ${name}: ${bitDepth}-bit PNG — re-encode at 8 bits (node scripts/png-optimize.mjs <in> <out>)`);
    fail = 1;
  }
  if (size > budget) {
    console.error(`ICON ${name}: ${size} bytes over the ${budget}-byte budget`);
    fail = 1;
  }
}
if (fail) process.exit(1);
console.log("icons ok: 8-bit and within budget");
