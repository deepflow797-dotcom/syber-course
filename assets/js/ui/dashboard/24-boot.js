// @ts-check
/* dashboard.js → Boot
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { boot });
  function boot() {
    if (!ctx.session) {
      ctx.renderLogin();
      return;
    }
    if (ctx.session.mustChange) {
      ctx.renderPasswordChange();
      return;
    }
    ctx.renderShell();
    if (ctx.R.remote) {
      ctx.R.loadRemoteState()
        .then((updated) => {
          if (updated && !ctx.dirty) {
            ctx.model = ctx.clone(ctx.R.state);
            ctx.renderRoute();
          }
        })
        .catch(() => {});
    }
  }
  boot();
}
