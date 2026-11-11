/* dashboard.js → Event delegation (part 2a: shell, orders, catalog, content, homepage) — part 2b in 22b-events-settings.js
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

export function install(ctx) {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-route]");
    if (link) {
      event.preventDefault();
      ctx.route = link.dataset.route;
      if (location.hash !== `#${ctx.route}`) history.replaceState(null, "", `#${ctx.route}`);
      ctx.$("#dash-sidebar")?.classList.remove("open");
      ctx.renderRoute();
      return;
    }
    const langButton = event.target.closest("[data-dash-lang]");
    if (langButton) {
      ctx.dashLang = langButton.dataset.dashLang === "fr" ? "fr" : "ar";
      localStorage.setItem(ctx.LS_DASH_LANG, ctx.dashLang);
      document.documentElement.lang = ctx.dashLang;
      document.documentElement.dir = ctx.dashLang === "ar" ? "rtl" : "ltr";
      if (ctx.session?.mustChange) ctx.renderPasswordChange();
      else if (ctx.session) ctx.renderShell();
      else ctx.renderLogin();
      return;
    }
    const tab = event.target.closest("[data-dash-tab]");
    if (tab) {
      const tabs = tab.parentElement;
      tabs.querySelectorAll("[data-dash-tab]").forEach((item) => item.classList.toggle("active", item === tab));
      const container = tabs.parentElement;
      container
        .querySelectorAll("[data-dash-panel]")
        .forEach((panel) => panel.classList.toggle("active", panel.dataset.dashPanel === tab.dataset.dashTab));
      return;
    }
    const filterButton = event.target.closest("[data-order-filter]");
    if (filterButton) {
      ctx.orderFilter = filterButton.dataset.orderFilter;
      ctx.renderRoute();
      return;
    }
    const abandonedButton = event.target.closest("[data-abandoned-filter]");
    if (abandonedButton) {
      ctx.abandonedFilter = abandonedButton.dataset.abandonedFilter;
      ctx.renderRoute();
      return;
    }
    const reportButton = event.target.closest("[data-report-range]");
    if (reportButton) {
      ctx.reportRange = reportButton.dataset.reportRange;
      ctx.renderRoute();
      return;
    }
    const productFilter = event.target.closest("[data-product-filter]");
    if (productFilter) {
      /* handled in change */
    }

    const actionNode = event.target.closest("[data-action]");
    if (!actionNode) return;
    const action = actionNode.dataset.action;
    const index = actionNode.dataset.index != null ? Number(actionNode.dataset.index) : null;
    const id = actionNode.dataset.id || "";

    switch (action) {
      case "logout":
        ctx.R.addAudit(ctx.dt("تسجيل خروج", "Déconnexion"), ctx.session?.username);
        ctx.R.logout();
        ctx.renderLogin();
        break;
      case "profile":
        ctx.route = "profile";
        history.replaceState(null, "", "#profile");
        ctx.renderRoute();
        break;
      case "toggle-sidebar":
        ctx.$("#dash-sidebar")?.classList.toggle("open");
        break;
      case "theme": {
        const next = ctx.R.theme === "dark" ? "light" : "dark";
        ctx.R.setTheme(next);
        actionNode.innerHTML = ctx.icon(next === "dark" ? "sun" : "moon");
        break;
      }
      case "orders-alert":
        ctx.route = "orders";
        history.replaceState(null, "", "#orders");
        ctx.orderBadgeSeen = ctx.newOrdersCount();
        localStorage.setItem("restore_orders_seen_v1", String(ctx.orderBadgeSeen));
        ctx.updateCounts();
        ctx.renderRoute();
        break;
      case "save-draft":
        ctx.saveDraftNow();
        ctx.toast(ctx.dt("تم حفظ المسودة", "Brouillon enregistré"), "good");
        break;
      case "preview":
        if (ctx.dirty) ctx.saveDraftNow();
        window.open("index.html?preview=1", "_blank", "noopener");
        break;
      case "publish":
        ctx.openPublishModal();
        break;
      case "confirm-publish":
        ctx.publishNow();
        break;
      case "discard-draft":
        if (confirm(ctx.dt("إلغاء كل التغييرات غير المنشورة؟", "Annuler toutes les modifications non publiées ?"))) {
          ctx.R.discardDraft();
          ctx.model = ctx.clone(ctx.R.state);
          ctx.dirty = false;
          ctx.closeModal();
          ctx.renderRoute();
          ctx.toast(ctx.dt("تم إلغاء المسودة", "Brouillon annulé"));
        }
        break;
      case "reset-demo":
        if (ctx.session?.role !== "owner") {
          ctx.toast(ctx.dt("للمالك فقط", "Propriétaire uniquement"), "error");
          break;
        }
        if (
          confirm(
            ctx.dt(
              "إعادة تعيين البيانات التجريبية وحذف كل الطلبات؟",
              "Réinitialiser la démo et supprimer toutes les commandes ?"
            )
          )
        ) {
          if (confirm(ctx.dt("تأكيد أخير: لا يمكن التراجع.", "Dernière confirmation : irréversible.")))
            ctx.R.resetLocalDemo();
        }
        break;
      case "close-modal":
        ctx.closeModal();
        break;
      case "modal-backdrop":
        if (event.target === actionNode) ctx.closeModal();
        break;
      case "view-order":
        ctx.viewOrderModal(id);
        break;
      case "save-order": {
        const order = ctx.R.getOrders().find((item) => item.id === id);
        if (order) {
          const status = ctx.$(`.dash-modal [data-order-status="${CSS.escape(id)}"]`)?.value || order.status;
          const note = ctx.$(`.dash-modal [data-order-note="${CSS.escape(id)}"]`)?.value || "";
          ctx.R.updateOrder(id, { status, internalNote: note });
          ctx.R.addAudit(`${ctx.dt("تحديث الطلب", "Commande modifiée")} ${id}: ${status}`);
          ctx.toast(ctx.dt("تم حفظ الطلب", "Commande enregistrée"), "good");
        }
        ctx.closeModal();
        ctx.renderRoute();
        break;
      }
      case "print-invoice":
        ctx.printOrder(
          ctx.R.getOrders().find((order) => order.id === id),
          "invoice"
        );
        break;
      case "print-label":
        ctx.printOrder(
          ctx.R.getOrders().find((order) => order.id === id),
          "label"
        );
        break;
      case "export-orders":
        ctx.exportOrdersCsv();
        break;
      case "abandoned-status": {
        const rows = ctx.R.getAbandoned().map((item) =>
          item.id === id
            ? { ...item, status: actionNode.dataset.status || "contacted", contactedAt: ctx.nowIso() }
            : item
        );
        localStorage.setItem("restore_abandoned_v1", JSON.stringify(rows));
        window.dispatchEvent(new CustomEvent("restore:orders"));
        ctx.renderRoute();
        ctx.toast(ctx.dt("تم تحديث السلة", "Panier mis à jour"), "good");
        break;
      }
      case "delete-abandoned":
        if (confirm(ctx.dt("حذف السلة المتروكة؟", "Supprimer ce panier ?"))) {
          ctx.R.removeAbandoned(id);
          ctx.renderRoute();
        }
        break;
      case "add-product":
        ctx.editorKind = "product";
        ctx.productEditor(null);
        break;
      case "edit-product":
        ctx.editorKind = "product";
        ctx.productEditor(index);
        break;
      case "delete-product":
        ctx.deleteProduct(index);
        break;
      case "delete-product-buffer":
        ctx.deleteProduct(null, true);
        break;
      case "bulk-price":
        ctx.bulkPriceModal();
        break;
      case "apply-bulk-price":
        ctx.applyBulkPrice();
        break;
      case "save-editor":
        if (ctx.editorKind === "product") ctx.saveProductEditor();
        else if (ctx.editorKind === "category") ctx.saveCategoryEditor();
        else if (ctx.editorKind === "nav") ctx.saveNavEditor();
        else if (ctx.editorKind === "hero") ctx.saveHeroEditor();
        else if (ctx.editorKind === "review") ctx.saveReviewEditor();
        else if (ctx.editorKind === "payment") ctx.viewPaymentSave();
        else if (ctx.editorKind === "city") ctx.viewCitySave();
        break;
      case "add-category":
        ctx.editorKind = "category";
        ctx.categoryEditor(null);
        break;
      case "edit-category":
        ctx.editorKind = "category";
        ctx.categoryEditor(index);
        break;
      case "delete-category":
        if (confirm(ctx.dt("حذف الفئة؟", "Supprimer la catégorie ?"))) {
          ctx.model.theme.categories.splice(index, 1);
          ctx.saveDraftNow();
          ctx.renderRoute();
        }
        break;
      case "delete-category-buffer":
        if (confirm(ctx.dt("حذف الفئة؟", "Supprimer la catégorie ?"))) {
          ctx.model.theme.categories = ctx.model.theme.categories.filter(
            (item) => item.handle !== ctx.editBuffer.handle
          );
          ctx.saveDraftNow();
          ctx.closeModal();
          ctx.renderRoute();
        }
        break;
      case "edit-collection":
        ctx.collectionEditor(index);
        break;
      case "save-collection":
        if (ctx.editBuffer && ctx.tablesMode()) {
          ctx
            .catalogWrite(ctx.dt("تم حفظ المجموعة في قاعدة البيانات", "Collection enregistrée en base"), () =>
              ctx.CAT.saveCollection(ctx.editBuffer)
            )
            .then((ok) => {
              if (ok) {
                ctx.closeModal();
                ctx.renderRoute();
              }
            });
          break;
        }
        if (ctx.editBuffer) {
          ctx.model.collections[index] = ctx.editBuffer;
          ctx.saveDraftNow();
          ctx.closeModal();
          ctx.renderRoute();
          ctx.toast(ctx.dt("تم حفظ المجموعة", "Collection enregistrée"), "good");
        }
        break;
      case "import-catalog":
        if (!ctx.CAT?.enabled) break;
        if (
          !confirm(
            ctx.dt(
              "نقل المنتجات والمجموعات والكوبونات من JSON إلى الجداول العلائقية؟ (مرة واحدة)",
              "Importer produits/collections/coupons du JSON vers les tables ? (une seule fois)"
            )
          )
        )
          break;
        ctx
          .catalogWrite(ctx.dt("تم نقل الكتالوج إلى الجداول", "Catalogue importé"), async () => {
            await ctx.CAT.importFromState(ctx.model);
          })
          .then((ok) => {
            if (ok) ctx.renderRoute();
          });
        break;
      case "add-trust":
        ctx.model.settings.trustBar.push({ icon: "truck", label: { ar: "", fr: "" } });
        ctx.saveDraftNow();
        ctx.renderRoute();
        break;
      case "remove-trust":
        ctx.model.settings.trustBar.splice(index, 1);
        ctx.saveDraftNow();
        ctx.renderRoute();
        break;
      case "add-nav":
        ctx.editorKind = "nav";
        ctx.navEditor(null);
        break;
      case "edit-nav":
        ctx.editorKind = "nav";
        ctx.navEditor(index);
        break;
      case "delete-nav":
        if (confirm(ctx.dt("حذف عنصر القائمة؟", "Supprimer cet élément ?"))) {
          ctx.model.settings.navigation.splice(index, 1);
          ctx.saveDraftNow();
          ctx.renderRoute();
        }
        break;
      case "delete-nav-buffer":
        ctx.model.settings.navigation = ctx.model.settings.navigation.filter((item) => item.id !== ctx.editBuffer.id);
        ctx.saveDraftNow();
        ctx.closeModal();
        ctx.renderRoute();
        break;
      case "add-footer-column":
        ctx.model.settings.footerColumns.push({ title: { ar: "روابط", fr: "Liens" }, links: [] });
        ctx.saveDraftNow();
        ctx.renderRoute();
        break;
      case "add-hero":
        ctx.editorKind = "hero";
        ctx.heroEditor(null);
        break;
      case "edit-hero":
        ctx.editorKind = "hero";
        ctx.heroEditor(index);
        break;
      case "delete-hero":
        if (confirm(ctx.dt("حذف الشريحة؟", "Supprimer la diapositive ?"))) {
          ctx.model.settings.heroSlides.splice(index, 1);
          ctx.saveDraftNow();
          ctx.renderRoute();
        }
        break;
      case "delete-hero-buffer":
        ctx.model.settings.heroSlides = ctx.model.settings.heroSlides.filter((item) => item.id !== ctx.editBuffer.id);
        ctx.saveDraftNow();
        ctx.closeModal();
        ctx.renderRoute();
        break;
      case "page-section-up": {
        const sections = [...ctx.model.settings.pageSections].sort((a, b) => a.order - b.order);
        const index = sections.findIndex((item) => item.id === id);
        if (index > 0) {
          [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]];
          sections.forEach((section, position) => {
            section.order = position + 1;
          });
          ctx.saveDraftNow();
          ctx.renderRoute();
        }
        break;
      }
      case "page-section-down": {
        const sections = [...ctx.model.settings.pageSections].sort((a, b) => a.order - b.order);
        const index = sections.findIndex((item) => item.id === id);
        if (index >= 0 && index < sections.length - 1) {
          [sections[index + 1], sections[index]] = [sections[index], sections[index + 1]];
          sections.forEach((section, position) => {
            section.order = position + 1;
          });
          ctx.saveDraftNow();
          ctx.renderRoute();
        }
        break;
      }
      case "home-section-up": {
        const sections = [...ctx.model.settings.homeSections].sort((a, b) => a.order - b.order);
        const index = sections.findIndex((item) => item.id === id);
        if (index > 0) {
          [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]];
          sections.forEach((section, position) => {
            section.order = position + 1;
          });
          ctx.saveDraftNow();
          ctx.renderRoute();
        }
        break;
      }
      case "home-section-down": {
        const sections = [...ctx.model.settings.homeSections].sort((a, b) => a.order - b.order);
        const index = sections.findIndex((item) => item.id === id);
        if (index >= 0 && index < sections.length - 1) {
          [sections[index + 1], sections[index]] = [sections[index], sections[index + 1]];
          sections.forEach((section, position) => {
            section.order = position + 1;
          });
          ctx.saveDraftNow();
          ctx.renderRoute();
        }
        break;
      }
      case "edit-home-section":
        ctx.homeSectionEditor(id);
        break;
      case "save-home-section": {
        if (!ctx.editBuffer) return;
        const index = ctx.model.settings.homeSections.findIndex((section) => section.id === id);
        if (index >= 0) ctx.model.settings.homeSections[index] = ctx.editBuffer;
        ctx.saveDraftNow();
        ctx.closeModal();
        ctx.renderRoute();
        ctx.toast(ctx.dt("تم حفظ قسم المنتجات", "Section enregistrée"), "good");
        break;
      }
      case "add-home-section": {
        const collection = ctx.model.collections[0]?.handle || "all";
        ctx.model.settings.homeSections.push({
          id: `section-${Date.now().toString(36)}`,
          visible: true,
          order: ctx.model.settings.homeSections.length + 1,
          title: { ar: "منتجات مختارة", fr: "Produits sélectionnés" },
          collection,
          layout: "left",
          promo: "",
          flame: false
        });
        ctx.saveDraftNow();
        ctx.renderRoute();
        break;
      }
      default:
        break;
    }
  });
}
