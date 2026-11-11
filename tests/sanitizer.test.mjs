import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { fileURLToPath } from "node:url";
import { esc, sanitizeRichHTML } from "../assets/js/core/dom.js";
import { safeText, normalizeDigits, clamp, num } from "../assets/js/core/utils.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
test("esc() escapes the five HTML metacharacters and tolerates null", () => {
  assert.equal(esc(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  assert.equal(esc(null), "");
  assert.equal(esc(0), "0");
});
test("sanitizeRichHTML without DOMPurify degrades to full escaping (never raw HTML)", () => {
  delete globalThis.DOMPurify;
  assert.equal(sanitizeRichHTML("<b>x</b><script>1</script>"), esc("<b>x</b><script>1</script>"));
});
test("sanitizeRichHTML with DOMPurify strips scripts, handlers, styles and javascript: URLs but keeps rich text", () => {
  const dom = new JSDOM("", { runScripts: "outside-only" });
  dom.window.eval(fs.readFileSync(ROOT + "assets/vendor/purify.min.js", "utf8"));
  globalThis.DOMPurify = dom.window.DOMPurify;
  const out = sanitizeRichHTML(
    `<p onclick="x()" style="color:red">Hi <b>there</b></p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">l</a><iframe src="//evil"></iframe><a href="https://ok.example" target="_blank">ok</a>`
  );
  assert.ok(!/script|onclick|onerror|style=|iframe|javascript:/i.test(out), out);
  assert.ok(out.includes("<b>there</b>") && out.includes('href="https://ok.example"'), out);
  delete globalThis.DOMPurify;
});
test("safeText trims and truncates, normalizeDigits keeps only digits, clamp/num are total", () => {
  assert.equal(safeText("  héllo  ", 3), "hél");
  assert.equal(safeText(undefined), "");
  assert.equal(normalizeDigits("+222 44 44 48 69"), "22244444869");
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(num("1e3"), 1000);
  assert.equal(num("x", 7), 7);
});
