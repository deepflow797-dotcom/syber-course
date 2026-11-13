#!/usr/bin/env node
/* Cut a template release: bump version, run the full gate, commit, tag. Pushing the tag triggers
   .github/workflows/release.yml → GitHub release → every store in clients.json is updated and redeployed.
   Usage: npm run release -- 1.8.0 [--no-check]   then:  git push && git push --tags */
import fs from "node:fs";
import { execSync } from "node:child_process";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || "")) {
  console.error("usage: npm run release -- <x.y.z>");
  process.exit(2);
}
const sh = (c) => execSync(c, { stdio: "inherit" });
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
pkg.version = version;
lock.version = version;
if (lock.packages?.[""]) lock.packages[""].version = version;
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
fs.writeFileSync("package-lock.json", JSON.stringify(lock, null, 2) + "\n");
if (!fs.readFileSync("CHANGELOG.md", "utf8").includes(`## ${version}`)) {
  console.error(`CHANGELOG.md has no "## ${version}" section — write it first`);
  process.exit(1);
}
if (!process.argv.includes("--no-check")) sh("npm run check:full");
sh("git add -A");
sh(`git commit -m "release ${version}"`);
sh(`git tag -a v${version} -m "v${version}"`);
console.log(
  `\n✔ v${version} tagged. Now:  git push && git push --tags   → release.yml updates every client in clients.json`
);
