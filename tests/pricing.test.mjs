import test from "node:test";
import assert from "node:assert/strict";
import {
  effectiveUnitPrice,
  lineTotal,
  shippingFee,
  paymentDiscount,
  couponDiscount,
  computeTotals
} from "../assets/js/domain/pricing.js";
import { roundMRU } from "../assets/js/core/utils.js";

test("effectiveUnitPrice prefers the variant price and never goes negative", () => {
  assert.equal(effectiveUnitPrice({ price: 1000 }), 1000);
  assert.equal(effectiveUnitPrice({ price: 1000 }, { price: 1200 }), 1200);
  assert.equal(effectiveUnitPrice({ price: 1000 }, { price: null }), 1000);
  assert.equal(effectiveUnitPrice({ price: -5 }), 0);
  assert.equal(effectiveUnitPrice({ price: "abc" }), 0);
});
test("lineTotal floors qty at 1 and ignores fractional quantities", () => {
  assert.equal(lineTotal({ price: 500 }, null, 3), 1500);
  assert.equal(lineTotal({ price: 500 }, null, 0), 500);
  assert.equal(lineTotal({ price: 500 }, null, 2.9), 1000);
  assert.equal(lineTotal({ price: 500 }, { price: 700 }, 2), 1400);
});
test("shippingFee: free exactly at the threshold, city fee below it, zero when no city", () => {
  assert.equal(shippingFee(20000, { fee: 500 }, 20000), 0);
  assert.equal(shippingFee(19999, { fee: 500 }, 20000), 500);
  assert.equal(shippingFee(100, null, 20000), 0);
  assert.equal(shippingFee(100, { fee: -50 }, 20000), 0);
});
test("Bankily 10% payment discount is rounded and capped at 0 for bad input", () => {
  assert.equal(paymentDiscount(41340, { id: "bankily", discount: 10 }), 4134);
  assert.equal(paymentDiscount(1005, { discount: 10 }), 101);
  assert.equal(paymentDiscount(1000, { discount: -10 }), 0);
  assert.equal(paymentDiscount(1000, null), 0);
});
test("couponDiscount: inactive, expired, below minTotal → 0; code is upper-cased", () => {
  const now = Date.parse("2026-01-01T00:00:00Z");
  assert.deepEqual(couponDiscount(10000, { code: "welcome10", type: "percent", value: 10 }, now), {
    amount: 1000,
    code: "WELCOME10"
  });
  assert.equal(couponDiscount(10000, { code: "X", type: "percent", value: 10, active: false }, now).amount, 0);
  assert.equal(
    couponDiscount(10000, { code: "X", type: "percent", value: 10, expiresAt: "2025-12-31" }, now).amount,
    0
  );
  assert.equal(
    couponDiscount(10000, { code: "X", type: "percent", value: 10, expiresAt: "2026-12-31" }, now).amount,
    1000
  );
  assert.equal(couponDiscount(9999, { code: "X", type: "fixed", value: 500, minTotal: 10000 }, now).amount, 0);
  assert.equal(couponDiscount(10000, { code: "X", type: "fixed", value: 500, minTotal: 10000 }, now).amount, 500);
});
test("computeTotals never produces a negative total and caps discounts at the subtotal", () => {
  const t = computeTotals({
    subtotal: 1000,
    city: { fee: 0 },
    payment: { discount: 10 },
    coupon: { code: "BIG", type: "fixed", value: 5000 }
  });
  assert.equal(t.discount, 1000);
  assert.equal(t.total, 0);
  const u = computeTotals({ subtotal: -50, city: { fee: 300 }, freeOver: 20000 });
  assert.equal(u.subtotal, 0);
  assert.equal(u.total, 300);
});
test("computeTotals: Bankily + coupon stack additively on the subtotal, shipping is not discounted", () => {
  const t = computeTotals({
    subtotal: 10000,
    city: { fee: 500 },
    freeOver: 20000,
    payment: { discount: 10 },
    coupon: { code: "W", type: "percent", value: 10 }
  });
  assert.equal(t.paymentDiscount, 1000);
  assert.equal(t.couponDiscount, 1000);
  assert.equal(t.total, 10000 + 500 - 2000);
});
test("roundMRU converts at the configured rate and rounds to the nearest 5", () => {
  assert.equal(roundMRU(100), 1060);
  assert.equal(roundMRU(1, 10.6), 10);
  assert.equal(roundMRU(0), 0);
  assert.equal(roundMRU(-3), 0);
  assert.equal(roundMRU(12900) % 5, 0);
});
