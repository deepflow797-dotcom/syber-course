#!/usr/bin/env node
/* Complexity ratchet: ESLint reports `complexity` as a warning for legacy services/ui code. This script fails when the
   number of such warnings grows beyond .complexity-baseline.json (so refactors can only lower it).
   Usage: node scripts/check-complexity.mjs            (check)
          node scripts/check-complexity.mjs --update   (rewrite the baseline after a refactor that lowered it) */
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const BASE = ".complexity-baseline.json";
const r = spawnSync("npx", ["--no-install", "eslint", "assets/js", "-f", "json"], {
  encoding: "utf8",
  shell: process.platform === "win32"
});
let report;
try {
  report = JSON.parse(r.stdout);
} catch {
  console.error("eslint did not produce JSON:", (r.stderr || r.stdout).slice(0, 400));
  process.exit(1);
}
const warnings = report.flatMap((f) =>
  f.messages
    .filter((m) => m.ruleId === "complexity" && m.severity === 1)
    .map((m) => `${f.filePath.replace(process.cwd() + "/", "")}:${m.line}`)
);
const current = { count: warnings.length, functions: warnings.sort() };
if (process.argv.includes("--update")) {
  fs.writeFileSync(BASE, JSON.stringify(current, null, 2) + "\n");
  console.log(`baseline updated: ${current.count} functions over the complexity budget`);
  process.exit(0);
}
const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, "utf8")) : { count: 0, functions: [] };
if (current.count > base.count) {
  console.error(`complexity ratchet: ${current.count} functions over budget (baseline ${base.count}). New offenders:`);
  for (const f of current.functions.filter((x) => !base.functions.includes(x))) console.error("  " + f);
  process.exit(1);
}
console.log(`complexity ratchet ok: ${current.count} legacy functions over budget (baseline ${base.count}, limit 15)`);
