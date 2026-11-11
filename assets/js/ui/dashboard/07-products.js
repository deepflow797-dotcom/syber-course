/* dashboard.js → Products
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

export function install(ctx) {
  Object.assign(ctx, {
    filteredProducts,
    viewProducts,
    productEditor,
    saveProductEditor,
    bulkPriceModal,
    applyBulkPrice,
    deleteProduct
  });
  function filteredProducts() {
    const needle = ctx.R.normalizeText(ctx.productSearch);
    return ctx.productList().filter((product) => {
      if (ctx.productCategory !== "all" && !(product.collections || []).includes(ctx.productCategory)) return false;
      if (ctx.productStock === "low" && Number(product.stock) > Number(ctx.model.settings.lowStockThreshold || 2))
        return false;
      if (ctx.productStock === "out" && Number(product.stock) > 0) return false;
      if (!needle) return true;
      return ctx.R.normalizeText(
        [product.title, product.handle, product.vendor, product.type, product.sku].join(" ")
      ).includes(needle);
    });
  }

  function viewProducts() {
    const list = filteredProducts();
    const shown = list.slice(0, 80);
    return `${ctx.catalogBanner()}
      <div class="dash-view-head">
        <div><h2>${ctx.dt("المنتجات", "Produits")}</h2><p>${list.length} ${ctx.dt("منتج في المخزون", "produits en stock")} · ${ctx.lowStockProducts().length} ${ctx.dt("بحاجة لتعبئة", "à réapprovisionner")}</p></div>
        <div class="dash-view-actions"><button class="btn btn-soft" data-action="bulk-price">${ctx.icon("edit")} ${ctx.dt("تعديل أسعار جماعي", "Prix groupés")}</button><button class="btn btn-primary" data-action="add-product">${ctx.icon("plus")} ${ctx.dt("منتج جديد", "Nouveau produit")}</button></div>
      </div>
      <div class="dash-toolbar">
        <label class="field" style="min-width:210px"><input id="product-search" placeholder="${ctx.dt("بحث عن منتج...", "Rechercher un produit...")}" value="${ctx.esc(ctx.productSearch)}"></label>
        <label class="field"><select data-product-filter="category"><option value="all">${ctx.dt("كل الفئات", "Toutes catégories")}</option>${ctx.model.collections.map((collection) => `<option value="${ctx.esc(collection.handle)}" ${ctx.productCategory === collection.handle ? "selected" : ""}>${ctx.esc(ctx.lng(collection.title))}</option>`).join("")}</select></label>
        <label class="field"><select data-product-filter="stock"><option value="all">${ctx.dt("كل المخزون", "Tout le stock")}</option><option value="low" ${ctx.productStock === "low" ? "selected" : ""}>${ctx.dt("مخزون منخفض", "Stock faible")}</option><option value="out" ${ctx.productStock === "out" ? "selected" : ""}>${ctx.dt("نفد المخزون", "Épuisé")}</option></select></label>
        <div class="spacer"></div>
        <span class="badge-soft">${shown.length}/${list.length}</span>
        ${ctx.directToggle(ctx.dt("إخفاء المنتجات المنتهية من المتجر", "Masquer les produits épuisés"), "settings.autoHideOutOfStock", ctx.model.settings.autoHideOutOfStock)}
      </div>
      <div class="dash-card">
        ${
          shown.length
            ? `<div class="dash-table-wrap"><table class="dash-table"><thead><tr><th>${ctx.dt("المنتج", "Produit")}</th><th>${ctx.dt("SKU", "SKU")}</th><th>${ctx.dt("الفئة", "Catégorie")}</th><th>${ctx.dt("السعر", "Prix")}</th><th>${ctx.dt("المخزون", "Stock")}</th><th>${ctx.dt("الحالة", "Statut")}</th><th>${ctx.dt("المتجر", "Boutique")}</th><th></th></tr></thead><tbody>
          ${shown
            .map((product) => {
              const productIndex = ctx.model.products.indexOf(product);
              const category = ctx.model.collections.find((collection) =>
                (product.collections || []).includes(collection.handle)
              );
              const isLow = Number(product.stock) <= Number(ctx.model.settings.lowStockThreshold || 2);
              return `<tr>
              <td><div class="cell-main"><img src="${ctx.esc(product.image)}" alt=""><div><strong>${ctx.esc(product.title)}</strong><small>${ctx.esc(product.type || "")} · ${ctx.esc(product.condition || "")}</small></div></div></td>
              <td style="direction:ltr">${ctx.esc(product.sku || product.handle)}</td>
              <td>${ctx.esc(category ? ctx.lng(category.title) : product.collections?.[0] || "—")}</td>
              <td class="price">${ctx.money(product.price)}${product.compare > product.price ? `<br><small style="text-decoration:line-through;color:var(--soft-muted)">${ctx.money(product.compare)}</small>` : ""}</td>
              <td><div style="display:flex;flex-direction:column;gap:3px"><strong style="font-size:9px;color:${Number(product.stock) <= 0 ? "var(--danger)" : isLow ? "#e67e22" : "inherit"}">${product.stock}</strong><div class="mini-bar" style="--bar:${isLow ? "#e67e22" : "#25a55f"};min-width:50px"><i style="width:${Math.min(100, Math.max(3, (Number(product.stock) / 20) * 100))}%"></i></div></div></td>
              <td><span class="badge-soft ${product.active !== false ? "green" : ""}">${product.active !== false ? ctx.dt("نشط", "Actif") : ctx.dt("مخفي", "Masqué")}</span></td>
              <td><label class="toggle"><input type="checkbox" data-product-active="${productIndex}" ${product.active !== false ? "checked" : ""}><span></span></label></td>
              <td><div class="cell-actions"><button class="btn btn-sm btn-soft" data-action="edit-product" data-index="${productIndex}">${ctx.icon("edit")}</button><button class="btn btn-sm btn-soft" data-action="delete-product" data-index="${productIndex}">${ctx.icon("trash")}</button></div></td>
            </tr>`;
            })
            .join("")}</tbody></table></div>`
            : `<div class="table-empty">${ctx.icon("products")}<p>${ctx.dt("لا توجد منتجات مطابقة.", "Aucun produit correspondant.")}</p></div>`
        }
      </div>`;
  }

  function productEditor(index) {
    const isNew = index == null;
    const buffer = isNew
      ? {
          handle: `restore-${Date.now().toString(36)}`,
          title: { ar: "منتج جديد", fr: "Nouveau produit" },
          vendor: "",
          type: "Smartphone",
          condition: "Good",
          price: 0,
          compare: 0,
          stock: 1,
          battery: 90,
          active: true,
          image: "assets/products/smartphone-pro-128.svg",
          images: ["assets/products/smartphone-pro-128.svg"],
          description: { ar: "", fr: "" },
          includes: [],
          specs: {},
          colors: [],
          colorImages: {},
          variants: [],
          collections: [],
          sku: "",
          warrantyMonths: 12
        }
      : ctx.clone(ctx.model.products[index]);
    ctx.editBuffer = buffer;
    const categoryOptions = ctx.model.collections
      .map(
        (collection) =>
          `<option value="${ctx.esc(collection.handle)}" ${buffer.collections?.includes(collection.handle) ? "selected" : ""}>${ctx.esc(ctx.lng(collection.title))}</option>`
      )
      .join("");
    ctx.openModal(
      isNew ? ctx.dt("منتج جديد", "Nouveau produit") : buffer.title?.ar || buffer.title,
      `
      <div class="dash-tabs"><button class="active" type="button">${ctx.dt("المعلومات", "Informations")}</button><button type="button" data-product-tab="media">${ctx.dt("الصور والألوان", "Images & couleurs")}</button><button type="button" data-product-tab="specs">${ctx.dt("المواصفات", "Spécifications")}</button></div>
      <div class="dash-panel active" data-product-panel="main">
        <div class="form-grid">
          ${ctx.editBi(ctx.dt("اسم المنتج", "Nom du produit"), "title", buffer.title)}
          <div class="field"><label>${ctx.dt("المعرف", "Identifiant")}</label><input data-edit-path="handle" value="${ctx.esc(buffer.handle)}" dir="ltr" ${isNew ? "" : "readonly"}></div>
          <div class="field"><label>${ctx.dt("الفئة", "Catégorie")}</label><select data-edit-path="collections.0"><option value="">—</option>${categoryOptions}</select></div>
          <div class="field"><label>Vendor</label><input data-edit-path="vendor" value="${ctx.esc(buffer.vendor)}"></div>
          <div class="field"><label>${ctx.dt("النوع", "Type")}</label><select data-edit-path="type">${["Smartphone", "Macbook", "Laptop", "Tablets", "Apple Watch", "Playstation", "Accessories"].map((type) => `<option ${buffer.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></div>
          <div class="field"><label>${ctx.dt("الحالة", "État")}</label><select data-edit-path="condition">${["Like New", "Excellent", "Very Good", "Good", "Fair", "New"].map((condition) => `<option ${buffer.condition === condition ? "selected" : ""}>${condition}</option>`).join("")}</select></div>
          <div class="field"><label>${ctx.dt("السعر (MRU)", "Prix (MRU)")}</label><input type="number" data-edit-path="price" value="${ctx.esc(buffer.price)}"></div>
          <div class="field"><label>${ctx.dt("السعر قبل الخصم", "Prix barré")}</label><input type="number" data-edit-path="compare" value="${ctx.esc(buffer.compare)}"></div>
          <div class="field"><label>${ctx.dt("المخزون", "Stock")}</label><input type="number" data-edit-path="stock" value="${ctx.esc(buffer.stock)}"></div>
          <div class="field"><label>${ctx.dt("صحة البطارية %", "Santé batterie %")}</label><input type="number" data-edit-path="battery" value="${ctx.esc(buffer.battery)}"></div>
          <div class="field"><label>${ctx.dt("الضمان (أشهر)", "Garantie (mois)")}</label><input type="number" data-edit-path="warrantyMonths" value="${ctx.esc(buffer.warrantyMonths || 12)}"></div>
          <div class="field"><label>SKU</label><input data-edit-path="sku" value="${ctx.esc(buffer.sku || "")}"></div>
          ${ctx.editBi(ctx.dt("الوصف", "Description"), "description", buffer.description, { type: "textarea", rows: 4 })}
          <div class="span-2">${ctx.editToggle(ctx.dt("إظهار المنتج في المتجر", "Afficher dans la boutique"), "active", buffer.active !== false)}</div>
        </div>
      </div>
      <div class="dash-panel" data-product-panel="media">
        <div class="form-grid">
          ${ctx.imageEditor(ctx.dt("الصورة الرئيسية", "Image principale"), "image", buffer.image)}
          <div class="field span-2"><label>${ctx.dt("صور إضافية (رابط في كل سطر)", "Images supplémentaires (une URL par ligne)")}</label><textarea data-edit-path="images" rows="4" data-json="array">${ctx.esc((buffer.images || []).join("\n"))}</textarea></div>
          <div class="field"><label>${ctx.dt("ألوان (اسم:لون:#hex)", "Couleurs (nom:couleur:#hex)")}</label><textarea data-edit-path="colors" rows="4" data-colors>${ctx.esc((buffer.colors || []).map((color) => `${color.name}:${color.hex}`).join("\n"))}</textarea></div>
          <div class="field"><label>${ctx.dt("صور الألوان (اسم:رابط)", "Images couleurs (nom:URL)")}</label><textarea data-edit-path="colorImages" rows="4" data-colormap>${ctx.esc(
            Object.entries(buffer.colorImages || {})
              .map(([key, value]) => `${key}:${value}`)
              .join("\n")
          )}</textarea></div>
          <div class="field span-2"><label>${ctx.dt("المتغيرات (JSON متقدم)", "Variantes (JSON avancé)")}</label><textarea data-edit-path="variants" rows="5" data-json="raw">${ctx.esc(JSON.stringify(buffer.variants || [], null, 2))}</textarea></div>
        </div>
      </div>
      <div class="dash-panel" data-product-panel="specs">
        <div class="form-grid">
          <div class="field span-2"><label>${ctx.dt("المواصفات (JSON)", "Spécifications (JSON)")}</label><textarea data-edit-path="specs" rows="14" data-json="raw">${ctx.esc(JSON.stringify(buffer.specs || {}, null, 2))}</textarea><p class="form-note">${ctx.dt("أمثلة: cpu, ram, storage, screen, condition, keyboard, battery. كل قيمة تحتوي label و value و choices.", "Exemples : cpu, ram, storage, screen, condition, keyboard, battery. Chaque valeur contient label, value et choices.")}</p></div>
          <div class="field span-2"><label>${ctx.dt("ماذا يوجد في العلبة (JSON)", "Contenu de la boîte (JSON)")}</label><textarea data-edit-path="includes" rows="7" data-json="raw">${ctx.esc(JSON.stringify(buffer.includes || [], null, 2))}</textarea></div>
        </div>
      </div>`,
      {
        wide: true,
        footer: ctx.editorFooter(!isNew, "delete-product-buffer"),
        onMount: (root) => {
          root.querySelectorAll("[data-product-tab]").forEach((tab) =>
            tab.addEventListener("click", () => {
              root
                .querySelectorAll("[data-product-tab]")
                .forEach((item) => item.classList.toggle("active", item === tab));
              root
                .querySelectorAll("[data-product-panel]")
                .forEach((panel) =>
                  panel.classList.toggle("active", panel.dataset.productPanel === tab.dataset.productTab)
                );
            })
          );
        }
      }
    );
    // Attach save specifically through the shared action, while preserving the newly created index.
    ctx.pendingProductIndex = isNew ? null : index;
  }
  ctx.pendingProductIndex = null;

  function saveProductEditor() {
    const item = ctx.editBuffer;
    if (!item) return;
    // Parse the structured fields that use helper textareas.
    const editingModal = ctx.$(".dash-modal");
    editingModal?.querySelectorAll("[data-colors]").forEach((node) => {
      item.colors = node.value
        .split("\n")
        .map((line) => {
          const parts = line.split(":").map((part) => part.trim());
          return parts[0]
            ? { name: parts[0], hex: parts[1]?.startsWith("#") ? parts[1] : `#${parts[1] || "999999"}` }
            : null;
        })
        .filter(Boolean);
    });
    editingModal?.querySelectorAll("[data-colormap]").forEach((node) => {
      item.colorImages = Object.fromEntries(
        node.value
          .split("\n")
          .map((line) => line.split(":"))
          .filter((parts) => parts.length >= 2)
          .map((parts) => [parts[0].trim(), parts.slice(1).join(":").trim()])
      );
    });
    editingModal?.querySelectorAll("[data-json]").forEach((node) => {
      const path = node.dataset.editPath;
      if (path === "images") {
        item.images = node.value
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        if (item.images[0]) item.image = item.images[0];
        return;
      }
      try {
        if (!node.value.trim()) {
          ctx.setPath(item, path, node.dataset.json === "array" ? [] : null);
          return;
        }
        const parsed = JSON.parse(node.value);
        ctx.setPath(item, path, parsed);
      } catch {
        ctx.toast(`${ctx.dt("JSON غير صالح في", "JSON invalide dans")} ${path}`, "error");
      }
    });
    item.price = Number(item.price) || 0;
    item.compare = Number(item.compare) || 0;
    item.stock = Number(item.stock) || 0;
    item.battery = Number(item.battery) || 0;
    item.warrantyMonths = Number(item.warrantyMonths) || 12;
    if (item.active == null) item.active = true;
    if (ctx.pendingProductIndex == null && ctx.model.products.some((product) => product.handle === item.handle)) {
      ctx.toast(ctx.dt("المعرف مستخدم مسبقًا", "Identifiant déjà utilisé"), "error");
      return;
    }
    if (ctx.tablesMode()) {
      // Relational source of truth: write through the repository, never into the draft JSON.
      if (ctx.pendingProductIndex != null) item.id = ctx.model.products[ctx.pendingProductIndex]?.id || item.id;
      ctx
        .catalogWrite(ctx.dt("تم حفظ المنتج في قاعدة البيانات", "Produit enregistré en base"), () =>
          ctx.CAT.saveProduct(item)
        )
        .then((ok) => {
          if (ok) {
            ctx.closeModal();
            ctx.renderRoute();
          }
        });
      return;
    }
    if (ctx.pendingProductIndex == null) ctx.model.products.unshift(item);
    else ctx.model.products[ctx.pendingProductIndex] = item;
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.R.addAudit(`${ctx.dt("حفظ منتج", "Produit enregistré")}: ${item.title?.ar || item.handle}`);
    ctx.toast(ctx.dt("تم حفظ المنتج في المسودة", "Produit enregistré dans le brouillon"), "good");
    ctx.renderRoute();
  }

  function bulkPriceModal() {
    ctx.openModal(
      ctx.dt("تعديل الأسعار الجماعي", "Modification groupée des prix"),
      `
      <div class="field"><label>${ctx.dt("الفئة", "Catégorie")}</label><select id="bulk-category"><option value="all">${ctx.dt("كل الفئات", "Toutes")}</option>${ctx.model.collections.map((collection) => `<option value="${ctx.esc(collection.handle)}">${ctx.esc(ctx.lng(collection.title))}</option>`).join("")}</select></div>
      <div class="form-grid" style="margin-top:10px"><div class="field"><label>${ctx.dt("نسبة التغيير %", "Pourcentage")}</label><input id="bulk-percent" type="number" value="5" placeholder="5"></div><div class="field"><label>${ctx.dt("الاتجاه", "Sens")}</label><select id="bulk-direction"><option value="up">${ctx.dt("زيادة", "Augmenter")}</option><option value="down">${ctx.dt("تخفيض", "Diminuer")}</option></select></div></div>
      <p class="form-note" style="margin-top:10px">${ctx.dt("سيتم تحديث السعر الأخير مع الحفاظ على السعر المشطوب كما هو. يمكنك التراجع بعدم النشر.", "Le prix sera ajusté. Le prix barré reste inchangé. Vous pouvez annuler avant publication.")}</p>`,
      {
        footer: `<button class="btn btn-soft btn-sm" data-action="close-modal">${ctx.dt("إلغاء", "Annuler")}</button><button class="btn btn-primary btn-sm" data-action="apply-bulk-price">${ctx.dt("تطبيق", "Appliquer")}</button>`
      }
    );
  }

  function applyBulkPrice() {
    const category = ctx.$("#bulk-category")?.value || "all";
    const percent = Number(ctx.$("#bulk-percent")?.value) || 0;
    const direction = ctx.$("#bulk-direction")?.value || "up";
    if (ctx.tablesMode()) {
      let n = 0;
      ctx
        .catalogWrite(ctx.dt("تم تحديث الأسعار في قاعدة البيانات", "Prix mis à jour en base"), async () => {
          n = await ctx.CAT.bulkPrice({ collection: category, percent, direction });
        })
        .then((ok) => {
          if (ok) {
            ctx.closeModal();
            ctx.renderRoute();
            ctx.toast(`${n} ${ctx.dt("منتجًا تم تحديث سعره", "produits mis à jour")}`, "good");
          }
        });
      return;
    }
    let count = 0;
    ctx.model.products.forEach((product) => {
      if (product.active === false) return;
      if (category !== "all" && !(product.collections || []).includes(category)) return;
      const factor = direction === "up" ? 1 + percent / 100 : 1 - percent / 100;
      product.price = Math.max(0, Math.round((Number(product.price) * factor) / 5) * 5);
      count += 1;
    });
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.renderRoute();
    ctx.toast(`${count} ${ctx.dt("منتجًا تم تحديث سعره", "produits mis à jour")}`, "good");
  }

  function deleteProduct(index, fromBuffer = false) {
    const product = fromBuffer ? ctx.editBuffer : ctx.model.products[index];
    if (!product) return;
    if (!confirm(`${ctx.dt("حذف", "Supprimer")} ${product.title?.ar || product.handle}?`)) return;
    if (ctx.tablesMode()) {
      ctx
        .catalogWrite(ctx.dt("تم حذف المنتج من قاعدة البيانات", "Produit supprimé en base"), () =>
          ctx.CAT.deleteProduct(product)
        )
        .then((ok) => {
          if (ok) {
            ctx.closeModal();
            ctx.renderRoute();
          }
        });
      return;
    }
    if (fromBuffer) ctx.model.products = ctx.model.products.filter((item) => item.handle !== product.handle);
    else ctx.model.products.splice(index, 1);
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.R.addAudit(`${ctx.dt("حذف منتج", "Produit supprimé")}: ${product.handle}`);
    ctx.renderRoute();
    ctx.toast(ctx.dt("تم حذف المنتج من المسودة", "Produit supprimé du brouillon"), "good");
  }
}
