/* Boots the real storefront state (jsdom, local demo, no network) once and tests the service layer
   through the public RESTORE API — staff login lock-out, stock decrement, local orders, search, phone formatting. */
import test from "node:test";
import assert from "node:assert/strict";
import { bootStorefront, ROOT } from "./helpers/boot.mjs";

const { R, window: w } = await bootStorefront(ROOT);

test("boot: demo catalog hydrated with 21 active products and bilingual titles", () => {
  assert.equal(R.state.products.length, 21);
  assert.ok(R.state.products.every((p) => p.active && p.price > 0 && p.price % 5 === 0));
  assert.ok(R.state.collections.length >= 10);
});
test("staff-auth: wrong password is rejected, 5 failures lock the account for minutes", async () => {
  w.localStorage.clear();
  for (let i = 0; i < 5; i++) await assert.rejects(R.login("owner", "wrong-" + i), /كلمة المرور|Utilisateur|غير/);
  await assert.rejects(R.login("owner", "Owner#12345"), /إيقاف المحاولات|Trop de tentatives/);
});
test("staff-auth: correct demo credentials create a session; logout clears it", async () => {
  w.localStorage.clear();
  const s = await R.login("owner", "Owner#12345");
  assert.ok(s && (s.role === "owner" || s.username === "owner"), JSON.stringify(s));
  assert.ok(R.currentSession());
  R.logout();
  assert.equal(R.currentSession(), null);
});
test("staff-auth: empty identifier or password is refused before any lookup", async () => {
  await assert.rejects(R.login("", "x"), /أدخل/);
  await assert.rejects(R.login("owner", ""), /أدخل/);
});
test("stock: decrementStock reduces stock per item, never below 0, and flags low stock", () => {
  const p = R.state.products[0];
  const before = p.stock;
  R.decrementStock([
    { handle: p.handle, qty: 1 },
    { handle: "no-such-handle", qty: 3 }
  ]);
  assert.equal(R.state.products.find((x) => x.handle === p.handle).stock, Math.max(0, before - 1));
  R.decrementStock([{ handle: p.handle, qty: 9999 }]);
  const after = R.state.products.find((x) => x.handle === p.handle);
  assert.equal(after.stock, 0);
  assert.equal(after.lowStock, true);
});
test("orders: local demo submitOrder stores the order, newest first, marked not server-validated", async () => {
  const id = R.orderId();
  assert.match(id, /^RS-\d{6}-[A-Z0-9]{4}$/);
  const o = await R.submitOrder({
    id,
    items: [{ handle: R.state.products[1].handle, qty: 1 }],
    total: 100,
    status: "new",
    createdAt: new Date().toISOString()
  });
  assert.equal(o.serverValidated, false);
  assert.equal(R.getOrders()[0].id, id);
  R.updateOrder(id, { status: "confirmed" });
  assert.equal(R.getOrders().find((x) => x.id === id).status, "confirmed");
  await assert.rejects(R.submitOrder(null), /غير صالح/);
});
test("orders: statusMeta knows every status and falls back to 'new'", () => {
  for (const s of R.statuses) assert.ok(R.statusMeta(s).label && R.statusMeta(s).color, s);
  assert.equal(R.statusMeta("bogus").color, R.statusMeta("new").color);
});
test("search: Arabic normalisation (hamza/ta-marbuta/diacritics) and stop words", () => {
  assert.equal(R.normalizeText("إلكترونيّة"), "الكترونيه");
  assert.deepEqual(R.queryTokens("the iPhone series"), ["iphone"]);
  const p = R.state.products.find((x) => /smartphone/i.test(x.handle)) || R.state.products[0];
  assert.ok(R.matchesQuery(p, p.handle.split("-")[0]));
  assert.ok(!R.matchesQuery(p, "zzzznotfound"));
  assert.ok(R.matchesQuery(p, ""));
});
test("effectivePrice picks the cheapest available variant", () => {
  const p = {
    price: 1000,
    variants: [
      { price: 900, available: true },
      { price: 100, available: false }
    ]
  };
  assert.equal(R.effectivePrice(p), 900);
  assert.equal(R.effectivePrice({ price: 1000, variants: [] }), 1000);
});
test("formatPhone renders Mauritanian numbers with/without country code", () => {
  assert.equal(R.formatPhone("22244444869"), "+222 44 44 48 69");
  assert.equal(R.formatPhone("44444869"), "+222 44 44 48 69");
  assert.equal(R.formatPhone("12345"), "12345");
});
test("currency: new/old ouguiya mode changes the display by ×10", () => {
  R.setCurrencyMode("new");
  const n = R.formatCurrency(1000);
  R.setCurrencyMode("old");
  const o = R.formatCurrency(1000);
  assert.ok(/1[ ,.\u202f]?000/.test(n), n);
  assert.ok(/10[ ,.\u202f]?000/.test(o), o);
  R.setCurrencyMode("bogus");
  assert.equal(R.getCurrencyMode(), "old");
  R.setCurrencyMode("new");
});
test("safeHref blocks javascript:/data: URLs and keeps http(s), mailto, tel, anchors", () => {
  assert.equal(R.safeHref("javascript:alert(1)"), "#");
  assert.equal(R.safeHref("data:text/html,x"), "#");
  assert.equal(R.safeHref("https://a.b/c"), "https://a.b/c");
  assert.equal(R.safeHref("tel:+22244444869"), "tel:+22244444869");
  assert.equal(R.safeHref("#top"), "#top");
});
test("isStoreOpen honours closed/maintenance flags", () => {
  const saved = JSON.parse(JSON.stringify(R.state.settings.hours || {}));
  R.state.settings.hours = { open: "00:00", close: "23:59", days: [0, 1, 2, 3, 4, 5, 6] };
  assert.equal(R.isStoreOpen(), true);
  R.state.settings.hours = { ...R.state.settings.hours, maintenance: true };
  assert.equal(R.isStoreOpen(), false);
  R.state.settings.hours = saved;
});
