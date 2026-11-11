#!/usr/bin/env node
/* Builds `supabase/ALL_IN_ONE.sql` — schema + every migration + the demo-catalog seed in one paste.
   `npm run new-client` generates this file for a merchant folder; this script does the same for the repository
   itself, so `README.md` and `docs/HANDOVER.md` do not point at a file that only exists after running new-client.

   Usage: node scripts/build-sql.mjs [--no-seed] [--out <path>] */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const withSeed = !args.includes("--no-seed");
const outIndex = args.indexOf("--out");
const outFile = outIndex === -1 ? path.join(ROOT, "supabase/ALL_IN_ONE.sql") : path.resolve(args[outIndex + 1]);

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const migrationsDir = path.join(ROOT, "supabase/migrations");
const sqlFiles = [
  "supabase/schema.sql",
  ...fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => `supabase/migrations/${name}`)
];

/** The seed is produced by booting the real storefront in jsdom; without jsdom we still emit the schema. */
function buildSeed() {
  if (!withSeed) return "";
  try {
    return execFileSync(process.execPath, ["scripts/seed-catalog.mjs", ROOT], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"]
    });
  } catch {
    console.warn(
      "warning: demo seed skipped (run `npm ci` first). The database will have the schema but no demo products."
    );
    return "";
  }
}

const seedSql = buildSeed();
const header = [
  `-- Restore store ${pkg.version} — complete database setup.`,
  "-- Paste the WHOLE file into Supabase → SQL Editor → Run (once, on an empty project).",
  `-- Generated ${new Date().toISOString()} from ${sqlFiles.join(", ")}${seedSql ? ", seed" : ""}`,
  "-- Safe to re-run: migrations are idempotent and the seed does not duplicate rows or reset sold stock."
].join("\n");

const body = sqlFiles
  .map((rel) => `-- ===== ${rel} =====\n${fs.readFileSync(path.join(ROOT, rel), "utf8")}`)
  .join("\n\n");
fs.writeFileSync(outFile, `${header}\n\n${body}${seedSql ? `\n\n${seedSql}` : ""}`);

const size = fs.statSync(outFile).size;
const rel = path.relative(process.cwd(), outFile) || outFile;
console.log(`${rel}: ${Math.round(size / 1024)} KB, ${sqlFiles.length} files${seedSql ? " + seed" : ""}`);

// A stray temporary copy is a common mistake; keep the workspace honest.
fs.rmSync(path.join(os.tmpdir(), "restore-sql-build.tmp"), { force: true });
