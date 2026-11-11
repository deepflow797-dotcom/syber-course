// @ts-check
/* state.js → Currency display
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */

export function install(ctx) {
  Object.assign(ctx, { getCurrencyMode, setCurrencyMode, formatCurrency });
  const LS_CURRENCY_MODE = "restore_currency_mode_v1";
  ctx.currencyMode = localStorage.getItem(LS_CURRENCY_MODE) || ctx.state.settings.country?.currencyMode || "new";
  if (ctx.currencyMode !== "old" && ctx.currencyMode !== "new") ctx.currencyMode = "new";

  function getCurrencyMode() {
    return ctx.currencyMode;
  }
  function setCurrencyMode(mode) {
    if (mode !== "old" && mode !== "new") return;
    ctx.currencyMode = mode;
    localStorage.setItem(LS_CURRENCY_MODE, mode);
    window.dispatchEvent(new CustomEvent("restore:currencyMode", { detail: mode }));
    window.dispatchEvent(new CustomEvent("restore:changed", { detail: { source: "currency" } }));
  }
  function formatCurrency(amount) {
    const multiplier = ctx.currencyMode === "old" ? 10 : 1;
    const value = Math.max(0, Number(amount) || 0) * multiplier;
    const formatted = new Intl.NumberFormat(ctx.lang === "ar" ? "en-US" : "fr-FR", { maximumFractionDigits: 0 }).format(
      Math.round(value)
    );
    if (ctx.lang === "ar") return `${formatted} ${ctx.currencyMode === "old" ? "أوقية قديمة" : "أوقية"}`;
    return `${formatted} ${ctx.currencyMode === "old" ? "MRO" : "MRU"}`;
  }
  Object.assign(ctx, { LS_CURRENCY_MODE });
}
