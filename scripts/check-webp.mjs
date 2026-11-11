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
console.log("icons ok: 8-bit and within budget");

/* Vendored DOMPurify must be a current release: the banner version is the source of truth, and the runtime reads the
   same string. A stale sanitizer is a security regression, not a nitpick — 3.2.x has published mXSS bypasses. */
const purgeFile = path.join(process.argv[2] || process.cwd(), "assets/vendor/purify.min.js");
if (fs.existsSync(purgeFile)) {
  const banner = fs.readFileSync(purgeFile, "utf8").slice(0, 200);
  const version = banner.match(/DOMPurify (\d+\.\d+\.\d+)/)?.[1];
  const [major, minor] = String(version || "0.0.0")
    .split(".")
    .map(Number);
  if (!version) ((fail = 1), console.error("VENDOR assets/vendor/purify.min.js: license banner lost its version"));
  else if (major !== 3 || minor < 3) {
    fail = 1;
    console.error(
      `VENDOR assets/vendor/purify.min.js: ${version} is older than the 3.3 floor (known sanitizer bypasses)`
    );
  } else console.log(`vendor ok: DOMPurify ${version}`);
}

if (fail) process.exit(1);
