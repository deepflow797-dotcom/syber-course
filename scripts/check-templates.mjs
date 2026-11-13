#!/usr/bin/env node
/* Template guard — exits 1 when a storefront template puts a data value into an HTML attribute without escaping.
   This is the class-level fix for audit finding #2 (1.8.2): a single unescaped `src="${…}"` let a merchant-set
   logo URL add an attribute to the element. Here it is impossible to reintroduce silently.

   Rules, per `${expr}` written directly inside `attr="${…}"`:
     - ctx.esc / ctx.escAttr / ctx.urlAttr / ctx.dt / ctx.t / ctx.ICON  → allowed (escaped)
     - encodeURIComponent / Number / String                             → allowed (cannot emit a quote)
     - a bare identifier or a quoted literal                            → allowed (template-controlled, e.g. `data-icon="star"`)
     - anything else                                                    → FAIL, with file:line
   URL attributes (src/href) additionally must use `escAttr`/`urlAttr`/`esc`, because `esc` keeps `javascript:` intact.
*/
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] || process.cwd();
const DIR = path.join(root, "assets/js/ui/storefront");
const ATTR = /\b(src|href|alt|title|aria-label|data-[a-z-]+|value|placeholder|content|poster|action)="\$\{([^}]*)\}/g;
const ESCAPERS = /^ctx\.(esc|escAttr|urlAttr|dt|t|ICON|icon)\(/;
const INERT = /^(encodeURIComponent|Number|String)\(/;
const BAIL = [/^[a-z][a-zA-Z]*$/, /^["']/, /^ctx\.R\.lang\s*===/];

const problems = [];
if (!fs.existsSync(DIR)) {
  console.error(`check-templates: ${path.relative(root, DIR)} not found`);
  process.exit(2);
}
for (const file of fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".js"))
  .sort()) {
  const lines = fs.readFileSync(path.join(DIR, file), "utf8").split("\n");
  lines.forEach((line, index) => {
    ATTR.lastIndex = 0;
    let match;
    while ((match = ATTR.exec(line))) {
      const attr = match[1];
      const expr = match[2].trim();
      if (ESCAPERS.test(expr) || INERT.test(expr) || BAIL.some((re) => re.test(expr))) continue;
      problems.push(`${file}:${index + 1}  ${attr}="${expr}"`);
    }
  });
}
if (problems.length) {
  console.error(`UNESCAPED ATTRIBUTE: ${problems.length} interpolation(s) can break out of an attribute`);
  problems.forEach((p) => console.error(`  ${p}`));
  console.error("Wrap the value in ctx.escAttr(...) or ctx.urlAttr(...) (see assets/js/core/dom.js).");
  process.exit(1);
}
console.log("template ok: every attribute interpolation is escaped");
