// @ts-check
/* app.js → Search
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { mountSearch, openSearch, closeSearch });
  function mountSearch() {
    if (document.getElementById("search-overlay")) return;
    const el = document.createElement("div");
    el.innerHTML = `
      <div class="search-overlay" id="search-overlay">
        <div class="search-panel" role="dialog" aria-label="${ctx.esc(ctx.t("search"))}">
          <div class="container">
            <div class="search-panel-head">
              <input id="search-input" type="search" placeholder="${ctx.esc(ctx.t("searchPlaceholder"))}" autocomplete="off">
              <button class="search-close" type="button" data-close-search aria-label="${ctx.esc(ctx.t("close"))}">${ctx.ICON.close}</button>
            </div>
            <div class="search-hint" id="search-hint">${ctx.esc(ctx.t("popular"))}</div>
            <div class="search-results" id="search-results"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(el);
    const overlay = document.getElementById("search-overlay");
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeSearch();
    });
    overlay.querySelector("[data-close-search]").addEventListener("click", closeSearch);
    const searchInput = /** @type {HTMLInputElement} */ (overlay.querySelector("#search-input"));
    searchInput.addEventListener("input", () => ctx.runSearch(searchInput.value));
    searchInput.addEventListener("keydown", (event) => {
      const e = /** @type {KeyboardEvent} */ (event);
      if (e.key === "Enter") {
        e.preventDefault();
        const q = searchInput.value.trim();
        if (!q) return;
        closeSearch();
        location.href = `collection.html?q=${encodeURIComponent(q)}`;
      }
    });
    ctx.runSearch("");
  }

  function openSearch(q = "") {
    mountSearch();
    const overlay = document.getElementById("search-overlay");
    overlay.classList.add("open");
    document.body.classList.add("no-scroll");
    const input = /** @type {HTMLInputElement} */ (document.getElementById("search-input"));
    input.value = q;
    setTimeout(() => input.focus(), 40);
    ctx.runSearch(q);
  }

  function closeSearch() {
    document.getElementById("search-overlay")?.classList.remove("open");
    document.body.classList.remove("no-scroll");
  }
}
