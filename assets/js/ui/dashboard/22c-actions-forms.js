// @ts-check
/* dashboard.js → `[data-action]` click handlers (extracted verbatim from 22-events-forms.js)
   The former 114-branch switch is now an action → handler map. Handlers receive one object:
   `{ ctx, node, event, index, id }`. Every handler keeps the exact behaviour of its former `case` block,
   including the `return`s that used to leave the whole listener (they now return from the handler, which
   ends the dispatch anyway because the lookup table stops after the first matching action). */

/** Runs one action from the table. Returns true when a handler consumed it. */
export function runAction(actions, name, payload) {
  const handler = actions[name];
  if (typeof handler !== "function") return false;
  handler(payload);
  return true;
}

/** Shared arguments decoded from the clicked node. */
export function actionPayload(ctx, node, event) {
  return {
    ctx,
    node,
    event,
    index: node.dataset.index != null ? Number(node.dataset.index) : null,
    id: node.dataset.id || ""
  };
}

const ask = (ctx, ar, fr) => confirm(ctx.dt(ar, fr));

/* ---------- shell, theme, drafts, orders ---------- */

function shellActions(ctx) {
  return {
    logout: () => {
      ctx.R.addAudit(ctx.dt("تسجيل خروج", "Déconnexion"), ctx.session?.username);
      ctx.R.logout();
      ctx.renderLogin();
    },
    profile: () => {
      ctx.route = "profile";
      history.replaceState(null, "", "#profile");
      ctx.renderRoute();
    },
    "toggle-sidebar": () => ctx.$("#dash-sidebar")?.classList.toggle("open"),
    theme: ({ node }) => {
      const next = ctx.R.theme === "dark" ? "light" : "dark";
      ctx.R.setTheme(next);
      node.innerHTML = ctx.icon(next === "dark" ? "sun" : "moon");
    },
    "orders-alert": () => {
      ctx.route = "orders";
      history.replaceState(null, "", "#orders");
      ctx.orderBadgeSeen = ctx.newOrdersCount();
      localStorage.setItem("restore_orders_seen_v1", String(ctx.orderBadgeSeen));
      ctx.updateCounts();
      ctx.renderRoute();
    },
    "save-draft": () => {
      ctx.saveDraftNow();
      ctx.toast(ctx.dt("تم حفظ المسودة", "Brouillon enregistré"), "good");
    },
    preview: () => {
      if (ctx.dirty) ctx.saveDraftNow();
      window.open("index.html?preview=1", "_blank", "noopener");
    },
    publish: () => ctx.openPublishModal(),
    "confirm-publish": () => ctx.publishNow(),
    "discard-draft": () => {
      if (!ask(ctx, "إلغاء كل التغييرات غير المنشورة؟", "Annuler toutes les modifications non publiées ?")) return;
      ctx.R.discardDraft();
      ctx.model = ctx.clone(ctx.R.state);
      ctx.dirty = false;
      ctx.closeModal();
      ctx.renderRoute();
      ctx.toast(ctx.dt("تم إلغاء المسودة", "Brouillon annulé"));
    },
    "reset-demo": () => {
      if (ctx.session?.role !== "owner") {
        ctx.toast(ctx.dt("للمالك فقط", "Propriétaire uniquement"), "error");
        return;
      }
      const first = ask(
        ctx,
        "إعادة تعيين البيانات التجريبية وحذف كل الطلبات؟",
        "Réinitialiser la démo et supprimer toutes les commandes ?"
      );
      if (!first) return;
      if (ask(ctx, "تأكيد أخير: لا يمكن التراجع.", "Dernière confirmation : irréversible.")) ctx.R.resetLocalDemo();
    },
    "close-modal": () => ctx.closeModal(),
    "modal-backdrop": ({ node, event }) => {
      if (event.target === node) ctx.closeModal();
    }
  };
}

