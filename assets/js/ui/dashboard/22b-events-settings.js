// @ts-check
/* dashboard.js → Event delegation (part 2b: marketing, payments, cities, team, blog/pages, FAQ, reviews, audit, profile)
   Same [data-action] dispatch as 22-events-forms.js; the action table lives in 22d-actions-settings.js. */
import { actionPayload, runAction } from "./22c-actions-forms.js";
import { buildSettingsActions } from "./22d-actions-settings.js";

/** @param {DashboardCtx} ctx */
/** @param {DashboardCtx} ctx */
export function install(ctx) {
  document.addEventListener("click", (event) => {
    const actionNode = /** @type {HTMLElement | null} */ (
      /** @type {HTMLElement} */ (event.target).closest("[data-action]")
    );
    if (!actionNode) return;
    runAction(ctx.settingsActions, actionNode.dataset.action, actionPayload(ctx, actionNode, event));
  });
  Object.assign(ctx, { settingsActions: buildSettingsActions(ctx) });
}
