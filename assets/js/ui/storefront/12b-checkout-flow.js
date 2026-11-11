// @ts-check
/* app.js → Checkout business rules (pure functions, no DOM)
   Extracted verbatim from the place-order handler and the coupon/lead code of 12-checkout.js so the rules can be
   unit-tested without a browser. Nothing here touches `document`, `window` or storage: the caller passes values in
   and persists the results through the existing service paths. */

/** Digits-only helper, identical to the one used by the checkout form. */
export function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

/** Normalises a typed phone number to the 8 local digits (+222 country code stripped). */
export function normalizePhone(raw) {
  const digits = onlyDigits(raw);
  if (digits.startsWith("222") && digits.length > 8) return digits.slice(3);
  return digits;
}

/** `{ name, phone, address }` of the first empty required field, or "" when the form is complete. */
export function firstMissingField(form) {
  const name = String(form.name || "").trim();
  const address = String(form.address || "").trim();
  const phone = normalizePhone(form.phone);
  if (!name) return "co-name";
  if (!phone) return "co-phone";
  if (!address) return "co-address";
  return "";
}

/** True when the normalised phone is 8 digits long. */
export function isValidPhone(phone) {
  return normalizePhone(phone).length === 8;
}

/** True when the number is in the store blocklist (compared as digits, with or without the +222 prefix). */
export function isBlockedPhone(phone, blocklist) {
  const digits = normalizePhone(phone);
  const blocked = (blocklist || []).map(onlyDigits).filter(Boolean);
  return blocked.includes(digits) || blocked.includes(`222${digits}`);
}

/** True when the same phone ordered again before `rateLimitSeconds` elapsed. */
export function isRateLimited(phone, lastOrderAt, rateLimitSeconds, now = Date.now()) {
  const limit = Math.max(0, Number(rateLimitSeconds || 0)) * 1000;
  if (!limit) return false;
  return now - Number(lastOrderAt || 0) < limit;
}

/**
 * Validates the typed checkout form against the store rules, in the same order as the original handler.
 * @returns {{ ok: boolean, code?: string, focus?: string, phone?: string }}
 */
/**
 * Validates the checkout form before an order is created.
 * @param {{ form: any, open: any, blocklist?: any, rateLimitSeconds?: any, lastOrderAt?: any, now?: any }} input
 */
export function validateCheckout({ form, open, blocklist, rateLimitSeconds, lastOrderAt, now }) {
  if (!open) return { ok: false, code: "storeClosed" };
  const missing = firstMissingField(form);
  if (missing) return { ok: false, code: "required", focus: missing };
  const phone = normalizePhone(form.phone);
  if (phone.length !== 8) return { ok: false, code: "invalidPhone", focus: "co-phone" };
  if (isBlockedPhone(phone, blocklist)) return { ok: false, code: "blockedPhone" };
  if (isRateLimited(phone, lastOrderAt, rateLimitSeconds, now)) return { ok: false, code: "rateLimited" };
  return { ok: true, phone };
}

/**
 * Builds the order draft exactly as the former inline handler did.
 * @param {any} ctx Shared storefront context.
 * @param {any} input Validated form values, totals and cart snapshot.
 */
export function buildOrderDraft(ctx, input) {
  const { form, phone, calc, items, subtotal, payment, coupon } = input;
  return {
    id: ctx.R.orderId(),
    createdAt: new Date().toISOString(),
    status: "new",
    source: "whatsapp",
    lang: ctx.R.lang,
    customer: {
      name: String(form.name).trim(),
      phone: `+222${phone}`,
      email: String(form.email || "").trim(),
      city: ctx.L(calc.city?.name),
      cityId: calc.city?.id,
      address: String(form.address).trim(),
      notes: String(form.notes || "").trim()
    },
    items: items.map((it) => ({
      handle: it.handle,
      title: it.product.title,
      image: it.product.image,
      variantId: it.variant?.id,
      variantTitle: ctx.variantLabel(it.variant),
      specs: it.specs || {},
      specsText: ctx.specsText(it.specs),
      battery: it.product.battery || null,
      condition: ctx.conditionLabel(it.product.condition),
      qty: it.qty,
      price: Number(it.variant?.price ?? it.product.price),
      line: it.line
    })),
    subtotal,
    shipping: calc.shipping,
    paymentDiscount: calc.paymentDiscount,
    couponDiscount: calc.couponDiscount,
    coupon: coupon?.code || "",
    discount: calc.discount,
    total: calc.total,
    payment: {
      id: payment.id,
      name: ctx.L(payment.name),
      discount: payment.discount || 0
    },
    currency: "MRU",
    storePhone: ctx.SET.whatsapp
  };
}