function orderActions(ctx) {
  const findOrder = (id) => ctx.R.getOrders().find((item) => item.id === id);
  return {
    "view-order": ({ id }) => ctx.viewOrderModal(id),
    "save-order": ({ id }) => {
      const order = findOrder(id);
      if (order) {
        const status = ctx.$(`.dash-modal [data-order-status="${CSS.escape(id)}"]`)?.value || order.status;
        const note = ctx.$(`.dash-modal [data-order-note="${CSS.escape(id)}"]`)?.value || "";
        ctx.R.updateOrder(id, { status, internalNote: note });
        ctx.R.addAudit(`${ctx.dt("تحديث الطلب", "Commande modifiée")} ${id}: ${status}`);
        ctx.toast(ctx.dt("تم حفظ الطلب", "Commande enregistrée"), "good");
      }
      ctx.closeModal();
      ctx.renderRoute();
    },
    "print-invoice": ({ id }) => ctx.printOrder(findOrder(id), "invoice"),
    "print-label": ({ id }) => ctx.printOrder(findOrder(id), "label"),
    "export-orders": () => ctx.exportOrdersCsv(),
    "abandoned-status": ({ node, id }) => {
      const rows = ctx.R.getAbandoned().map((item) =>
        item.id === id ? { ...item, status: node.dataset.status || "contacted", contactedAt: ctx.nowIso() } : item
      );
      localStorage.setItem("restore_abandoned_v1", JSON.stringify(rows));
      window.dispatchEvent(new CustomEvent("restore:orders"));
      ctx.renderRoute();
      ctx.toast(ctx.dt("تم تحديث السلة", "Panier mis à jour"), "good");
    },
    "delete-abandoned": ({ id }) => {
      if (!ask(ctx, "حذف السلة المتروكة؟", "Supprimer ce panier ?")) return;
      ctx.R.removeAbandoned(id);
      ctx.renderRoute();
    }
  };
}

/* ---------- catalog ---------- */

function catalogActions(ctx) {
  return {
    "add-product": () => {
      ctx.editorKind = "product";
      ctx.productEditor(null);
    },
    "edit-product": ({ index }) => {
      ctx.editorKind = "product";
      ctx.productEditor(index);
    },
    "delete-product": ({ index }) => ctx.deleteProduct(index),
    "delete-product-buffer": () => ctx.deleteProduct(null, true),
    "bulk-price": () => ctx.bulkPriceModal(),
    "apply-bulk-price": () => ctx.applyBulkPrice(),
    "add-category": () => {
      ctx.editorKind = "category";
      ctx.categoryEditor(null);
    },
    "edit-category": ({ index }) => {
      ctx.editorKind = "category";
      ctx.categoryEditor(index);
    },
    "delete-category": ({ index }) => {
      if (!ask(ctx, "حذف الفئة؟", "Supprimer la catégorie ?")) return;
      ctx.model.theme.categories.splice(index, 1);
      ctx.saveDraftNow();
      ctx.renderRoute();
    },
    "delete-category-buffer": () => {
      if (!ask(ctx, "حذف الفئة؟", "Supprimer la catégorie ?")) return;
      ctx.model.theme.categories = ctx.model.theme.categories.filter((item) => item.handle !== ctx.editBuffer.handle);
      ctx.saveDraftNow();
      ctx.closeModal();
      ctx.renderRoute();
    },
    "edit-collection": ({ index }) => ctx.collectionEditor(index),
    "save-collection": ({ index }) => {
      if (ctx.editBuffer && ctx.tablesMode()) {
        ctx
          .catalogWrite(ctx.dt("تم حفظ المجموعة في قاعدة البيانات", "Collection enregistrée en base"), () =>
            ctx.CAT.saveCollection(ctx.editBuffer)
          )
          .then((ok) => {
            if (!ok) return;
            ctx.closeModal();
            ctx.renderRoute();
          });
        return;
      }
      if (!ctx.editBuffer) return;
      ctx.model.collections[index] = ctx.editBuffer;
      ctx.saveDraftNow();
      ctx.closeModal();
      ctx.renderRoute();
      ctx.toast(ctx.dt("تم حفظ المجموعة", "Collection enregistrée"), "good");
    },
    "import-catalog": () => {
      if (!ctx.CAT?.enabled) return;
      const go = ask(
        ctx,
        "نقل المنتجات والمجموعات والكوبونات من JSON إلى الجداول العلائقية؟ (مرة واحدة)",
        "Importer produits/collections/coupons du JSON vers les tables ? (une seule fois)"
      );
      if (!go) return;
      ctx
        .catalogWrite(ctx.dt("تم نقل الكتالوج إلى الجداول", "Catalogue importé"), async () => {
          await ctx.CAT.importFromState(ctx.model);
        })
        .then((ok) => {
          if (ok) ctx.renderRoute();
        });
    }
  };
}

/* ---------- content: trust bar, navigation, footer, hero, editors ---------- */

const EDITOR_SAVERS = {
  product: "saveProductEditor",
  category: "saveCategoryEditor",
  nav: "saveNavEditor",
  hero: "saveHeroEditor",
  review: "saveReviewEditor",
  payment: "viewPaymentSave",
  city: "viewCitySave"
};

