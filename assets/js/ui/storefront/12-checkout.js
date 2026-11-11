/* app.js → Checkout
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */
import { computeTotals, couponDiscount } from "../../domain/pricing.js";

export function install(ctx) {
  Object.assign(ctx, { renderCheckout });
  function renderCheckout() {
    const root = document.getElementById("checkout-root");
    if (!root) return;
    document.title = `${ctx.t("checkout")} | ${ctx.L(ctx.SET.storeName)}`;
    const items = ctx.cartDetails();
    if (!items.length) {
      root.innerHTML = `<div class="container"><div class="empty-state"><h2>${ctx.esc(ctx.t("emptyCheckout"))}</h2><p>${ctx.esc(ctx.t("emptyCartText"))}</p><a class="btn btn-primary" href="collection.html?handle=all">${ctx.esc(ctx.t("shopNow"))}</a></div></div>`;
      return;
    }
    const subtotal = ctx.cartSubtotal();
    const cities = (ctx.SET.cities || []).filter((c) => c.active !== false);
    const payments = (ctx.SET.payments || []).filter((p) => p.active !== false);
    if (!payments.length) {
      root.innerHTML = `<div class="container"><div class="empty-state"><h2>${ctx.esc(ctx.t("emptyCheckout"))}</h2><p>${ctx.esc(ctx.R.lang === "ar" ? "لا توجد وسيلة دفع مفعّلة. أضفها من لوحة التحكم." : "Aucun moyen de paiement actif. Ajoutez-en depuis le tableau de bord.")}</p></div></div>`;
      return;
    }
    const open = ctx.R.isStoreOpen();
    const defaultCity = cities.find((c) => c.id === "nouakchott") || cities[0];
    let appliedCoupon = null;
    let selectedPayment = payments[0];

    root.innerHTML = `
      <div class="container">
        <div class="breadcrumb"><a href="index.html">${ctx.esc(ctx.t("homeCrumb"))}</a><span>/</span><span>${ctx.esc(ctx.t("checkout"))}</span></div>
        <div class="checkout-head">
          <div><span class="eyebrow">${ctx.esc(ctx.L(ctx.SET.storeName))} · ${ctx.esc(ctx.L(ctx.SET.city))}</span><h1>${ctx.esc(ctx.t("checkout"))}</h1></div>
          <div class="checkout-secure">${ctx.ICON.shield} ${ctx.R.lang === "ar" ? "طلب آمن ومؤكد عبر واتساب" : "Commande sécurisée et confirmée sur WhatsApp"}</div>
        </div>
        ${!open ? `<div class="store-closed-banner">${ctx.ICON.clock}<div><strong>${ctx.esc(ctx.t("closedTitle"))}</strong><span>${ctx.esc(ctx.t("storeClosed"))}</span></div></div>` : ""}
        <div class="checkout-layout">
          <form id="checkout-form" class="checkout-form" novalidate>
            <section class="checkout-block">
              <div class="checkout-block-head"><span>1</span><h2>${ctx.esc(ctx.t("contactInfo"))}</h2></div>
              <div class="field-row">
                <div class="field"><label for="co-name">${ctx.esc(ctx.t("fullName"))} *</label><input id="co-name" autocomplete="name" required></div>
                <div class="field"><label for="co-phone">${ctx.esc(ctx.t("phone"))} *</label><div class="phone-input"><span>+222</span><input id="co-phone" inputmode="tel" autocomplete="tel" placeholder="46 00 00 00" maxlength="14" required></div></div>
              </div>
              <div class="field"><label for="co-email">${ctx.esc(ctx.t("email"))}</label><input id="co-email" type="email" autocomplete="email" placeholder="you@example.com"></div>
            </section>
            <section class="checkout-block">
              <div class="checkout-block-head"><span>2</span><h2>${ctx.esc(ctx.t("shippingDelivery"))}</h2></div>
              <div class="field-row">
                <div class="field"><label for="co-city">${ctx.esc(ctx.t("city"))} *</label><select id="co-city">${cities.map((city) => `<option value="${ctx.esc(city.id)}" ${city.id === defaultCity?.id ? "selected" : ""}>${ctx.esc(ctx.L(city.name))} — ${Number(city.fee) ? ctx.money(city.fee) : ctx.t("free")}</option>`).join("")}</select></div>
                <div class="field"><label>${ctx.esc(ctx.t("country"))}</label><div class="country-readonly"><img src="${ctx.SET.country.flag}" alt="" width="22" height="15">${ctx.esc(ctx.L(ctx.SET.country.name))}</div></div>
              </div>
              <div class="field"><label for="co-address">${ctx.esc(ctx.t("address"))} *</label><input id="co-address" autocomplete="street-address" placeholder="${ctx.esc(ctx.R.lang === "ar" ? "الحي، الشارع، رقم المنزل" : "Quartier, rue, numéro")}" required></div>
              <div class="field"><label for="co-notes">${ctx.esc(ctx.t("notes"))}</label><textarea id="co-notes" rows="3" placeholder="${ctx.esc(ctx.R.lang === "ar" ? "أي تفاصيل إضافية عن الطلب" : "Toute précision utile")}"></textarea></div>
              <p class="field-note">${ctx.ICON.truck} ${ctx.esc(ctx.L(ctx.SET.shippingNote))}</p>
            </section>
            <section class="checkout-block">
              <div class="checkout-block-head"><span>3</span><h2>${ctx.esc(ctx.t("payment"))}</h2></div>
              <div class="payment-grid">
                ${payments
                  .map(
                    (
                      payment,
                      i
                    ) => `<label class="payment-card ${i === 0 ? "active" : ""}" style="--pay:${ctx.esc(payment.color)}">
                  <input type="radio" name="co-payment" value="${ctx.esc(payment.id)}" ${i === 0 ? "checked" : ""}>
                  <span class="payment-mark">${payment.image || payment.logo ? `<img src="${ctx.esc(payment.image || payment.logo)}" alt="${ctx.esc(ctx.L(payment.name))}">` : ctx.esc(ctx.L(payment.name).slice(0, 2))}</span>
                  <span class="payment-copy"><strong>${ctx.esc(ctx.L(payment.name))}</strong><small>${ctx.esc(ctx.L(payment.note))}</small></span>
                  ${payment.discount ? `<span class="payment-discount">-${payment.discount}%</span>` : ""}
                </label>`
                  )
                  .join("")}
              </div>
              <div class="coupon-row">
                <div class="field"><label for="co-coupon">${ctx.esc(ctx.t("coupon"))}</label><input id="co-coupon" placeholder="RESTORE10"></div>
                <button class="btn btn-outline" type="button" id="apply-coupon">${ctx.esc(ctx.t("apply"))}</button>
              </div>
              <p class="field-note">${ctx.ICON.info} ${ctx.esc(ctx.R.lang === "ar" ? "الدفع يتم تأكيده عبر واتساب. لا يتم سحب أي مبلغ من هذا الموقع." : "Le paiement est confirmé sur WhatsApp. Aucun paiement n’est débité sur ce site.")}</p>
            </section>
          </div>
          <aside class="order-summary">
            <h2>${ctx.esc(ctx.t("orderSummary"))}</h2>
            <div class="sum-items">
              ${items
                .map(
                  (it) => `<div class="sum-item">
                <img src="${it.product.image}" alt="${ctx.esc(it.product.title)}">
                <div><div class="t">${ctx.esc(it.product.title)}</div><div class="p">${ctx.esc(ctx.variantLabel(it.variant))}${it.specs && Object.keys(it.specs).length ? ` · ${ctx.esc(ctx.specsText(it.specs))}` : ""} × ${it.qty}</div><strong>${ctx.money(it.line)}</strong></div>
              </div>`
                )
                .join("")}
            </div>
            <div class="sum-rows">
              <div class="sum-row"><span>${ctx.esc(ctx.t("subtotal"))}</span><span id="sum-subtotal">${ctx.money(subtotal)}</span></div>
              <div class="sum-row"><span>${ctx.esc(ctx.t("shipping"))} <small id="sum-city"></small></span><span id="sum-shipping">${ctx.money(0)}</span></div>
              <div class="sum-row discount" id="payment-row" hidden><span id="sum-payment-label">${ctx.esc(ctx.L(selectedPayment.name))} -${selectedPayment.discount || 0}%</span><span id="sum-payment">0</span></div>
              <div class="sum-row discount" id="coupon-row" hidden><span>${ctx.esc(ctx.t("coupon"))}</span><span id="sum-coupon">0</span></div>
              <div class="sum-row total"><span>${ctx.esc(ctx.t("total"))}</span><span id="sum-total">${ctx.money(subtotal)}</span></div>
            </div>
            <button class="btn btn-primary btn-block btn-whatsapp" type="button" id="place-order" ${!open ? "disabled" : ""}>${ctx.ICON.whatsapp} ${ctx.esc(!open ? ctx.t("closedTitle") : ctx.t("placeOrder"))}</button>
            <p class="checkout-redirect-note">${ctx.esc(ctx.t("redirecting"))}</p>
            <div class="accepted-pay">${payments.map((payment) => `<span style="--pay:${ctx.esc(payment.color)}">${ctx.esc(ctx.L(payment.name))}</span>`).join("")}</div>
            <div class="summary-help">${ctx.ICON.whatsapp}<span>${ctx.esc(ctx.t("contactUs"))}: <a class="phone-ltr" href="https://wa.me/${ctx.esc(ctx.SET.whatsapp)}" target="_blank" rel="noopener">${ctx.esc(ctx.SET.phoneDisplay)}</a></span></div>
          </aside>
        </div>
      </div>`;

    const $ = (id) => document.getElementById(id);
    const digits = (value) => String(value || "").replace(/\D/g, "");

    // Prefill known customer details without overwriting a typed draft.
    const signedCustomer = ctx.R.getCustomer();
    if (signedCustomer) {
      if ($("co-name") && !$("co-name").value) $("co-name").value = signedCustomer.name || "";
      if ($("co-phone") && !$("co-phone").value) $("co-phone").value = digits(signedCustomer.phone).slice(-8);
      if ($("co-email") && !$("co-email").value) $("co-email").value = signedCustomer.email || "";
      const savedAddress = (signedCustomer.addresses || [])[0];
      if (savedAddress) {
        if ($("co-address") && !$("co-address").value)
          $("co-address").value = savedAddress.address || savedAddress.line1 || "";
        if ($("co-city") && savedAddress.cityId) $("co-city").value = savedAddress.cityId;
        refresh();
      }
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
    function saveLead() {
      const phone = digits($("co-phone")?.value);
      const name = $("co-name")?.value.trim();
      if (!phone && !name) return;
      ctx.R.saveAbandoned({
        name,
        phone,
        city: ctx.L(selectedCity()?.name),
        cityId: selectedCity()?.id,
        items: items.map((it) => ({
          handle: it.handle,
          title: it.product.title,
          qty: it.qty,
          variant: ctx.variantLabel(it.variant)
        })),
        subtotal,
        lang: ctx.R.lang
      });
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
    document.querySelectorAll('input[name="co-payment"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        selectedPayment = payments.find((payment) => payment.id === radio.value) || payments[0];
        document
          .querySelectorAll(".payment-card")
          .forEach((card) => card.classList.toggle("active", card.querySelector("input")?.checked));
        refresh();
      });
    });
    $("apply-coupon")?.addEventListener("click", () => {
      const code = $("co-coupon").value.trim().toUpperCase();
      if (!code) return;
      const coupon = (ctx.SET.coupons || []).find(
        (item) => item.active !== false && String(item.code).toUpperCase() === code
      );
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

    $("place-order")?.addEventListener("click", async () => {
      if (!open) {
        ctx.toast(ctx.t("storeClosed"));
        return;
      }
      const name = $("co-name").value.trim();
      const address = $("co-address").value.trim();
      const email = $("co-email").value.trim();
      const notes = $("co-notes").value.trim();
      let phone = digits($("co-phone").value);
      if (phone.startsWith("222") && phone.length > 8) phone = phone.slice(3);
      if (!name || !phone || !address) {
        ctx.toast(ctx.t("required"));
        (!name ? $("co-name") : !phone ? $("co-phone") : $("co-address")).focus();
        return;
      }
      if (phone.length !== 8) {
        ctx.toast(ctx.t("invalidPhone"));
        $("co-phone").focus();
        return;
      }
      const fullPhone = `+222${phone}`;
      const blocked = (ctx.SET.blocklist || []).map(digits).filter(Boolean);
      if (blocked.includes(phone) || blocked.includes(fullPhone.replace(/\D/g, ""))) {
        ctx.toast(ctx.t("blockedPhone"));
        return;
      }
      const rateKey = `restore_last_order_${phone}`;
      const lastOrder = Number(localStorage.getItem(rateKey) || 0);
      const limit = Math.max(0, Number(ctx.SET.rateLimitSeconds || 0)) * 1000;
      if (limit && Date.now() - lastOrder < limit) {
        ctx.toast(ctx.t("rateLimited"));
        return;
      }
      const btn = $("place-order");
      if (btn) {
        btn.disabled = true;
        btn.dataset.label = btn.innerHTML;
        btn.textContent = ctx.t("processing") || "…";
      }
      try {
        const calc = totals();
        const draft = {
          id: ctx.R.orderId(),
          createdAt: new Date().toISOString(),
          status: "new",
          source: "whatsapp",
          lang: ctx.R.lang,
          customer: {
            name,
            phone: fullPhone,
            email,
            city: ctx.L(calc.city?.name),
            cityId: calc.city?.id,
            address,
            notes
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
          coupon: appliedCoupon?.code || "",
          discount: calc.discount,
          total: calc.total,
          payment: {
            id: selectedPayment.id,
            name: ctx.L(selectedPayment.name),
            discount: selectedPayment.discount || 0
          },
          currency: "MRU",
          storePhone: ctx.SET.whatsapp
        };

        // Server-validated when the create-order Edge Function is deployed; falls back safely otherwise.
        const order = typeof ctx.R.submitOrder === "function" ? await ctx.R.submitOrder(draft) : ctx.R.addOrder(draft);
        const payName = ctx.L(order.payment?.name || selectedPayment.name);
        const cityName = ctx.L(order.customer?.city || calc.city?.name);
        const messageItems = (order.items || draft.items)
          .map((item) => {
            const variant = item.variantTitle ? ` (${item.variantTitle})` : "";
            const specs = item.specsText ? `\n   ${item.specsText}` : "";
            return `- ${item.title}${variant}${specs} × ${item.qty} = ${ctx.money(item.line ?? item.price * item.qty)}`;
          })
          .join("\n");
        const template = ctx.SET.orderTemplate?.[ctx.R.lang] || ctx.SET.orderTemplate?.ar || "";
        const values = {
          store: ctx.L(ctx.SET.storeName),
          order_id: order.id,
          name,
          phone: fullPhone,
          city: cityName,
          address,
          payment: payName,
          items: messageItems,
          subtotal: ctx.money(order.subtotal),
          shipping: order.shipping ? ctx.money(order.shipping) : ctx.t("free"),
          discount: ctx.money(order.discount),
          total: ctx.money(order.total),
          notes: notes || (ctx.R.lang === "ar" ? "لا توجد" : "Aucune")
        };
        let message = template;
        Object.entries(values).forEach(([key, value]) => {
          message = message.replaceAll(`{${key}}`, String(value ?? ""));
        });
        let wa = digits(ctx.SET.whatsapp);
        if (wa.length === 8) wa = `222${wa}`;
        if (!wa) {
          ctx.toast(
            ctx.R.lang === "ar" ? "أضف رقم واتساب من لوحة التحكم" : "Ajoutez le WhatsApp depuis le tableau de bord"
          );
          return;
        }
        const link = `https://wa.me/${wa}?text=${encodeURIComponent(message)}`;
        if (order.whatsappUrl !== link && typeof ctx.R.updateOrder === "function")
          ctx.R.updateOrder(order.id, { whatsappUrl: link, message });

        ctx.R.decrementStock(order.items || draft.items);
        const openLead = ctx.R.getAbandoned().find((lead) => lead.status === "open" && digits(lead.phone) === phone);
        if (openLead) ctx.R.removeAbandoned(openLead.id);
        localStorage.setItem(rateKey, String(Date.now()));
        localStorage.removeItem(ctx.CART_KEY);
        ctx.syncBadges();
        ctx.renderCart();

        root.innerHTML = `<div class="container"><div class="checkout-success">
          <div class="ico">${ctx.ICON.check}</div>
          <span class="eyebrow">${ctx.esc(ctx.L(ctx.SET.storeName))}</span>
          <h1>${ctx.esc(ctx.t("orderReceived"))}</h1>
          <p>${ctx.esc(ctx.t("orderReceivedText"))}${order.serverValidated ? ` <small>(${ctx.esc(ctx.R.lang === "ar" ? "تم التحقق من السعر على الخادم" : "Prix validé côté serveur")})</small>` : ""}</p>
          <div class="success-order">
            <div><span>${ctx.esc(ctx.t("orderId"))}</span><strong>${ctx.esc(order.id)}</strong></div>
            <div><span>${ctx.esc(ctx.t("total"))}</span><strong>${ctx.money(order.total)}</strong></div>
            <div><span>${ctx.esc(ctx.t("payment"))}</span><strong>${ctx.esc(payName)}</strong></div>
          </div>
          <a class="btn btn-primary btn-whatsapp" id="open-whatsapp" href="${link}" target="_blank" rel="noopener">${ctx.ICON.whatsapp} ${ctx.esc(ctx.t("openWhatsApp"))}</a>
          <a class="btn btn-outline" href="collection.html?handle=all">${ctx.esc(ctx.t("backToShop"))}</a>
          <p class="redirecting">${ctx.esc(ctx.t("redirecting"))}</p>
        </div></div>`;
        setTimeout(() => {
          window.location.href = link;
        }, 1100);
      } catch (error) {
        console.error("Restore: checkout failed", error);
        ctx.toast(String(error?.message || ctx.t("required") || "Error"));
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = btn.dataset.label || ctx.t("placeOrder");
        }
      }
    });

    refresh();
  }
}
