/* dashboard.js → Event delegation (part 2a: shell, orders, catalog, content, homepage) — part 2b in 22b-events-settings.js
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js).
   The `[data-action]` table lives in 22c-actions-forms.js. */
import { actionPayload, buildFormActions, runAction } from "./22c-actions-forms.js";

export function install(ctx) {
  /** Route/navigation controls handled before the action table. Each consumes the click. */
  const NAV_CLICKS = [
    {
      match: (event) => event.target.closest("[data-route]"),
      run: (event, link) => {
        event.preventDefault();
        ctx.route = link.dataset.route;
        if (location.hash !== `#${ctx.route}`) history.replaceState(null, "", `#${ctx.route}`);
        ctx.$("#dash-sidebar")?.classList.remove("open");
        ctx.renderRoute();
      }
    },
    {
      match: (event) => event.target.closest("[data-dash-lang]"),
      run: (event, button) => {
        ctx.dashLang = button.dataset.dashLang === "fr" ? "fr" : "ar";
        localStorage.setItem(ctx.LS_DASH_LANG, ctx.dashLang);
        document.documentElement.lang = ctx.dashLang;
        document.documentElement.dir = ctx.dashLang === "ar" ? "rtl" : "ltr";
        if (ctx.session?.mustChange) ctx.renderPasswordChange();
        else if (ctx.session) ctx.renderShell();
        else ctx.renderLogin();
      }
    },
    {
      match: (event) => event.target.closest("[data-dash-tab]"),
      run: (event, tab) => {
        const tabs = tab.parentElement;
        tabs.querySelectorAll("[data-dash-tab]").forEach((item) => item.classList.toggle("active", item === tab));
        tabs.parentElement
          .querySelectorAll("[data-dash-panel]")
          .forEach((panel) => panel.classList.toggle("active", panel.dataset.dashPanel === tab.dataset.dashTab));
      }
    },
    {
      match: (event) => event.target.closest("[data-order-filter]"),
      run: (event, button) => {
        ctx.orderFilter = button.dataset.orderFilter;
        ctx.renderRoute();
      }
    },
    {
      match: (event) => event.target.closest("[data-abandoned-filter]"),
      run: (event, button) => {
        ctx.abandonedFilter = button.dataset.abandonedFilter;
        ctx.renderRoute();
      }
    },
    {
      match: (event) => event.target.closest("[data-report-range]"),
      run: (event, button) => {
        ctx.reportRange = button.dataset.reportRange;
        ctx.renderRoute();
      }
    },
    /* `[data-product-filter]` is intentionally a no-op here: it is handled by the change listener. */
    { match: (event) => event.target.closest("[data-product-filter]"), run: () => {} }
  ];

  document.addEventListener("click", (event) => {
    for (const entry of NAV_CLICKS) {
      const node = entry.match(event);
      if (!node) continue;
      entry.run(event, node);
      return;
    }
    const actionNode = event.target.closest("[data-action]");
    if (!actionNode) return;
    runAction(ctx.formActions, actionNode.dataset.action, actionPayload(ctx, actionNode, event));
  });

  Object.assign(ctx, { formActions: buildFormActions(ctx) });
}
