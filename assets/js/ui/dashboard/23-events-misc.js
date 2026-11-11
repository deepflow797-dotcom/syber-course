// @ts-check
/* dashboard.js → Event delegation (part 3)
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  /** Debounced route refresh that restores the caret in the search box. */
  function scheduleSearchRender(id) {
    return () => {
      ctx.renderRoute();
      const next = ctx.$(`#${id}`);
      if (!next) return;
      next.focus();
      next.setSelectionRange(next.value.length, next.value.length);
    };
  }

  /** Restarts the search debounce timer; returns the typed value. */
  function scheduleSearch(value, delay, after) {
    clearTimeout(ctx.searchTimer);
    ctx.searchTimer = setTimeout(after, delay);
    return value;
  }

  /** Live preview of an image field while the owner types a URL. */
  function previewImage(node) {
    const preview = node.closest(".image-field")?.querySelector("img");
    if (preview && node.type !== "file") preview.src = node.value || "assets/img/favicon.svg";
  }

  const INPUT_HANDLERS = [
    {
      match: (node) => node.id === "order-search",
      run: (node) => {
        ctx.searchTerm = scheduleSearch(node.value, 320, scheduleSearchRender("order-search"));
      }
    },
    {
      match: (node) => node.id === "product-search",
      run: (node) => {
        ctx.productSearch = scheduleSearch(node.value, 320, scheduleSearchRender("product-search"));
      }
    },
    {
      match: (node) => node.id === "dash-search",
      run: (node) => {
        ctx.searchTerm = scheduleSearch(node.value, 380, () => {
          if (ctx.route === "orders" || ctx.route === "products") ctx.renderRoute();
        });
      }
    },
    {
      match: (node) => node.matches("[data-edit-path]") || node.matches("[data-path]"),
      run: (node) => {
        ctx.handleField(node);
        previewImage(node);
      }
    }
  ];

  document.addEventListener("input", (event) => {
    const node = event.target;
    const handler = INPUT_HANDLERS.find((entry) => entry.match(node));
    if (handler) handler.run(node);
  });

  if (ctx.CAT?.enabled) {
    ctx.CAT.reload()
      .then(() => {
        if (ctx.tablesMode()) {
          ctx.syncCatalogModel();
          ctx.renderRoute();
        }
      })
      .catch(() => {});
    window.addEventListener("restore:changed", (event) => {
      if (/** @type {CustomEvent} */ (event).detail?.source === "catalog" && ctx.tablesMode()) {
        ctx.syncCatalogModel();
        ctx.renderRoute();
      }
    });
  }

  /** Uploads the manager avatar: resize → upload (or data URL fallback) → session + audit. */
  async function updateAvatar(node) {
    const file = node.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await ctx.R.resizeImage(file, 256, 0.85);
      const publicUrl = await ctx.R.uploadMedia(dataUrl);
      const url = publicUrl || dataUrl;
      ctx.R.updateManager(ctx.session.id, { avatar: url });
      ctx.model = ctx.clone(ctx.R.state);
      ctx.session = ctx.R.currentSession();
      localStorage.setItem("restore_session_v1", JSON.stringify(ctx.session));
      ctx.R.addAudit(`${ctx.dt("تحديث الصورة الرمزية", "Avatar mis à jour")}`);
      ctx.toast(ctx.dt("تم تحديث الصورة", "Image mise à jour"), "good");
      ctx.renderRoute();
    } catch (error) {
      ctx.toast(error.message, "error");
    }
  }

  const TOGGLE_SELECTOR =
    "[data-page-section-visible], [data-home-section-visible], [data-product-active], [data-coupon-active], [data-payment-active], [data-city-active], [data-review-approved]";

  /** Change handlers, tested in order; the first match consumes the event. */
  const CHANGE_HANDLERS = [
    { match: (node) => node.matches("[data-upload-path]"), run: (node) => ctx.handleUpload(node) },
    { match: (node) => node.id === "profile-avatar-upload", run: (node) => updateAvatar(node) },
    { match: (node) => node.matches("[data-lines-path]"), run: (node) => ctx.handleLines(node) },
    {
      match: (node) => node.matches("[data-currency-mode]"),
      run: (node) => {
        ctx.R.setCurrencyMode(node.value);
        ctx.setPath(ctx.model, "settings.country.currencyMode", node.value);
        ctx.saveDraftSoon();
        ctx.toast(ctx.dt("تم تغيير العملة المعروضة", "Devise d’affichage modifiée"), "good");
      }
    },
    {
      match: (node) => node.dataset.blocklist != null,
      run: (node) => {
        ctx.model.settings.blocklist = node.value
          .split("\n")
          .map((line) => ctx.digits(line))
          .filter(Boolean);
        ctx.saveDraftSoon();
      }
    },
    { match: (node) => node.matches(TOGGLE_SELECTOR), run: (node) => ctx.handleDirectToggle(node) },
    { match: (node) => node.matches("[data-order-status]"), run: (node) => ctx.handleDirectToggle(node) },
    {
      match: (node) => node.matches("[data-product-filter]"),
      run: (node) => {
        if (node.dataset.productFilter === "category") ctx.productCategory = node.value;
        if (node.dataset.productFilter === "stock") ctx.productStock = node.value;
        ctx.saveDraftNow();
        ctx.renderRoute();
      }
    },
    { match: (node) => node.matches("[data-edit-path]"), run: (node) => ctx.handleField(node) },
    { match: (node) => node.matches("[data-path]"), run: (node) => handlePathChange(node) }
  ];

  /** `[data-path]` fields also push collection visibility straight to the catalog tables. */
  function handlePathChange(node) {
    ctx.handleField(node);
    const pathMatch = /^collections\.(\d+)\.visible$/.exec(node.dataset.path || "");
    if (pathMatch && ctx.tablesMode()) {
      const collection = ctx.model.collections[Number(pathMatch[1])];
      if (collection) {
        ctx.catalogWrite(ctx.dt("تم تحديث المجموعة", "Collection mise à jour"), () =>
          ctx.CAT.saveCollection(collection)
        );
        return;
      }
    }
    ctx.saveDraftNow();
  }

  document.addEventListener("change", (event) => {
    const node = event.target;
    const handler = CHANGE_HANDLERS.find((entry) => entry.match(node));
    if (handler) handler.run(node);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && ctx.modalRoot.innerHTML) ctx.closeModal();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      ctx.saveDraftNow();
      ctx.toast(ctx.dt("تم حفظ المسودة", "Brouillon enregistré"), "good");
    }
  });

  window.addEventListener("hashchange", () => {
    const next = (location.hash || "#overview").slice(1);
    if (ctx.ROUTE_TITLES[next] && next !== ctx.route) {
      ctx.route = next;
      if (ctx.session) ctx.renderRoute();
    }
  });

  window.addEventListener("restore:orders", () => {
    const count = ctx.newOrdersCount();
    ctx.updateCounts();
    if (count > ctx.lastOrderCount) {
      ctx.toast(ctx.dt("طلب جديد وصل من المتجر", "Nouvelle commande reçue"), "good");
      try {
        const AudioContext = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
        if (AudioContext) {
          const context = new AudioContext();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.frequency.value = 880;
          gain.gain.value = 0.03;
          oscillator.start();
          oscillator.stop(context.currentTime + 0.16);
        }
      } catch {}
      if (ctx.route === "orders" || ctx.route === "overview") ctx.renderRoute();
    }
    ctx.lastOrderCount = count;
  });

  window.addEventListener("restore:changed", () => {
    if (!ctx.dirty) {
      ctx.model = ctx.clone(ctx.R.state);
      if (ctx.session) ctx.renderRoute();
    }
  });

  window.addEventListener("restore:reviews", () => {
    if (ctx.session && ctx.route === "reviews") ctx.renderRoute();
  });

  window.addEventListener("restore:orders", () => {
    if (ctx.session && (ctx.route === "orders" || ctx.route === "overview" || ctx.route === "reports"))
      ctx.updateCounts();
  });

  window.addEventListener("beforeunload", () => {
    if (ctx.dirty) {
      try {
        ctx.R.saveDraft(ctx.model);
      } catch {}
    }
  });
}
