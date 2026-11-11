// @ts-check
import { num } from "../core/utils.js";
/** @typedef {import("../../../types/global.d.ts").Product} Product */
/** @typedef {import("../../../types/global.d.ts").ProductVariant} ProductVariant */
/** @typedef {import("../../../types/global.d.ts").Coupon} Coupon */
/** @typedef {import("../../../types/global.d.ts").City} City */
/** @typedef {import("../../../types/global.d.ts").PaymentMethod} PaymentMethod */

/** Unit price in MRU: variant price wins over product price; never negative.
 * @param {Partial<Product> | null | undefined} product @param {Partial<ProductVariant> | null} [variant] @returns {number} */
export function effectiveUnitPrice(product, variant = null) {
  if (variant && variant.price != null) return Math.max(0, Math.round(num(variant.price, 0)));
  return Math.max(0, Math.round(num(product?.price, 0)));
}
/** @param {Partial<Product>} product @param {Partial<ProductVariant> | null} variant @param {number} qty @returns {number} */
export function lineTotal(product, variant, qty) {
  return effectiveUnitPrice(product, variant) * Math.max(1, Math.floor(num(qty, 1)));
}
/** Delivery fee for a city; free at or above `freeOver`.
 * @param {number} subtotal @param {Partial<City> | null | undefined} city @param {number} [freeOver] @returns {number} */
export function shippingFee(subtotal, city, freeOver = 0) {
  if (num(subtotal) >= num(freeOver)) return 0;
  return Math.max(0, Math.round(num(city?.fee, 0)));
}
/** Payment-method discount (e.g. Bankily 10 %), rounded to whole MRU.
 * @param {number} subtotal @param {Partial<PaymentMethod> | null | undefined} payment @returns {number} */
export function paymentDiscount(subtotal, payment) {
  return Math.round((num(subtotal) * Math.max(0, num(payment?.discount, 0))) / 100);
}
/** @param {number} subtotal @param {Partial<Coupon> | null | undefined} coupon @param {number} [now] @returns {{ amount: number, code: string }} */
export function couponDiscount(subtotal, coupon, now = Date.now()) {
  if (!coupon || coupon.active === false) return { amount: 0, code: "" };
  if (coupon.expiresAt && Date.parse(coupon.expiresAt) < now) return { amount: 0, code: "" };
  if (num(subtotal) < num(coupon.minTotal, 0)) return { amount: 0, code: "" };
  const code = String(coupon.code || "").toUpperCase();
  const amount =
    coupon.type === "percent"
      ? Math.round((num(subtotal) * Math.max(0, num(coupon.value, 0))) / 100)
      : Math.max(0, Math.round(num(coupon.value, 0)));
  return { amount, code };
}
/**
 * Single source of truth for checkout totals (the server RPC re-computes the same way).
 * @param {{ subtotal: number, city?: Partial<City> | null, freeOver?: number, payment?: Partial<PaymentMethod> | null, coupon?: Partial<Coupon> | null, now?: number }} input
 * @returns {{ subtotal: number, shipping: number, paymentDiscount: number, couponDiscount: number, coupon: string, discount: number, total: number }}
 */
export function computeTotals({ subtotal, city, freeOver = 0, payment = null, coupon = null, now = Date.now() }) {
  const sub = Math.max(0, Math.round(num(subtotal)));
  const ship = shippingFee(sub, city, freeOver);
  const payDisc = paymentDiscount(sub, payment);
  const coup = couponDiscount(sub, coupon, now);
  const discount = Math.min(sub, payDisc + coup.amount);
  return {
    subtotal: sub,
    shipping: ship,
    paymentDiscount: payDisc,
    couponDiscount: coup.amount,
    coupon: coup.code,
    discount,
    total: Math.max(0, sub + ship - discount)
  };
}
