// @ts-check
/* state.js → Cross-tab and cross-device notifications
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */

export function install(ctx) {
  if (ctx.REMOTE) {
    ctx.loadRemoteState().finally(() => ctx.loadCatalog({ silent: false }));
    setInterval(ctx.loadRemoteState, Math.max(2500, Number(ctx.CFG.pollMs) || 5000));
    setInterval(ctx.pollCatalog, Math.max(2500, Number(ctx.CFG.pollMs) || 5000));
    setInterval(() => {
      if (ctx.session?.mode === "supabase") ctx.remoteSessionValid().catch(() => {});
      if (ctx.customerAuth?.accessToken) ctx.refreshCustomerToken().catch(() => {});
    }, 60000);
    setTimeout(() => {
      if (ctx.session?.mode === "supabase") ctx.refreshStaff().catch(() => {});
      if (ctx.customerAuth?.accessToken) ctx.restoreCustomerSession().catch(() => {});
      ctx.refreshReviews().catch(() => {});
    }, 400);
  } else {
    ctx.reviewCache = ctx.loadLocalReviews();
    setTimeout(() => ctx.refreshReviews().catch(() => {}), 0);
  }
  ctx.channel?.addEventListener("message", (event) => {
    if (event.data?.type === "state")
      window.dispatchEvent(new CustomEvent("restore:changed", { detail: { source: "tab" } }));
    if (event.data?.type === "orders")
      window.dispatchEvent(new CustomEvent("restore:orders", { detail: { source: "tab" } }));
    if (event.data?.type === "reviews")
      window.dispatchEvent(new CustomEvent("restore:reviews", { detail: { source: "tab" } }));
    if (event.data?.type === "customer") {
      ctx.currentCustomer = ctx.readJSON(ctx.LS_CUSTOMER, null);
      window.dispatchEvent(new CustomEvent("restore:customer", { detail: ctx.currentCustomer }));
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === ctx.LS_STATE)
      window.dispatchEvent(new CustomEvent("restore:changed", { detail: { source: "storage" } }));
    if (event.key === ctx.LS_ORDERS)
      window.dispatchEvent(new CustomEvent("restore:orders", { detail: { source: "storage" } }));
    if (event.key === ctx.LS_REVIEWS) {
      ctx.setReviewCache(ctx.loadLocalReviews(), false);
      window.dispatchEvent(new CustomEvent("restore:reviews", { detail: { source: "storage" } }));
    }
    if (event.key === ctx.LS_CUSTOMER || event.key === ctx.LS_CUSTOMERS) {
      ctx.currentCustomer = ctx.readJSON(ctx.LS_CUSTOMER, null);
      window.dispatchEvent(new CustomEvent("restore:customer", { detail: ctx.currentCustomer }));
    }
  });
}
