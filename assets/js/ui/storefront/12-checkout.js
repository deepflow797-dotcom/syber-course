// @ts-check
/* app.js → Checkout
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js).
   The markup lives in 12a-checkout-markup.js and the pure rules in 12b-checkout-flow.js. */
import { computeTotals, couponDiscount } from "../../domain/pricing.js";
import { checkoutPageHTML, checkoutSuccessHTML, emptyCheckoutHTML, noPaymentHTML } from "./12a-checkout-markup.js";
import {
  abandonedLead,
  buildOrderDraft,
  buildOrderMessage,
  findCoupon,
  normalizePhone,
  onlyDigits,
  validateCheckout,
  whatsappLink,
  whatsappNumber
} from "./12b-checkout-flow.js";

/** @param {StorefrontCtx} ctx */
/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { renderCheckout });

  function renderCheckout() {
    const root = document.getElementById("checkout-root");
    if (!root) return;
    document.title = `${ctx.t("checkout")} | ${ctx.L(ctx.SET.storeName)}`;
    const items = ctx.cartDetails();
    if (!items.length) {
      root.innerHTML = emptyCheckoutHTML(ctx);
      return;
    }
    const subtotal = ctx.cartSubtotal();
    const cities = (ctx.SET.cities || []).filter((c) => c.active !== false);
    const payments = (ctx.SET.payments || []).filter((p) => p.active !== false);
    if (!payments.length) {
      root.innerHTML = noPaymentHTML(ctx);
      return;
    }
    const open = ctx.R.isStoreOpen();
    const defaultCity = cities.find((c) => c.id === "nouakchott") || cities[0];
    let appliedCoupon = null;
    let selectedPayment = payments[0];

    root.innerHTML = checkoutPageHTML(ctx, { items, subtotal, cities, payments, open, defaultCity, selectedPayment });

    /**
     * Typed `getElementById` for the checkout markup (inputs, cells, rows).
     * @param {string} id
     * @returns {any}
     */
    const $ = (id) => document.getElementById(id);
    const digits = onlyDigits;

    prefillCustomer();

    function fillIfEmpty(id, value) {
      const el = $(id);
      if (el && !el.value) el.value = value || "";
    }

    function prefillCustomer() {
      const signedCustomer = ctx.R.getCustomer();
      if (!signedCustomer) return;
      fillIfEmpty("co-name", signedCustomer.name);
      fillIfEmpty("co-phone", digits(signedCustomer.phone).slice(-8));
      fillIfEmpty("co-email", signedCustomer.email);
      const savedAddress = (signedCustomer.addresses || [])[0];
      if (!savedAddress) return;
      fillIfEmpty("co-address", savedAddress.address || savedAddress.line1);
      if ($("co-city") && savedAddress.cityId) $("co-city").value = savedAddress.cityId;
      refresh();
    }

    function selectedCity() {
      return cities.find((city) => city.id === $("co-city")?.value) || defaultCity;
    }
    function totals() {
      const city = selectedCity();
      const calc = computeTotals({
        subtotal,
        city,
        freeOver: ctx.SET.freeShippingOver || 0,
        payment: selectedPayment,
        coupon: appliedCoupon
      });
      return { ...calc, city };
    }

    function refresh() {
      const calc = totals();
      $("sum-shipping").textContent = calc.shipping ? ctx.money(calc.shipping) : ctx.t("free");
      $("sum-city").textContent = calc.city ? `· ${ctx.L(calc.city.name)}` : "";
      $("sum-payment-label").textContent = `${ctx.L(selectedPayment.name)} -${selectedPayment.discount || 0}%`;
      $("sum-payment").textContent = `- ${ctx.money(calc.paymentDiscount)}`;
      $("sum-payment").closest(".sum-row").hidden = !calc.paymentDiscount;
      $("sum-coupon").textContent = `- ${ctx.money(calc.couponDiscount)}`;
      $("sum-coupon").closest(".sum-row").hidden = !calc.couponDiscount;
      $("sum-total").textContent = ctx.money(calc.total);
      $("sum-subtotal").textContent = ctx.money(subtotal);
    }

    function readForm() {
      return {
        name: $("co-name").value,
        phone: $("co-phone").value,
        email: $("co-email").value,
        address: $("co-address").value,
        notes: $("co-notes").value
      };
    }

    function saveLead() {
      const form = readForm();
      const phone = digits(form.phone);
      const name = form.name.trim();
      if (!phone && !name) return;
      ctx.R.saveAbandoned(abandonedLead(ctx, { form, city: selectedCity(), items, subtotal }));
    }
    let leadTimer;
    const onLead = () => {
      clearTimeout(leadTimer);
      leadTimer = setTimeout(saveLead, 900);
    };
    ["co-name", "co-phone", "co-email", "co-address", "co-notes"].forEach((id) =>
      $(id)?.addEventListener("input", onLead)
    );
    ["co-city"].forEach((id) =>
      $(id)?.addEventListener("change", () => {
        onLead();
        refresh();
      })
    );
    document.querySelectorAll('input[name="co-payment"]').forEach((node) => {
      const radio = /** @type {HTMLInputElement} */ (node);
      radio.addEventListener("change", () => {
        selectedPayment = payments.find((payment) => payment.id === radio.value) || payments[0];
        document
          .querySelectorAll(".payment-card")
          .forEach((card) => card.classList.toggle("active", !!card.querySelector("input:checked")));
        refresh();
      });
    });
    $("apply-coupon")?.addEventListener("click", () => {
      const code = $("co-coupon").value.trim().toUpperCase();
      if (!code) return;
      const coupon = findCoupon(ctx.SET.coupons, code);
      const res = couponDiscount(subtotal, coupon);
      if (!coupon || !res.code) {
        appliedCoupon = null;
        ctx.toast(ctx.t("couponInvalid"));
      } else {
        appliedCoupon = coupon;
        ctx.toast(`${ctx.t("couponApplied")}: ${res.code}`);
      }
      refresh();
    });

    function lockButton() {
      const btn = $("place-order");
      if (!btn) return null;
      btn.disabled = true;
      btn.dataset.label = btn.innerHTML;
      btn.textContent = ctx.t("processing") || "…";
      return btn;
    }

    /** Persists the confirmed order through the existing service paths and paints the success screen. */
    function finalizeOrder(draft, phone, form, order) {
      const built = buildOrderMessage(ctx, order, draft, form);
      if (!whatsappNumber(ctx.SET.whatsapp)) {
        ctx.toast(
          ctx.R.lang === "ar" ? "أضف رقم واتساب من لوحة التحكم" : "Ajoutez le WhatsApp depuis le tableau de bord"
        );
        return;
      }
      const link = whatsappLink(ctx.SET.whatsapp, built.message);
      if (order.whatsappUrl !== link && typeof ctx.R.updateOrder === "function")
        ctx.R.updateOrder(order.id, { whatsappUrl: link, message: built.message });

      ctx.R.decrementStock(order.items || draft.items);
      const openLead = ctx.R.getAbandoned().find((lead) => lead.status === "open" && digits(lead.phone) === phone);
      if (openLead) ctx.R.removeAbandoned(openLead.id);
      localStorage.setItem(`restore_last_order_${phone}`, String(Date.now()));
      localStorage.removeItem(ctx.CART_KEY);
      ctx.syncBadges();
      ctx.renderCart();
      root.innerHTML = checkoutSuccessHTML(ctx, { order, payName: built.payName, link });
      setTimeout(() => {
        window.location.href = link;
      }, 1100);
    }

    function rejectOrder(verdict) {
      ctx.toast(ctx.t(verdict.code));
      if (verdict.focus) $(verdict.focus)?.focus();
    }

    function restoreButton(btn) {
      if (!btn) return;
      btn.disabled = false;
      btn.innerHTML = btn.dataset.label || ctx.t("placeOrder");
    }

    async function placeOrder() {
      const form = readForm();
      const phone = normalizePhone(form.phone);
      const verdict = validateCheckout({
        form,
        open,
        blocklist: ctx.SET.blocklist,
        rateLimitSeconds: ctx.SET.rateLimitSeconds,
        lastOrderAt: Number(localStorage.getItem(`restore_last_order_${phone}`) || 0)
      });
      if (!verdict.ok) return rejectOrder(verdict);
      const btn = lockButton();
      try {
        const calc = totals();
        const draft = buildOrderDraft(ctx, {
          form,
          phone: verdict.phone,
          calc,
          items,
          subtotal,
          payment: selectedPayment,
          coupon: appliedCoupon
        });
        // Server-validated when the create-order Edge Function is deployed; falls back safely otherwise.
        const order = typeof ctx.R.submitOrder === "function" ? await ctx.R.submitOrder(draft) : ctx.R.addOrder(draft);
        finalizeOrder(draft, verdict.phone, form, order);
      } catch (error) {
        console.error("Restore: checkout failed", error);
        ctx.toast(String(error?.message || ctx.t("required") || "Error"));
        restoreButton(btn);
      }
    }

    $("place-order")?.addEventListener("click", placeOrder);

    refresh();
  }
}
