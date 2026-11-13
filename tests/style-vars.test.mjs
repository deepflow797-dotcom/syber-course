/* CSP: data-driven styling. The browser ignores `style` attributes and `<style>` blocks under
   `style-src 'self'`, so dynamic values travel through `data-sv` and reach CSS custom properties via CSSOM.
   These tests pin the channel→property mapping and the parsing rules the templates depend on. */
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { decodePng } from "../scripts/png-optimize.mjs";
import { applyStyleVars, setChannel } from "../assets/js/ui/style-vars.js";

function dom(body) {
  const { window } = new JSDOM(`<!doctype html><body>${body}</body>`);
  return window;
}

test("applyStyleVars writes the channel's custom property from data-sv", () => {
  const w = dom('<div id="a" data-sv="bg:#ff6400;w:42"></div>');
  const el = w.document.getElementById("a");
  const n = applyStyleVars(w.document);
  assert.equal(n, 2);
  assert.equal(el.style.getPropertyValue("--sv-bg"), "#ff6400");
  assert.equal(el.style.getPropertyValue("--sv-w"), "42");
});

test("status/pay/bar/accent keep the property names the stylesheets already read", () => {
  const w = dom('<span id="s" data-sv="status:#25a55f;pay:#7c3aed;bar:#e67e22;accent:#2563eb"></span>');
  const el = w.document.getElementById("s");
  applyStyleVars(w.document);
  assert.equal(el.style.getPropertyValue("--status"), "#25a55f");
  assert.equal(el.style.getPropertyValue("--pay"), "#7c3aed");
  assert.equal(el.style.getPropertyValue("--bar"), "#e67e22");
  assert.equal(el.style.getPropertyValue("--accent"), "#2563eb");
});

test("unknown channels and empty values are ignored, a broken pair never throws", () => {
  const w = dom('<div id="a" data-sv="evil:1;bg:;nocolon;h:12"></div>');
  const el = w.document.getElementById("a");
  assert.equal(applyStyleVars(w.document), 1);
  assert.equal(el.style.getPropertyValue("--h"), "");
  assert.equal(el.style.getPropertyValue("--sv-h"), "12");
  assert.equal(el.style.getPropertyValue("--evil"), "");
});

test("a gradient with commas and parentheses survives the split", () => {
  const w = dom('<div id="a" data-sv="bg:linear-gradient(135deg,#1f1f2e,#39255b)"></div>');
  const el = w.document.getElementById("a");
  applyStyleVars(w.document);
  assert.equal(el.style.getPropertyValue("--sv-bg"), "linear-gradient(135deg,#1f1f2e,#39255b)");
});

test("setChannel styles one element (charts redrawn after the markup pass)", () => {
  const w = dom('<div id="a"></div>');
  const el = w.document.getElementById("a");
  setChannel(el, "h", 37);
  assert.equal(el.style.getPropertyValue("--sv-h"), "37");
  setChannel(el, "nope", 1);
  setChannel(null, "h", 1);
  assert.equal(el.style.getPropertyValue("--nope"), "");
});

test("applyStyleVars is a no-op on null / plain objects", () => {
  assert.equal(applyStyleVars(null), 0);
  assert.equal(applyStyleVars(undefined), 0);
  assert.equal(applyStyleVars({}), 0);
});

test("no template ships a style attribute or a <style> block (CSP guard)", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const root = fileURLToPath(new URL("..", import.meta.url));
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", "reports", "tests", "e2e", "scripts", "docs"].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(html|js)$/.test(e.name)) {
        // comments legitimately mention <style> and style="…"; only code counts
        const src = fs
          .readFileSync(p, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, " ")
          .replace(/^\s*\/\/.*$/gm, " ");
        if (/\sstyle="/.test(src) || /<style[\s>]/.test(src)) offenders.push(path.relative(root, p));
      }
    }
  };
  walk(root);
  assert.deepEqual(offenders, []);
});

test("PWA icons stay 8-bit and lossless (they are re-encoded from 16-bit by scripts/png-optimize.mjs)", async () => {
  const fs = await import("node:fs");
  const root = fileURLToPath(new URL("..", import.meta.url));
  for (const name of ["pwa-192.png", "pwa-512.png", "apple-touch-icon.png"]) {
    const file = `${root}assets/img/${name}`;
    const buf = fs.readFileSync(file);
    assert.equal(buf[24], 8, `${name} must be an 8-bit PNG`);
    const image = decodePng(file);
    assert.ok(image.width >= 180 && image.height >= 180, `${name} keeps its size`);
    assert.equal(image.rgba.length, image.width * image.height * 4);
  }
});
