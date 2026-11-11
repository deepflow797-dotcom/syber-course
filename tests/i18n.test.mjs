import test from "node:test";
import assert from "node:assert/strict";
import { I18N, t, L } from "../assets/js/i18n/index.js";

test("ar and fr dictionaries have exactly the same keys (parity)", () => {
  const ar = Object.keys(I18N.ar).sort(),
    fr = Object.keys(I18N.fr).sort();
  const missingFr = ar.filter((k) => !fr.includes(k)),
    missingAr = fr.filter((k) => !ar.includes(k));
  assert.deepEqual({ missingFr, missingAr }, { missingFr: [], missingAr: [] });
  assert.ok(ar.length > 100, `only ${ar.length} keys`);
});
test("no empty translations and placeholders match between languages", () => {
  const ph = (s) => (String(s).match(/\{[a-zA-Z_]+\}/g) || []).sort().join(",");
  for (const k of Object.keys(I18N.ar)) {
    assert.ok(String(I18N.ar[k]).trim() && String(I18N.fr[k]).trim(), `empty: ${k}`);
    assert.equal(ph(I18N.ar[k]), ph(I18N.fr[k]), `placeholder mismatch: ${k}`);
  }
});
test("t() interpolates vars, falls back to ar then to the key", () => {
  assert.equal(t("fr", "home"), I18N.fr.home);
  assert.equal(t("xx", "home"), I18N.ar.home);
  assert.equal(t("ar", "definitely.missing.key"), "definitely.missing.key");
  I18N.fr.__tmp = "Bonjour {name} ({n})";
  assert.equal(t("fr", "__tmp", { name: "Ali", n: 2 }), "Bonjour Ali (2)");
  delete I18N.fr.__tmp;
});
test("L() resolves bilingual objects with a sane fallback", () => {
  assert.equal(L("fr", { ar: "أ", fr: "F" }), "F");
  assert.equal(L("fr", { ar: "أ" }), "أ");
  assert.equal(L("ar", "plain"), "plain");
  assert.equal(L("ar", 5), "5");
  assert.equal(L("ar", null), "");
});
