/* Every workflow we ship (template + the ones installed into client stores) must be well-formed:
   GitHub silently lists an unparsable workflow by file path and never runs it (template-update.yml, 1.8.0). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers/boot.mjs";

// The template has both folders; a generated store only has .github/workflows (this test is synced into clients too).
const dirs = ["automation/client", ".github/workflows"].filter((d) => fs.existsSync(path.join(ROOT, d)));
for (const dir of dirs) {
  for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => x.endsWith(".yml"))) {
    test(`${dir}/${f} is a well-formed workflow`, () => {
      const text = fs.readFileSync(path.join(ROOT, dir, f), "utf8");
      assert.match(text, /^name: .+/m, "has a name");
      assert.match(text, /^on:/m, "has triggers");
      assert.match(text, /^jobs:/m, "has jobs");
      // a non-empty, non-comment line at column 0 must be a top-level key — anything else is broken quoting
      // (a multi-line "--body" string that spilled to column 0 is exactly how template-update.yml broke)
      for (const [i, line] of text.split("\n").entries()) {
        if (line === "" || line.startsWith("#") || /^\s/.test(line)) continue;
        assert.match(line, /^[A-Za-z_-]+:/, `line ${i + 1} starts at column 0 but is not a key: ${line}`);
      }
    });
  }
}
