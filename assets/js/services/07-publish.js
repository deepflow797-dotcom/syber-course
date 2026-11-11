// @ts-check
/* state.js → Published state, drafts and remote polling
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */

export function install(ctx) {
  Object.assign(ctx, {
    pushPublishedState,
    publish,
    saveDraft,
    discardDraft,
    useDraft,
    resetLocalDemo,
    loadRemoteState
  });
  async function pushPublishedState(next) {
    if (!ctx.REMOTE) return;
    if (!(await ctx.remoteSessionValid())) throw new Error("انتهت جلسة Supabase. أعد تسجيل الدخول.");
    await ctx.supa(
      `/rest/v1/${ctx.CFG.stateTable}`,
      {
        method: "POST",
        body: JSON.stringify({ id: "main", data: next, updated_at: next.updatedAt }),
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" }
      },
      true
    );
  }
  async function publish(next = ctx.state) {
    const candidate = ctx.hydrate(ctx.clone(next));
    candidate.updatedAt = ctx.nowISO();
    candidate.version = Number(candidate.version || 0) + 1;
    if (ctx.REMOTE) {
      if (!(await ctx.remoteSessionValid())) throw new Error("انتهت جلسة Supabase. أعد تسجيل الدخول.");
      // Catalog entities live in relational tables; never write them into restore_state.data.
      await pushPublishedState(ctx.catalogInfo.source === "tables" ? ctx.stripCatalog(candidate) : candidate);
    }
    if (ctx.catalogInfo.source === "tables") {
      // keep the in-memory/published copy consistent with the tables, not with the draft
      candidate.products = ctx.state.products;
      candidate.collections = ctx.state.collections;
      candidate.settings = { ...candidate.settings, coupons: ctx.state.settings?.coupons || [] };
    }
    ctx.state = candidate;
    const stored = ctx.writeJSON(ctx.LS_STATE, ctx.state);
    if (!stored) throw new Error("تعذر حفظ البيانات محليًا. مساحة التخزين ممتلئة.");
    localStorage.removeItem(ctx.LS_DRAFT);
    ctx.draft = null;
    ctx.applyDocument();
    ctx.channel?.postMessage({ type: "state", updatedAt: ctx.state.updatedAt });
    window.dispatchEvent(new CustomEvent("restore:changed", { detail: { source: "publish" } }));
    return ctx.state;
  }
  function saveDraft(next = ctx.state) {
    const candidate = ctx.hydrate(ctx.clone(next));
    candidate.updatedAt = ctx.nowISO();
    ctx.draft = candidate;
    ctx.writeJSON(ctx.LS_DRAFT, ctx.draft);
    return ctx.draft;
  }
  function discardDraft() {
    localStorage.removeItem(ctx.LS_DRAFT);
    ctx.draft = null;
  }
  function useDraft() {
    if (!ctx.draft) return ctx.state;
    ctx.state = ctx.hydrate(ctx.clone(ctx.draft));
    ctx.applyDocument();
    return ctx.state;
  }
  function resetLocalDemo() {
    [
      ctx.LS_STATE,
      ctx.LS_DRAFT,
      ctx.LS_MANAGERS,
      ctx.LS_ORDERS,
      ctx.LS_ABANDONED,
      ctx.LS_AUDIT,
      ctx.LS_SESSION,
      ctx.LS_CUSTOMERS,
      ctx.LS_REVIEWS,
      ctx.LS_CUSTOMER,
      ctx.LS_CUSTOMER_SESSION,
      ctx.LS_LOGIN_ATTEMPTS
    ].forEach((key) => localStorage.removeItem(key));
    try {
      sessionStorage.removeItem(ctx.LS_SESSION);
    } catch {}
    ctx.tokenVault.accessToken = "";
    ctx.tokenVault.refreshToken = "";
    location.reload();
  }
  async function loadRemoteState() {
    if (!ctx.REMOTE) return false;
    try {
      const rows = await ctx.supa(`/rest/v1/${ctx.CFG.stateTable}?id=eq.main&select=id,data,updated_at`);
      const remote = Array.isArray(rows) ? rows[0] : null;
      if (!remote?.data) return false;
      const remoteStamp = Date.parse(remote.updated_at || remote.data.updatedAt || 0) || 0;
      const localStamp = Date.parse(ctx.state.updatedAt || 0) || 0;
      if (remoteStamp <= localStamp) return false;
      ctx.state = ctx.hydrate(remote.data);
      ctx.writeJSON(ctx.LS_STATE, ctx.state);
      if (ctx.catalogInfo.source !== "state")
        await ctx.loadCatalog({ staff: ctx.session?.mode === "supabase", silent: true });
      ctx.applyDocument();
      window.dispatchEvent(new CustomEvent("restore:changed", { detail: { source: "remote" } }));
      return true;
    } catch (error) {
      console.warn("Restore: state sync failed", error);
      return false;
    }
  }
}
