/* dashboard.js → Event delegation (part 3)
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

export function install(ctx) {
  document.addEventListener("input", (event) => {
    const node = event.target;
    if (node.id === "order-search") {
      ctx.searchTerm = node.value;
      clearTimeout(ctx.searchTimer);
      ctx.searchTimer = setTimeout(() => {
        ctx.renderRoute();
        const next = ctx.$("#order-search");
        if (next) {
          next.focus();
          next.setSelectionRange(next.value.length, next.value.length);
        }
      }, 320);
      return;
    }
    if (node.id === "product-search") {
      ctx.productSearch = node.value;
      clearTimeout(ctx.searchTimer);
      ctx.searchTimer = setTimeout(() => {
        ctx.renderRoute();
        const next = ctx.$("#product-search");
        if (next) {
          next.focus();
          next.setSelectionRange(next.value.length, next.value.length);
        }
      }, 320);
      return;
    }
    if (node.id === "dash-search") {
      ctx.searchTerm = node.value;
      clearTimeout(ctx.searchTimer);
      ctx.searchTimer = setTimeout(() => {
        if (ctx.route === "orders" || ctx.route === "products") ctx.renderRoute();
      }, 380);
      return;
    }
    if (node.matches("[data-edit-path]")) {
      ctx.handleField(node);
      const preview = node.closest(".image-field")?.querySelector("img");
      if (preview && node.type !== "file") preview.src = node.value || "assets/img/favicon.svg";
    } else if (node.matches("[data-path]")) {
      ctx.handleField(node);
      const preview = node.closest(".image-field")?.querySelector("img");
      if (preview && node.type !== "file") preview.src = node.value || "assets/img/favicon.svg";
    }
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
      if (event.detail?.source === "catalog" && ctx.tablesMode()) {
        ctx.syncCatalogModel();
        ctx.renderRoute();
      }
    });
  }

  document.addEventListener("change", (event) => {
    const node = event.target;
    if (node.matches("[data-upload-path]")) {
      ctx.handleUpload(node);
      return;
    }
    if (node.id === "profile-avatar-upload" && node.files?.[0]) {
      const file = node.files[0];
      (async () => {
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
      })();
      return;
    }
    if (node.matches("[data-lines-path]")) {
      ctx.handleLines(node);
      return;
    }
    if (node.matches("[data-currency-mode]")) {
      ctx.R.setCurrencyMode(node.value);
      ctx.setPath(ctx.model, "settings.country.currencyMode", node.value);
      ctx.saveDraftSoon();
      ctx.toast(ctx.dt("تم تغيير العملة المعروضة", "Devise d’affichage modifiée"), "good");
      return;
    }
    if (node.dataset.blocklist != null) {
      ctx.model.settings.blocklist = node.value
        .split("\n")
        .map((line) => ctx.digits(line))
        .filter(Boolean);
      ctx.saveDraftSoon();
      return;
    }
    if (
      node.matches(
        "[data-page-section-visible], [data-home-section-visible], [data-product-active], [data-coupon-active], [data-payment-active], [data-city-active], [data-review-approved]"
      )
    ) {
      ctx.handleDirectToggle(node);
      return;
    }
    if (node.matches("[data-order-status]")) {
      ctx.handleDirectToggle(node);
      return;
    }
    if (node.matches("[data-product-filter]")) {
      if (node.dataset.productFilter === "category") ctx.productCategory = node.value;
      if (node.dataset.productFilter === "stock") ctx.productStock = node.value;
      ctx.saveDraftNow();
      ctx.renderRoute();
      return;
    }
    if (node.matches("[data-edit-path]")) {
      ctx.handleField(node);
      return;
    }
    if (node.matches("[data-path]")) {
      ctx.handleField(node);
      const pathMatch = /^collections\.(\d+)\.visible$/.exec(node.dataset.path || "");
      if (pathMatch && ctx.tablesMode()) {
        const col = ctx.model.collections[Number(pathMatch[1])];
        if (col) {
          ctx.catalogWrite(ctx.dt("تم تحديث المجموعة", "Collection mise à jour"), () => ctx.CAT.saveCollection(col));
          return;
        }
      }
      ctx.saveDraftNow();
    }
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
        const AudioContext = window.AudioContext || window.webkitAudioContext;
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
