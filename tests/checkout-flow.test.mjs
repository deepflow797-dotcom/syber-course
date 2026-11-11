/* Unit tests for the checkout business rules (ui/storefront/12b-checkout-flow.js) — pure functions, no DOM. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  abandonedLead,
  buildOrderDraft,
  buildOrderMessage,
  fillTemplate,
  findCoupon,
  firstMissingField,
  isBlockedPhone,
  isRateLimited,
  isValidPhone,
  messageItemsHTML,
  normalizePhone,
  onlyDigits,
  validateCheckout,
  whatsappLink,
  whatsappNumber
} from "../assets/js/ui/storefront/12b-checkout-flow.js";

const FORM = { name: "  Aicha ", phone: "46 00 00 00", email: " a@b.mr ", address: " Tevragh Zeina ", notes: "" };
const OK = { open: true, blocklist: [], rateLimitSeconds: 0, lastOrderAt: 0, now: 1_000_000 };

test("onlyDigits / normalizePhone: strips formatting and the +222 country code", () => {
  assert.equal(onlyDigits("+222 46-00_00.00"), "22246000000");
  assert.equal(normalizePhone("46 00 00 00"), "46000000");
  assert.equal(normalizePhone("+22246000000"), "46000000");
  assert.equal(normalizePhone("2224600"), "2224600", "short numbers keep their digits unchanged");
  assert.equal(normalizePhone(""), "");
});

test("validateCheckout: closed store is refused before any field check", () => {
  assert.deepEqual(validateCheckout({ ...OK, open: false, form: FORM }), { ok: false, code: "storeClosed" });
});

test("validateCheckout: missing name, phone and address are reported in order with the field to focus", () => {
  assert.equal(firstMissingField({ name: "", phone: "46000000", address: "x" }), "co-name");
  assert.equal(firstMissingField({ name: "x", phone: "", address: "x" }), "co-phone");
  assert.equal(firstMissingField({ name: "x", phone: "46000000", address: "  " }), "co-address");
  assert.equal(firstMissingField(FORM), "");
  const verdict = validateCheckout({ ...OK, form: { ...FORM, address: "" } });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, "required");
  assert.equal(verdict.focus, "co-address");
});

test("validateCheckout: a phone that is not 8 digits is rejected and refocused on the phone field", () => {
  assert.equal(isValidPhone("4600000"), false);
  assert.equal(isValidPhone("46000000"), true);
  const verdict = validateCheckout({ ...OK, form: { ...FORM, phone: "12345" } });
  assert.equal(verdict.code, "invalidPhone");
  assert.equal(verdict.focus, "co-phone");
});

test("validateCheckout: blocklisted numbers are refused with and without the country prefix", () => {
  assert.equal(isBlockedPhone("46000000", ["46000000"]), true);
  assert.equal(isBlockedPhone("46000000", ["+222 46 00 00 00"]), true);
  assert.equal(isBlockedPhone("46000001", ["46000000"]), false);
  assert.equal(isBlockedPhone("46000000", []), false);
  assert.equal(validateCheckout({ ...OK, form: FORM, blocklist: ["22246000000"] }).code, "blockedPhone");
});

test("validateCheckout: rate limit blocks too-fast repeats and allows the order after the window", () => {
  assert.equal(isRateLimited("46000000", 0, 0, OK.now), false, "no limit configured");
  assert.equal(isRateLimited("46000000", OK.now - 1000, 60, OK.now), true);
  assert.equal(isRateLimited("46000000", OK.now - 61_000, 60, OK.now), false);
  const fast = validateCheckout({ ...OK, form: FORM, rateLimitSeconds: 60, lastOrderAt: OK.now - 1000 });
  assert.equal(fast.code, "rateLimited");
  const later = validateCheckout({ ...OK, form: FORM, rateLimitSeconds: 60, lastOrderAt: OK.now - 61_000 });
  assert.equal(later.ok, true);
  assert.equal(later.phone, "46000000");
});

test("validateCheckout: a complete form passes and returns the normalised phone", () => {
  const verdict = validateCheckout({ ...OK, form: FORM });
  assert.deepEqual(verdict, { ok: true, phone: "46000000" });
});

/** Context stub with just the helpers the draft/message builders read. */
function ctxStub() {
  return {
    R: { lang: "fr", orderId: () => "RS-260101-ABCD" },
    SET: {
      storeName: { ar: "متجري", fr: "Ma boutique" },
      whatsapp: "46000000",
      orderTemplate: { fr: "Bonjour {store}\n#{order_id} {name} {phone}\n{items}\nTotal {total}\nNotes: {notes}" }
    },
    L: (value) => (value && typeof value === "object" ? value.fr || value.ar : String(value ?? "")),
    t: (key) => (key === "free" ? "Gratuit" : key),
    money: (value) => `${value} MRU`,
    variantLabel: (variant) => variant?.title || "",
    specsText: (specs) =>
      Object.entries(specs || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(", "),
    conditionLabel: (condition) => condition || "refurbished"
  };
}

const ITEMS = [
  {
    handle: "phone-x",
    qty: 2,
    line: 2400,
    specs: { color: "noir" },
    product: { title: "Phone X", image: "x.webp", price: 1200, battery: "ok" },
    variant: { id: "v1", title: "128 Go", price: 1200 }
  }
];
const CALC = {
  city: { id: "nouakchott", name: { fr: "Nouakchott" } },
  shipping: 100,
  paymentDiscount: 0,
  couponDiscount: 0,
  discount: 0,
  total: 2500
};

test("buildOrderDraft: maps the form, cart and totals into the order shape the services expect", () => {
  const ctx = ctxStub();
  const draft = buildOrderDraft(ctx, {
    form: FORM,
    phone: "46000000",
    calc: CALC,
    items: ITEMS,
    subtotal: 2400,
    payment: { id: "bankily", name: { fr: "Bankily" }, discount: 10 },
    coupon: { code: "RESTORE10" }
  });
  assert.equal(draft.customer.name, "Aicha", "trimmed");
  assert.equal(draft.customer.phone, "+22246000000");
  assert.equal(draft.customer.city, "Nouakchott");
  assert.equal(draft.customer.notes, "");
  assert.equal(draft.items[0].variantTitle, "128 Go");
  assert.equal(draft.items[0].price, 1200);
  assert.equal(draft.items[0].line, 2400);
  assert.equal(draft.coupon, "RESTORE10");
  assert.equal(draft.payment.name, "Bankily");
  assert.equal(draft.total, 2500);
  assert.equal(draft.currency, "MRU");
  assert.equal(draft.storePhone, "46000000");
  assert.equal(draft.status, "new");
  assert.equal(draft.source, "whatsapp");
});

test("messageItemsHTML / fillTemplate: one line per item and every placeholder replaced", () => {
  const ctx = ctxStub();
  const lines = messageItemsHTML(ctx, [
    { title: "Phone X", variantTitle: "128 Go", specsText: "color: noir", qty: 2, line: 2400 }
  ]);
  assert.equal(lines, "- Phone X (128 Go)\n   color: noir × 2 = 2400 MRU");
  assert.equal(fillTemplate("a {x} b {y} c", { x: 1, y: 2 }), "a 1 b 2 c");
  assert.equal(fillTemplate("{missing} stays", {}), "{missing} stays");
  assert.equal(fillTemplate("null -> {x}", { x: null }), "null -> ");
});

test("buildOrderMessage: renders the store template with order values", () => {
  const ctx = ctxStub();
  const draft = buildOrderDraft(ctx, {
    form: FORM,
    phone: "46000000",
    calc: CALC,
    items: ITEMS,
    subtotal: 2400,
    payment: { id: "bankily", name: { fr: "Bankily" } },
    coupon: null
  });
  const order = { ...draft, id: "RS-1", total: 2500, subtotal: 2400, discount: 0 };
  const { message, payName } = buildOrderMessage(ctx, order, draft, FORM);
  assert.equal(payName, "Bankily");
  assert.match(message, /Bonjour Ma boutique/);
  assert.match(message, /#RS-1 Aicha \+22246000000/);
  assert.match(message, /× 2 = 2400 MRU/);
  assert.match(message, /Total 2500 MRU/);
  assert.doesNotMatch(message, /\{[a-z_]+\}/, "no placeholder may survive");
});

test("whatsappNumber / whatsappLink: 8-digit numbers get the 222 prefix and the text is encoded", () => {
  assert.equal(whatsappNumber("46 00 00 00"), "22246000000");
  assert.equal(whatsappNumber("+22246000000"), "22246000000");
  assert.equal(whatsappNumber(""), "");
  assert.equal(whatsappLink("46000000", "a b & c"), "https://wa.me/22246000000?text=a%20b%20%26%20c");
});

test("findCoupon: case-insensitive, ignores inactive coupons and empty input", () => {
  const coupons = [
    { code: "restore10", active: true },
    { code: "OLD20", active: false }
  ];
  assert.equal(findCoupon(coupons, " restore10 ").code, "restore10");
  assert.equal(findCoupon(coupons, "RESTORE10").code, "restore10");
  assert.equal(findCoupon(coupons, "OLD20"), null, "inactive coupons never apply");
  assert.equal(findCoupon(coupons, ""), null);
  assert.equal(findCoupon(null, "X"), null);
});

test("abandonedLead: keeps only the fields the abandoned-checkout feature stores", () => {
  const ctx = ctxStub();
  const lead = abandonedLead(ctx, {
    form: FORM,
    city: { id: "nktt", name: { fr: "Nouakchott" } },
    items: ITEMS,
    subtotal: 2400
  });
  assert.equal(lead.phone, "46000000", "digits only, no +222");
  assert.equal(lead.cityId, "nktt");
  assert.equal(lead.lang, "fr");
  assert.equal(lead.items[0].variant, "128 Go");
  assert.equal(lead.subtotal, 2400);
});
