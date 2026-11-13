/* Secret guard, cross-platform (replaces scripts/check-secrets.sh so Windows machines can run check:full too).
   - Blocks .env / .env.* / *.local / .vercel paths from being committed (templates *.example are fine).
   - Blocks any file containing a JWT-looking literal ("eyJhbGc…") except the documented examples.
   Scope: staged files when inside a git repo, otherwise every file in the tree (minus node_modules/.git).
   Exit 1 on the first problem class found. */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const posix = (p) => p.split(path.sep).join("/");

function stagedFiles() {
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
    return execSync("git diff --cached --name-only --diff-filter=ACM", { encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return null;
  }
}

function allFiles(dir, rel = "") {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...allFiles(path.join(dir, e.name), r));
    else out.push(r);
  }
  return out;
}

const files = (stagedFiles() ?? allFiles(ROOT)).map(posix);
const isExample = (f) => f.endsWith(".example") || f.endsWith("/README.txt");
const isSecretPath = (f) =>
  /(^|\/)\.env($|\.)/.test(f) ||
  f.endsWith(".local") ||
  f === ".vercel" ||
  f.startsWith(".vercel/") ||
  f.includes("/.vercel/");
// assets/js/config.js carries the PUBLIC anon key (a JWT on older Supabase projects) by design.
const skipScan = (f) =>
  isExample(f) ||
  f.endsWith("scripts/check-secrets.mjs") ||
  f.endsWith("scripts/check-secrets.sh") ||
  f === "assets/js/config.js";

let fail = 0;
for (const f of files) {
  if (!isExample(f) && isSecretPath(f)) {
    console.error(`BLOCKED secret/path: ${f}`);
    fail = 1;
    continue;
  }
  if (skipScan(f)) continue;
  const abs = path.join(ROOT, f);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
  if (fs.readFileSync(abs, "latin1").includes("eyJhbGc")) {
    console.error(`BLOCKED possible JWT/token in: ${f}`);
    fail = 1;
  }
}
if (!fail) console.log(`secrets ok (${files.length} files scanned)`);
process.exit(fail);
