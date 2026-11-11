/* dashboard.js → Event delegation (part 1)
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

export function install(ctx) {
  Object.assign(ctx, { applyLiveColor, handleField, handleDirectToggle, handleLines, resizeImage, handleUpload });
  ctx.editorKind = null;
  ctx.lastOrderCount = ctx.newOrdersCount();
  ctx.searchTimer = undefined;

  function applyLiveColor(path) {
    const html = document.documentElement;
    const map = {
      "settings.colors.primary": "--orange",
      "settings.colors.purple": "--purple",
      "settings.colors.ink": "--ink",
      "settings.colors.lavender": "--lav"
    };
    if (map[path]) html.style.setProperty(map[path], ctx.getPath(ctx.model, path));
    if (path === "settings.font") {
      const font = ctx.getPath(ctx.model, path);
      html.style.setProperty("--font-main", `"${font}", "Noto Sans Arabic", Tahoma, sans-serif`);
    }
  }

  /** Value carried by a field node, normalised by its input type. */
  function nodeValue(node) {
    let value = node.type === "checkbox" ? node.checked : node.value;
    if (node.dataset.type === "bool") value = node.checked;
    if (node.type === "number" || node.dataset.type === "number") value = value === "" ? 0 : Number(value);
    if (node.type === "datetime-local" && value) value = new Date(value).toISOString();
    return value;
  }

  function handleField(node) {
    const editPath = node.dataset.editPath;
    const path = node.dataset.path;
    if (!editPath && !path) return;
    const target = editPath ? ctx.editBuffer : ctx.model;
    if (!target) return;
    ctx.setPath(target, editPath || path, nodeValue(node));
    // No DOM re-render while typing: the draft is saved in the background.
    if (editPath) return;
    applyLiveColor(path);
    ctx.saveDraftSoon();
  }

  /** Visibility switch of a page/home section. */
  function toggleSection(sections, id, checked) {
    const section = sections.find((item) => item.id === id);
    if (!section) return;
    section.visible = checked;
    ctx.saveDraftSoon();
  }

  /** Product visibility: relational mode writes through the repository. */
  function setProductActive(node) {
    const product = ctx.model.products[Number(node.dataset.productActive)];
    if (!product) return;
    if (ctx.tablesMode()) {
      ctx
        .catalogWrite(ctx.dt("تم تحديث حالة المنتج", "Statut produit mis à jour"), () =>
          ctx.CAT.setProductActive(product, node.checked)
        )
        .then(ctx.renderRoute);
      return;
    }
    product.active = node.checked;
    ctx.saveDraftNow();
    ctx.renderRoute();
  }

  function setCouponActive(node) {
    const coupon = ctx.model.settings.coupons[Number(node.dataset.couponActive)];
    if (!coupon) return;
    if (ctx.tablesMode()) {
      ctx.catalogWrite(ctx.dt("تم تحديث الكوبون", "Coupon mis à jour"), () =>
        ctx.CAT.saveCoupon({ ...coupon, active: node.checked })
      );
      return;
    }
    coupon.active = node.checked;
    ctx.saveDraftNow();
  }

  function handleOrderStatus(node) {
    const order = ctx.R.getOrders().find((item) => item.id === node.dataset.orderStatus);
    if (!order) return;
    ctx.R.updateOrder(order.id, { status: node.value });
    ctx.R.addAudit(`${ctx.dt("تحديث حالة طلب", "Statut commande")} ${order.id}: ${node.value}`);
    ctx.toast(ctx.dt("تم تحديث حالة الطلب", "Statut mis à jour"), "good");
    if (ctx.route === "overview" || ctx.route === "orders") ctx.renderRoute();
  }

  /** Simple `list[index][field] = checked` switches. */
  const INDEXED_TOGGLES = [
    { key: "paymentActive", list: () => ctx.model.settings.payments, field: "active", rerender: true },
    { key: "cityActive", list: () => ctx.model.settings.cities, field: "active", rerender: true },
    { key: "reviewApproved", list: () => ctx.model.reviews, field: "approved", rerender: false }
  ];

  function applyIndexedToggle(spec, index, node) {
    const entry = spec.list()[Number(index)];
    if (!entry) return;
    entry[spec.field] = node.checked;
    ctx.saveDraftNow();
    if (spec.rerender) ctx.renderRoute();
  }

  function handleDirectToggle(node) {
    const data = node.dataset;
    if (data.pageSectionVisible)
      return toggleSection(ctx.model.settings.pageSections, data.pageSectionVisible, node.checked);
    if (data.homeSectionVisible)
      return toggleSection(ctx.model.settings.homeSections, data.homeSectionVisible, node.checked);
    if (data.productActive != null) return setProductActive(node);
    if (data.couponActive != null) return setCouponActive(node);
    if (data.orderStatus) return handleOrderStatus(node);
    const spec = INDEXED_TOGGLES.find((entry) => data[entry.key] != null);
    if (spec) applyIndexedToggle(spec, data[spec.key], node);
  }

  function handleLines(node) {
    const path = node.dataset.linesPath;
    if (!path) return;
    const rows = node.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("|").map((part) => part.trim());
        if (parts.length >= 3) return { label: { ar: parts[0], fr: parts[1] }, href: parts.slice(2).join("|") };
        return { label: { ar: parts[0], fr: parts[0] }, href: parts[1] || "#" };
      });
    ctx.setPath(ctx.model, path, rows);
    ctx.saveDraftSoon();
  }

  function resizeImage(file) {
    if (file.size > 4 * 1024 * 1024)
      return Promise.reject(new Error(ctx.dt("الصورة أكبر من 4MB", "Image supérieure à 4 Mo")));
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(ctx.dt("تعذر قراءة الصورة", "Impossible de lire l’image")));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error(ctx.dt("صورة غير صالحة", "Image invalide")));
        image.onload = () => {
          const max = 900;
          const scale = Math.min(1, max / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/webp", 0.82));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /** Uploads to Supabase when the store is remote; returns the URL to store. */
  async function uploadMediaIfRemote(data) {
    if (!ctx.R.remote) return data;
    try {
      const publicUrl = await ctx.R.uploadMedia(data);
      return publicUrl || data;
    } catch (uploadError) {
      ctx.toast(
        `${ctx.dt("تعذر رفع الصورة إلى Supabase", "Échec du téléversement Supabase")}: ${uploadError.message}`,
        "error"
      );
      return null;
    }
  }

  /** Mirrors the stored URL into the visible field and its preview. */
  function syncImagePreview(input, data) {
    const field = input.closest(".image-field");
    const inputNode = field?.querySelector("input[data-edit-path], input[data-path]");
    if (inputNode) inputNode.value = data;
    const preview = field?.querySelector("img");
    if (preview) preview.src = data;
  }

  async function handleUpload(input) {
    const file = input.files?.[0];
    if (!file) return;
    const path = input.dataset.uploadPath;
    const direct = input.dataset.uploadTarget === "direct";
    try {
      const data = await uploadMediaIfRemote(await resizeImage(file));
      if (data === null) return;
      const target = direct ? ctx.model : ctx.editBuffer;
      if (!target) return;
      ctx.setPath(target, path, data);
      syncImagePreview(input, data);
      if (direct) ctx.saveDraftSoon();
      ctx.toast(ctx.dt("تم رفع الصورة", "Image importée"), "good");
    } catch (error) {
      ctx.toast(error.message, "error");
    }
  }
}
