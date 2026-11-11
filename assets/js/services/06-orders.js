// @ts-check
/* state.js → Orders, abandoned carts and audit
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */

export function install(ctx) {
  Object.assign(ctx, {
    notifyOrders,
    getOrders,
    saveOrders,
    getCustomerOrders,
    submitOrder,
    addOrder,
    updateOrder,
    normalizeRemoteOrder,
    refreshOrders,
    getAbandoned,
    abandonedToken,
    saveAbandoned,
    removeAbandoned,
    getAudit,
    addAudit
  });
  function notifyOrders() {
    ctx.channel?.postMessage({ type: "orders" });
    window.dispatchEvent(new CustomEvent("restore:orders"));
  }
  function getOrders() {
    const list = ctx.readJSON(ctx.LS_ORDERS, []);
    return Array.isArray(list) ? list : [];
  }
  function saveOrders(orders, broadcast = true) {
    ctx.writeJSON(ctx.LS_ORDERS, Array.isArray(orders) ? orders : []);
    if (broadcast) notifyOrders();
  }
  function getCustomerOrders() {
    const customer = ctx.currentCustomer;
    if (!customer) return [];
    const phone = ctx.normalizeDigits(customer.phone || "").slice(-8);
    const email = ctx.normalizeEmail(customer.email || "");
    return getOrders().filter((order) => {
      const orderPhone = ctx.normalizeDigits(order.customer?.phone || "").slice(-8);
      const orderEmail = ctx.normalizeEmail(order.customer?.email || "");
      return (
        (customer.authId && order.customerAuthId === customer.authId) ||
        (customer.id && order.customerId === customer.id) ||
        (phone && orderPhone === phone) ||
        (email && orderEmail === email)
      );
    });
  }
  /**
   * Place an order. REMOTE: validated server-side by the create-order Edge Function (prices/stock recomputed in SQL);
   * LOCAL demo only: stored in localStorage and flagged `serverValidated:false`.
   * @param {import("../../../types/global.d.ts").Order} order
   * @returns {Promise<import("../../../types/global.d.ts").Order>}
   */
  async function submitOrder(order) {
    if (!order) throw new Error("طلب غير صالح");
    // Prefer server-side validation when an Edge Function is configured.
    if (ctx.REMOTE && ctx.CFG.createOrderFunction) {
      try {
        const res = await fetch(ctx.remoteUrl(`/functions/v1/${ctx.CFG.createOrderFunction}`), {
          method: "POST",
          headers: { apikey: ctx.CFG.supabaseAnonKey, "Content-Type": "application/json" },
          body: JSON.stringify({ order })
        });
        const payload = await res.json().catch(() => ({}));
        if (res.ok && payload?.ok && payload?.order) {
          const next =
            normalizeRemoteOrder({
              id: payload.order.id,
              data: payload.order,
              status: payload.order.status,
              created_at: payload.order.createdAt,
              updated_at: payload.order.updatedAt
            }) || payload.order;
          next.serverValidated = true;
          const orders = getOrders().filter((o) => o.id !== next.id);
          orders.unshift(next);
          saveOrders(orders);
          return next;
        }
        const message = payload?.error || (res.status >= 500 ? "الخادم مشغول مؤقتًا" : "تعذر التحقق من الطلب");
        throw new Error(message);
      } catch (error) {
        if (ctx.REMOTE && ctx.CFG.requireServerOrders !== false) {
          throw new Error(
            String(error?.message || "تعذر التحقق من الطلب") + " / Impossible de valider la commande. Réessayez."
          );
        }
        console.warn("Restore: secure order function unavailable, explicit fallback allowed", error);
      }
    }
    if (ctx.REMOTE && ctx.CFG.requireServerOrders !== false) {
      throw new Error("التحقق الخادمي للطلبات مطلوب. انشر دالة create-order / Validation serveur requise.");
    }
    // Local demo only: store order locally without trusting client totals on a remote DB.
    return addOrder({ ...order, serverValidated: false, validationMode: "local-demo" }, { remote: false });
  }

  function addOrder(order, options = {}) {
    if (!order || !order.id) throw new Error("طلب غير صالح");
    const next = { ...order, updatedAt: ctx.nowISO() };
    if (ctx.currentCustomer) {
      next.customerId = ctx.currentCustomer.id || "";
      next.customerAuthId = ctx.customerAuth?.user?.id || ctx.currentCustomer.authId || "";
    }
    const orders = getOrders();
    orders.unshift(next);
    saveOrders(orders);
    // Never insert untrusted client-priced orders into the remote database.
    if (ctx.REMOTE && options.remote === true && options.trusted === true) {
      ctx
        .supa(`/rest/v1/${ctx.CFG.ordersTable}`, {
          method: "POST",
          body: JSON.stringify({
            id: next.id,
            data: next,
            status: next.status || "new",
            customer_id: next.customerAuthId || null,
            created_at: next.createdAt || ctx.nowISO(),
            updated_at: next.updatedAt
          }),
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" }
        })
        .catch((error) => console.warn("Restore: remote order sync failed", error));
    }
    return next;
  }
  function updateOrder(id, patch) {
    const orders = getOrders().map((order) =>
      order.id === id ? { ...order, ...patch, updatedAt: ctx.nowISO() } : order
    );
    saveOrders(orders);
    const updated = orders.find((order) => order.id === id) || null;
    if (ctx.REMOTE && updated) {
      ctx
        .supa(
          `/rest/v1/${ctx.CFG.ordersTable}?id=eq.${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ data: updated, status: updated.status, updated_at: updated.updatedAt }),
            headers: { Prefer: "return=minimal" }
          },
          true
        )
        .catch((error) => console.warn("Restore: order update failed", error));
    }
    return updated;
  }

  function normalizeRemoteOrder(row) {
    if (!row) return null;
    const data = row.data && typeof row.data === "object" ? ctx.clone(row.data) : {};
    data.id = data.id || row.id;
    data.status = data.status || row.status || "new";
    data.createdAt = data.createdAt || row.created_at || ctx.nowISO();
    data.updatedAt = data.updatedAt || row.updated_at || data.createdAt;
    if (row.customer_id) data.customerAuthId = row.customer_id;
    return data;
  }
  async function refreshOrders() {
    if (!ctx.REMOTE) return getOrders();
    let rows = null;
    try {
      if (ctx.session?.mode === "supabase" && (await ctx.remoteSessionValid())) {
        rows = await ctx.supa(`/rest/v1/${ctx.CFG.ordersTable}?select=*&order=created_at.desc&limit=1000`, {}, true);
      } else if (ctx.customerAuth?.accessToken) {
        if (ctx.customerTokenExpiring() && !(await ctx.refreshCustomerToken())) return getOrders();
        const uidValue = ctx.customerAuth.user?.id;
        if (!uidValue) return getOrders();
        rows = await ctx.supa(
          `/rest/v1/${ctx.CFG.ordersTable}?customer_id=eq.${encodeURIComponent(uidValue)}&select=*&order=created_at.desc&limit=300`
        );
      }
    } catch (error) {
      console.warn("Restore: order refresh failed", error);
      return getOrders();
    }
    if (!Array.isArray(rows) || !rows.length) return getOrders();
    const local = getOrders();
    const map = new Map(local.map((order) => [order.id, order]));
    let changed = false;
    rows
      .map(normalizeRemoteOrder)
      .filter(Boolean)
      .forEach((remoteOrder) => {
        const existing = map.get(remoteOrder.id);
        if (!existing || Date.parse(remoteOrder.updatedAt || 0) > Date.parse(existing.updatedAt || 0)) {
          map.set(remoteOrder.id, remoteOrder);
          changed = true;
        }
      });
    if (changed) saveOrders([...map.values()]);
    return getOrders();
  }

  function getAbandoned() {
    const rows = ctx.readJSON(ctx.LS_ABANDONED, []);
    return Array.isArray(rows) ? rows : [];
  }
  function abandonedToken() {
    const key = "restore_abandoned_token_v1";
    let token = localStorage.getItem(key);
    if (!token) {
      token = ctx.uid("tok");
      localStorage.setItem(key, token);
    }
    return token;
  }
  function saveAbandoned(entry) {
    const rows = getAbandoned();
    const phone = ctx.normalizeDigits(entry.phone);
    const existing = rows.find((item) => ctx.normalizeDigits(item.phone) === phone && item.status === "open" && phone);
    if (existing) Object.assign(existing, entry, { updatedAt: ctx.nowISO(), cartToken: abandonedToken() });
    else
      rows.unshift({
        id: phone ? `ab_${phone.slice(-8)}` : `ab_${Date.now()}`,
        createdAt: ctx.nowISO(),
        status: "open",
        cartToken: abandonedToken(),
        ...entry
      });
    ctx.writeJSON(ctx.LS_ABANDONED, rows.slice(0, 100));
    ctx.channel?.postMessage({ type: "abandoned" });
    if (ctx.REMOTE && phone) {
      const row = rows.find((item) => ctx.normalizeDigits(item.phone) === phone && item.status === "open");
      const payload = {
        id: row.id,
        data: row,
        cart_token: row.cartToken || abandonedToken(),
        created_at: row.createdAt,
        updated_at: row.updatedAt || ctx.nowISO()
      };
      // Insert-only for anon safety (no public update permission). Ignore duplicates.
      ctx
        .supa(`/rest/v1/${ctx.CFG.abandonedTable}`, {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }
        })
        .catch(() => {});
    }
  }
  function removeAbandoned(id) {
    ctx.writeJSON(
      ctx.LS_ABANDONED,
      getAbandoned().filter((item) => item.id !== id)
    );
    ctx.channel?.postMessage({ type: "abandoned" });
  }

  function getAudit() {
    const rows = ctx.readJSON(ctx.LS_AUDIT, []);
    return Array.isArray(rows) ? rows : [];
  }
  function addAudit(action, actor) {
    const log = {
      id: ctx.uid("log"),
      action: String(action || "").slice(0, 300),
      actor: String(actor || ctx.session?.username || "system"),
      at: ctx.nowISO()
    };
    const rows = [log, ...getAudit()].slice(0, 500);
    ctx.writeJSON(ctx.LS_AUDIT, rows);
    ctx.channel?.postMessage({ type: "audit" });
    if (ctx.REMOTE && ctx.session?.mode === "supabase") {
      ctx
        .supa(
          `/rest/v1/${ctx.CFG.auditTable}`,
          {
            method: "POST",
            body: JSON.stringify({ id: log.id, data: log, created_at: log.at }),
            headers: { Prefer: "return=minimal" }
          },
          true
        )
        .catch(() => {});
    }
  }
}
