#!/usr/bin/env node
/* node --check for every JS module under assets/js (replaces the hard-coded 4-file list). */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
function walk(d, out = []) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.m?js$/.test(f.name)) out.push(p);
  }
  return out;
}
let fail = 0;
for (const f of [...walk("assets/js"), "sw.js"]) {
  const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
  if (r.status) {
    fail = 1;
    console.error(r.stderr);
  }
}
if (fail) process.exit(1);
console.log("syntax ok");
