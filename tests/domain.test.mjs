import test from "node:test";
import assert from "node:assert/strict";
import { computeTotals, shippingFee, couponDiscount } from "../assets/js/domain/pricing.js";

test("shippingFee respects free threshold", () => {
  assert.equal(shippingFee(5000, { fee: 300 }, 4000), 0);
  assert.equal(shippingFee(3000, { fee: 300 }, 4000), 300);
});

test("couponDiscount percent and minTotal", () => {
  assert.deepEqual(couponDiscount(10000, { active: true, type: "percent", value: 10, code: "X" }), {
    amount: 1000,
    code: "X"
  });
  assert.deepEqual(couponDiscount(100, { active: true, type: "fixed", value: 50, code: "Y", minTotal: 500 }), {
    amount: 0,
    code: ""
  });
});

test("computeTotals combines shipping/payment/coupon", () => {
  const t = computeTotals({
    subtotal: 10000,
    city: { fee: 200 },
    freeOver: 20000,
    payment: { discount: 10 },
    coupon: { active: true, type: "fixed", value: 500, code: "C" }
  });
  assert.equal(t.subtotal, 10000);
  assert.equal(t.shipping, 200);
  assert.equal(t.paymentDiscount, 1000);
  assert.equal(t.couponDiscount, 500);
  assert.equal(t.total, 8700);
});
