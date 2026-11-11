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

  function handleField(node) {
    const editPath = node.dataset.editPath;
    const path = node.dataset.path;
    if (!editPath && !path) return;
    let value = node.type === "checkbox" ? node.checked : node.value;
    if (node.dataset.type === "bool") value = node.checked;
    if (node.type === "number" || node.dataset.type === "number") value = value === "" ? 0 : Number(value);
    if (node.type === "datetime-local" && value) value = new Date(value).toISOString();
    const target = editPath ? ctx.editBuffer : ctx.model;
    if (!target) return;
    ctx.setPath(target, editPath || path, value);
    if (!editPath) {
      applyLiveColor(path);
      ctx.saveDraftSoon();
      if (path.startsWith("settings.") || path.startsWith("pages.") || path.startsWith("collections.")) {
        // no DOM re-render while typing; the draft is saved in the background
      }
    }
  }

  function handleDirectToggle(node) {
    if (node.dataset.pageSectionVisible) {
      const section = ctx.model.settings.pageSections.find((item) => item.id === node.dataset.pageSectionVisible);
      if (section) {
        section.visible = node.checked;
        ctx.saveDraftSoon();
      }
    }
    if (node.dataset.homeSectionVisible) {
      const section = ctx.model.settings.homeSections.find((item) => item.id === node.dataset.homeSectionVisible);
      if (section) {
        section.visible = node.checked;
        ctx.saveDraftSoon();
      }
    }
    if (node.dataset.productActive != null) {
      const product = ctx.model.products[Number(node.dataset.productActive)];
      if (product && ctx.tablesMode()) {
        ctx
          .catalogWrite(ctx.dt("تم تحديث حالة المنتج", "Statut produit mis à jour"), () =>
            ctx.CAT.setProductActive(product, node.checked)
          )
          .then(ctx.renderRoute);
        return;
      }
      if (product) {
        product.active = node.checked;
        ctx.saveDraftNow();
        ctx.renderRoute();
      }
    }
    if (node.dataset.couponActive != null) {
      const coupon = ctx.model.settings.coupons[Number(node.dataset.couponActive)];
      if (coupon && ctx.tablesMode()) {
        ctx.catalogWrite(ctx.dt("تم تحديث الكوبون", "Coupon mis à jour"), () =>
          ctx.CAT.saveCoupon({ ...coupon, active: node.checked })
        );
        return;
      }
      if (coupon) {
        coupon.active = node.checked;
        ctx.saveDraftNow();
      }
    }
    if (node.dataset.paymentActive != null) {
      const payment = ctx.model.settings.payments[Number(node.dataset.paymentActive)];
      if (payment) {
        payment.active = node.checked;
        ctx.saveDraftNow();
        ctx.renderRoute();
      }
    }
    if (node.dataset.cityActive != null) {
      const city = ctx.model.settings.cities[Number(node.dataset.cityActive)];
      if (city) {
        city.active = node.checked;
        ctx.saveDraftNow();
        ctx.renderRoute();
      }
    }
    if (node.dataset.reviewApproved != null) {
      const review = ctx.model.reviews[Number(node.dataset.reviewApproved)];
      if (review) {
        review.approved = node.checked;
        ctx.saveDraftNow();
      }
    }
    if (node.dataset.orderStatus) {
      const order = ctx.R.getOrders().find((item) => item.id === node.dataset.orderStatus);
      if (order) {
        ctx.R.updateOrder(order.id, { status: node.value });
        ctx.R.addAudit(`${ctx.dt("تحديث حالة طلب", "Statut commande")} ${order.id}: ${node.value}`);
        ctx.toast(ctx.dt("تم تحديث حالة الطلب", "Statut mis à jour"), "good");
        if (ctx.route === "overview" || ctx.route === "orders") ctx.renderRoute();
      }
    }
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
    return new Promise((resolve, reject) => {
      if (file.size > 4 * 1024 * 1024) {
        reject(new Error(ctx.dt("الصورة أكبر من 4MB", "Image supérieure à 4 Mo")));
        return;
      }
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

  async function handleUpload(input) {
    const file = input.files?.[0];
    if (!file) return;
    const path = input.dataset.uploadPath;
    const direct = input.dataset.uploadTarget === "direct";
    try {
      let data = await resizeImage(file);
      const target = direct ? ctx.model : ctx.editBuffer;
      if (!target) return;
      if (ctx.R.remote) {
        try {
          const publicUrl = await ctx.R.uploadMedia(data);
          if (publicUrl) data = publicUrl;
        } catch (uploadError) {
          ctx.toast(
            `${ctx.dt("تعذر رفع الصورة إلى Supabase", "Échec du téléversement Supabase")}: ${uploadError.message}`,
            "error"
          );
          return;
        }
      }
      ctx.setPath(target, path, data);
      const field = input.closest(".image-field");
      const inputNode = field?.querySelector("input[data-edit-path], input[data-path]");
      if (inputNode) inputNode.value = data;
      const preview = field?.querySelector("img");
      if (preview) preview.src = data;
      if (direct) ctx.saveDraftSoon();
      ctx.toast(ctx.dt("تم رفع الصورة", "Image importée"), "good");
    } catch (error) {
      ctx.toast(error.message, "error");
    }
  }
}
