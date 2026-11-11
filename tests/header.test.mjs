import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* Regression test for the stray </div> that broke .header-actions (storetemplatenum3 → 1.1.0).
   We check the template literal of renderHeader() in ui/storefront/04-header-footer.js without a browser. */
const src = readFileSync(new URL("../assets/js/ui/storefront/04-header-footer.js", import.meta.url), "utf8");
const start = src.indexOf("function renderHeader()");
const tpl = src.slice(
  src.indexOf("el.innerHTML = `", start) + 16,
  src.indexOf("`;", src.indexOf("el.innerHTML = `", start))
);

test("renderHeader: .header-actions keeps its 6 children (no stray </div>)", () => {
  const open = tpl.indexOf('<div class="header-actions">');
  assert.ok(open > -1);
  // walk divs to find the matching close of header-actions
  let depth = 0,
    close = -1;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = open;
  let m;
  while ((m = re.exec(tpl))) {
    depth += m[0] === "</div>" ? -1 : 1;
    if (depth === 0) {
      close = m.index;
      break;
    }
  }
  assert.ok(close > -1, "header-actions never closes");
  const inner = tpl.slice(open, close);
  for (const marker of [
    'id="customer-account"',
    'class="lang-switch"',
    "theme-btn",
    'href="account.html"',
    'href="wishlist.html"',
    "data-open-cart"
  ]) {
    assert.ok(inner.includes(marker), `${marker} must be inside .header-actions`);
  }
  assert.ok(!inner.includes("<nav"), "nav must not be inside header-actions");
});

test("renderHeader: balanced <div> tags in the whole template", () => {
  const opens = (tpl.match(/<div\b/g) || []).length;
  const closes = (tpl.match(/<\/div>/g) || []).length;
  assert.equal(opens, closes, `unbalanced divs: ${opens} open vs ${closes} close`);
});