function contentActions(ctx) {
  return {
    "save-editor": () => {
      const saver = EDITOR_SAVERS[ctx.editorKind];
      if (saver) ctx[saver]();
    },
    "add-trust": () => {
      ctx.model.settings.trustBar.push({ icon: "truck", label: { ar: "", fr: "" } });
      ctx.saveDraftNow();
      ctx.renderRoute();
    },
    "remove-trust": ({ index }) => {
      ctx.model.settings.trustBar.splice(index, 1);
      ctx.saveDraftNow();
      ctx.renderRoute();
    },
    "add-nav": () => {
      ctx.editorKind = "nav";
      ctx.navEditor(null);
    },
    "edit-nav": ({ index }) => {
      ctx.editorKind = "nav";
      ctx.navEditor(index);
    },
    "delete-nav": ({ index }) => {
      if (!ask(ctx, "حذف عنصر القائمة؟", "Supprimer cet élément ?")) return;
      ctx.model.settings.navigation.splice(index, 1);
      ctx.saveDraftNow();
      ctx.renderRoute();
    },
    "delete-nav-buffer": () => {
      ctx.model.settings.navigation = ctx.model.settings.navigation.filter((item) => item.id !== ctx.editBuffer.id);
      ctx.saveDraftNow();
      ctx.closeModal();
      ctx.renderRoute();
    },
    "add-footer-column": () => {
      ctx.model.settings.footerColumns.push({ title: { ar: "روابط", fr: "Liens" }, links: [] });
      ctx.saveDraftNow();
      ctx.renderRoute();
    },
    "add-hero": () => {
      ctx.editorKind = "hero";
      ctx.heroEditor(null);
    },
    "edit-hero": ({ index }) => {
      ctx.editorKind = "hero";
      ctx.heroEditor(index);
    },
    "delete-hero": ({ index }) => {
      if (!ask(ctx, "حذف الشريحة؟", "Supprimer la diapositive ?")) return;
      ctx.model.settings.heroSlides.splice(index, 1);
      ctx.saveDraftNow();
      ctx.renderRoute();
    },
    "delete-hero-buffer": () => {
      ctx.model.settings.heroSlides = ctx.model.settings.heroSlides.filter((item) => item.id !== ctx.editBuffer.id);
      ctx.saveDraftNow();
      ctx.closeModal();
      ctx.renderRoute();
    }
  };
}

/* ---------- homepage / page sections ---------- */

/** Swaps a section with its neighbour, renumbers `order` and persists. `direction` is -1 (up) or +1 (down). */
function moveSection(ctx, listKey, id, direction) {
  const sections = [...ctx.model.settings[listKey]].sort((a, b) => a.order - b.order);
  const position = sections.findIndex((item) => item.id === id);
  const target = position + direction;
  if (position < 0 || target < 0 || target > sections.length - 1) return;
  [sections[position], sections[target]] = [sections[target], sections[position]];
  sections.forEach((section, index) => {
    section.order = index + 1;
  });
  ctx.saveDraftNow();
  ctx.renderRoute();
}

function sectionActions(ctx) {
  const move =
    (listKey) =>
    (direction) =>
    ({ id }) =>
      moveSection(ctx, listKey, id, direction);
  return {
    "page-section-up": move("pageSections")(-1),
    "page-section-down": move("pageSections")(1),
    "home-section-up": move("homeSections")(-1),
    "home-section-down": move("homeSections")(1),
    "edit-home-section": ({ id }) => ctx.homeSectionEditor(id),
    "save-home-section": ({ id }) => {
      if (!ctx.editBuffer) return;
      const index = ctx.model.settings.homeSections.findIndex((section) => section.id === id);
      if (index >= 0) ctx.model.settings.homeSections[index] = ctx.editBuffer;
      ctx.saveDraftNow();
      ctx.closeModal();
      ctx.renderRoute();
      ctx.toast(ctx.dt("تم حفظ قسم المنتجات", "Section enregistrée"), "good");
    },
    "add-home-section": () => {
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
    }
  };
}

/** The complete `[data-action]` table for the dashboard shell, orders, catalog and content routes. */
export function buildFormActions(ctx) {
  return {
    ...shellActions(ctx),
    ...orderActions(ctx),
    ...catalogActions(ctx),
    ...contentActions(ctx),
    ...sectionActions(ctx)
  };
}