/** One WhatsApp line per order item. */
export function messageItemsHTML(ctx, items) {
  return items
    .map((item) => {
      const variant = item.variantTitle ? ` (${item.variantTitle})` : "";
      const specs = item.specsText ? `\n   ${item.specsText}` : "";
      return `- ${item.title}${variant}${specs} × ${item.qty} = ${ctx.money(item.line ?? item.price * item.qty)}`;
    })
    .join("\n");
}

/** Replaces `{key}` placeholders in the store's WhatsApp template. */
export function fillTemplate(template, values) {
  let message = template;
  Object.entries(values).forEach(([key, value]) => {
    message = message.replaceAll(`{${key}}`, String(value ?? ""));
  });
  return message;
}

/** Values injected in the store's WhatsApp template for an order. */
export function orderTemplateValues(ctx, order, draft, form, payName, cityName) {
  return {
    store: ctx.L(ctx.SET.storeName),
    order_id: order.id,
    name: draft.customer.name,
    phone: draft.customer.phone,
    city: cityName,
    address: draft.customer.address,
    payment: payName,
    items: messageItemsHTML(ctx, order.items || draft.items),
    subtotal: ctx.money(order.subtotal),
    shipping: order.shipping ? ctx.money(order.shipping) : ctx.t("free"),
    discount: ctx.money(order.discount),
    total: ctx.money(order.total),
    notes: form.notes || (ctx.R.lang === "ar" ? "لا توجد" : "Aucune")
  };
}

/** Builds the WhatsApp message for an order using the store template and the store's language. */
export function buildOrderMessage(ctx, order, draft, form) {
  const payName = ctx.L(order.payment?.name || draft.payment.name);
  const cityName = ctx.L(order.customer?.city || draft.customer.city);
  const template = ctx.SET.orderTemplate?.[ctx.R.lang] || ctx.SET.orderTemplate?.ar || "";
  const values = orderTemplateValues(ctx, order, draft, form, payName, cityName);
  return { message: fillTemplate(template, values), payName, cityName };
}

/** Normalises the store's WhatsApp number to international form (Mauritania 8-digit numbers get +222). */
export function whatsappNumber(raw) {
  let wa = onlyDigits(raw);
  if (wa.length === 8) wa = `222${wa}`;
  return wa;
}

/** The wa.me link for a message. */
export function whatsappLink(rawNumber, message) {
  return `https://wa.me/${whatsappNumber(rawNumber)}?text=${encodeURIComponent(message)}`;
}

/** Looks up an active coupon by code (case-insensitive). */
export function findCoupon(coupons, code) {
  const wanted = String(code || "")
    .trim()
    .toUpperCase();
  if (!wanted) return null;
  return (coupons || []).find((item) => item.active !== false && String(item.code).toUpperCase() === wanted) || null;
}

/** Payload saved as an abandoned checkout. */
export function abandonedLead(ctx, { form, city, items, subtotal }) {
  return {
    name: String(form.name || "").trim(),
    phone: onlyDigits(form.phone),
    city: ctx.L(city?.name),
    cityId: city?.id,
    items: items.map((it) => ({
      handle: it.handle,
      title: it.product.title,
      qty: it.qty,
      variant: ctx.variantLabel(it.variant)
    })),
    subtotal,
    lang: ctx.R.lang
  };
}
