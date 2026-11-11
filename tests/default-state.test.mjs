/* Unit tests for the P1 lookup tables and dispatchers extracted from the dashboard shell, the settings
   actions and the default state. They run without a browser: every helper below is a pure function. */
import test from "node:test";
import assert from "node:assert/strict";
import { managerName, normalizeWhatsapp, staffRowToManager } from "../assets/js/services/04a-staff-rows.js";
import { createDefaultTexts } from "../assets/js/services/01-default-texts.js";
import { createDefaultState } from "../assets/js/services/01a-default-state.js";

/* The builders read `window.BRAND` (client brand config); the tests run without a DOM. */
globalThis.window = globalThis.window || { BRAND: {} };

/* Minimal ctx: identity helpers only, exactly what the pure modules touch. */
const ctx = {
  normalizeDigits: (value) => String(value || "").replace(/\D/g, ""),
  txt: (ar, fr) => ({ ar, fr }),
  L: (value) => value?.ar || value?.fr || String(value || ""),
  nowISO: () => "2026-01-01T00:00:00.000Z",
  roundMRU: (value) => Math.round(Number(value) || 0),
  RAW: {
    products: [],
    collections: [],
    home: { anniversary: [], iphones: [], samsung: [], laptops: [] }
  }
};

test("staffRowToManager: maps the staff row columns and the approval default", () => {
  const manager = staffRowToManager(ctx, {
    id: "m1",
    auth_id: "auth-1",
    email: "owner@example.com",
    role: "owner",
    whatsapp: "22212345678",
    active: true,
    must_change_password: true,
    created_at: "2026-01-01"
  });
  assert.equal(manager.id, "m1");
  assert.equal(manager.authId, "auth-1");
  assert.equal(manager.role, "owner");
  assert.equal(manager.mustChange, true);
  assert.equal(manager.email, "owner@example.com");
  assert.deepEqual(manager.name, { ar: "owner@example.com", fr: "owner@example.com" });
});

test("staffRowToManager: unknown roles fall back to manager and missing rows to null", () => {
  assert.equal(staffRowToManager(ctx, null), null);
  const manager = staffRowToManager(ctx, { id: "m2", email: "x@y.z", role: "admin" });
  assert.equal(manager.role, "manager");
  assert.equal(manager.active, true);
  assert.equal(manager.mustChange, false);
});

test("normalizeWhatsapp: accepts Mauritanian lengths only", () => {
  assert.equal(normalizeWhatsapp(ctx, "+222 12 34 56 78"), "22212345678");
  assert.equal(normalizeWhatsapp(ctx, "12345678"), "12345678");
  assert.equal(normalizeWhatsapp(ctx, ""), "");
  assert.throws(() => normalizeWhatsapp(ctx, "12345"), /رقم واتساب غير صالح/);
});

test("managerName: prefers the explicit names, falls back to the identifier", () => {
  assert.deepEqual(managerName({ nameAr: "أحمد", nameFr: "Ahmed" }), { ar: "أحمد", fr: "Ahmed" });
  const fallback = managerName({ nameAr: "", email: "staff@example.com" });
  assert.deepEqual(fallback, { ar: "staff@example.com", fr: "staff@example.com" });
});

test("createDefaultTexts: exposes every default text block with both languages", () => {
  const texts = createDefaultTexts(ctx);
  const keys = [
    "TYPE_DESCRIPTIONS",
    "DEFAULT_FAQS",
    "DEFAULT_HOME_REVIEWS",
    "DEFAULT_NAV",
    "COLLECTION_TITLES",
    "DEFAULT_CATEGORIES",
    "DEFAULT_PAYMENTS",
    "DEFAULT_CITIES",
    "DEFAULT_ORDER_TEMPLATE",
    "DEFAULT_WHATSAPP_TEMPLATES"
  ];
  assert.deepEqual(Object.keys(texts).sort(), [...keys].sort());
  assert.ok(texts.DEFAULT_FAQS.length > 0);
  assert.ok(texts.DEFAULT_CITIES.every((city) => city.name?.ar && city.name?.fr));
  assert.match(texts.DEFAULT_ORDER_TEMPLATE.ar, /\{order_id\}/);
});

test("createDefaultState: builds the settings tree and keeps collection handles stable", () => {
  const state = createDefaultState(ctx).buildState();
  assert.equal(state.version, 1);
  assert.ok(state.settings.storeName.ar);
  assert.ok(state.settings.storeName.fr);
  assert.equal(state.settings.colors.primary, "#2563eb");
  assert.equal(state.settings.country.code, "MR");
  assert.deepEqual(
    state.settings.pageSections.map((section) => section.id),
    ["hero", "trust", "renewed", "categories", "offer", "products", "sustain", "service", "video", "reviews", "press"]
  );
  assert.ok(Array.isArray(state.collections));
  assert.deepEqual(state.home, { anniversary: [], iphones: [], samsung: [], laptops: [] });
  assert.equal(state.settings.homeSections.length, 4);
});
