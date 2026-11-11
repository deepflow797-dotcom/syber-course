/* dashboard.js → Orders
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

export function install(ctx) {
  Object.assign(ctx, {
    filteredOrders,
    ordersTable,
    viewOrders,
    orderMessage,
    printOrder,
    viewOrderModal,
    exportOrdersCsv
  });
  function filteredOrders() {
    const needle = ctx.R.normalizeText(ctx.searchTerm);
    return ctx.orderList().filter((order) => {
      if (ctx.orderFilter !== "all" && order.status !== ctx.orderFilter) return false;
      if (!needle) return true;
      const haystack = ctx.R.normalizeText(
        [
          order.id,
          order.customer?.name,
          order.customer?.phone,
          order.customer?.city,
          order.customer?.address,
          ...(order.items || []).map((item) => item.title)
        ].join(" ")
      );
      return haystack.includes(needle);
    });
  }

  function ordersTable(orders) {
    if (!orders.length)
      return `<div class="table-empty">${ctx.icon("orders")}<p>${ctx.dt("لا توجد طلبات مطابقة.", "Aucune commande correspondante.")}</p></div>`;
    return `<div class="dash-table-wrap"><table class="dash-table">
      <thead><tr><th>${ctx.dt("الطلب", "Commande")}</th><th>${ctx.dt("العميل", "Client")}</th><th>${ctx.dt("المدينة", "Ville")}</th><th>${ctx.dt("المنتجات", "Articles")}</th><th>${ctx.dt("الدفع", "Paiement")}</th><th>${ctx.dt("المجموع", "Total")}</th><th>${ctx.dt("الحالة", "Statut")}</th><th></th></tr></thead>
      <tbody>${orders
        .map((order) => {
          const status = ctx.R.statusMeta(order.status);
          return `<tr>
          <td><strong style="font-size:9px">${ctx.esc(order.id)}</strong><br><small style="font-size:8px;color:var(--soft-muted)">${ctx.esc(ctx.fmtDateTime(order.createdAt))}</small></td>
          <td><strong style="font-size:10px">${ctx.esc(order.customer?.name || "")}</strong><br><small dir="ltr" style="font-size:8px;color:var(--soft-muted)">${ctx.esc(order.customer?.phone || "")}</small></td>
          <td>${ctx.esc(order.customer?.city || "")}</td>
          <td>${(order.items || []).reduce((sum, item) => sum + Number(item.qty || 1), 0)}</td>
          <td>${ctx.esc(order.payment?.name || "")}</td>
          <td class="price">${ctx.money(order.total)}</td>
          <td><select class="dash-field" data-order-status="${ctx.esc(order.id)}" style="min-width:95px;height:28px;padding:2px 6px;font-size:9px;border-color:${status.color}">${ctx.statusOptions(order.status)}</select></td>
          <td><div class="cell-actions">
            <button class="btn btn-sm btn-soft" type="button" data-action="view-order" data-id="${ctx.esc(order.id)}">${ctx.dt("عرض", "Voir")}</button>
            <a class="btn btn-sm btn-soft" href="https://wa.me/${ctx.digits(order.customer?.phone)}" target="_blank" rel="noopener" title="WhatsApp">${ctx.icon("whatsapp")}</a>
          </div></td>
        </tr>`;
        })
        .join("")}</tbody>
    </table></div>`;
  }

  function viewOrders() {
    const orders = filteredOrders();
    const tabs = [
      { id: "all", label: ctx.dt("الكل", "Toutes"), count: ctx.orderList().length },
      ...ctx.R.statuses.map((status) => ({
        id: status,
        label: ctx.lng(ctx.R.statusMeta(status).label),
        count: ctx.orderStatusCount(status)
      }))
    ];
    return `
      <div class="dash-view-head">
        <div><h2>${ctx.dt("الطلبات", "Commandes")}</h2><p>${ctx.dt("كل طلب يصل من المتجر يظهر هنا فورًا.", "Chaque commande de la boutique apparaît ici en direct.")}</p></div>
        <div class="dash-view-actions"><button class="btn btn-soft" type="button" data-action="export-orders">${ctx.icon("download")} ${ctx.dt("تصدير CSV", "Exporter CSV")}</button></div>
      </div>
      <div class="dash-toolbar">
        <div class="segmented" style="flex-wrap:wrap">${tabs.map((tab) => `<button type="button" data-order-filter="${tab.id}" class="${ctx.orderFilter === tab.id ? "active" : ""}">${ctx.esc(tab.label)} ${tab.count ? `(${tab.count})` : ""}</button>`).join("")}</div>
        <div class="spacer"></div>
        <label class="field" style="min-width:210px"><input id="order-search" placeholder="${ctx.dt("بحث بالرقم، الاسم أو الهاتف", "N°, nom ou téléphone")}" value="${ctx.esc(ctx.searchTerm)}"></label>
      </div>
      <div class="dash-card">${ordersTable(orders)}</div>`;
  }

  function orderMessage(order, type = "confirm") {
    const template = ctx.model.settings.whatsappTemplates?.[type];
    if (!template) return "";
    const text = ctx
      .lng(template)
      .replaceAll("{name}", order.customer?.name || "")
      .replaceAll("{order_id}", order.id)
      .replaceAll("{store}", ctx.lng(ctx.model.settings.storeName));
    return text;
  }

  function printOrder(order, mode) {
    const invoice = mode === "invoice";
    const win = window.open("", "_blank", "width=820,height=980");
    if (!win) {
      ctx.toast(ctx.dt("اسمح بالنوافذ المنبثقة للطباعة", "Autorisez les pop-ups pour imprimer"), "error");
      return;
    }
    const itemRows = (order.items || [])
      .map(
        (item) =>
          `<tr><td>${ctx.esc(item.title)}<br><small>${ctx.esc(item.variantTitle || "")} ${ctx.esc(item.specsText || "")}</small></td><td>${item.qty}</td><td>${ctx.money(item.price)}</td><td>${ctx.money(item.line)}</td></tr>`
      )
      .join("");
    win.document
      .write(`<!doctype html><html lang="${ctx.dashLang}" dir="${ctx.dashLang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${invoice ? ctx.dt("فاتورة", "Facture") : ctx.dt("ملصق شحن", "Étiquette")} ${ctx.esc(order.id)}</title><style>
      @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#111;font-size:12px;line-height:1.6}header{display:flex;justify-content:space-between;border-bottom:2px solid #ff6400;padding-bottom:12px;margin-bottom:18px}h1{font-size:22px;margin:0}img{width:120px}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{padding:7px;border-bottom:1px solid #ddd;text-align:start;font-size:11px}th{background:#f5f5f5}small{color:#666;font-size:9px}.total{font-size:16px;font-weight:bold;text-align:end;margin-top:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.box{border:1px solid #ddd;padding:10px;border-radius:6px}.label{border:2px solid #111;padding:22px;margin-top:20px}.label h2{font-size:26px;margin:0 0 10px}.label .addr{font-size:17px;line-height:1.8}.barcode{margin-top:16px;font-family:monospace;font-size:13px;letter-spacing:2px}</style></head><body>
      <header><div><img src="${location.origin}${location.pathname.replace(/[^/]*$/, "")}${ctx.esc(ctx.model.settings.logo || "assets/img/brand-logo.svg")}" alt="${ctx.esc(ctx.model.settings.storeName?.[ctx.dashLang] || "")}"><h1>${invoice ? ctx.dt("فاتورة", "Facture") : ctx.dt("ملصق شحن", "Étiquette d’expédition")}</h1></div><div style="text-align:end"><strong>${ctx.esc(ctx.model.settings.mapPhone || ctx.model.settings.phoneDisplay || "")}</strong><br>${ctx.esc(ctx.lng(ctx.model.settings.address))}<br>${ctx.esc(ctx.model.settings.email || "")}</div></header>
      ${
        invoice
          ? `<div class="grid"><div class="box"><strong>${ctx.dt("فاتورة", "Facture")}: ${ctx.esc(order.id)}</strong><br>${ctx.esc(ctx.fmtDate(order.createdAt))}<br>${ctx.dt("الحالة", "Statut")}: ${ctx.esc(ctx.lng(ctx.R.statusMeta(order.status).label))}</div><div class="box"><strong>${ctx.dt("العميل", "Client")}</strong><br>${ctx.esc(order.customer?.name || "")}<br>${ctx.esc(order.customer?.phone || "")}<br>${ctx.esc(order.customer?.city || "")} — ${ctx.esc(order.customer?.address || "")}</div></div>
      <table><thead><tr><th>${ctx.dt("المنتج", "Produit")}</th><th>${ctx.dt("الكمية", "Qté")}</th><th>${ctx.dt("السعر", "Prix")}</th><th>${ctx.dt("المجموع", "Total")}</th></tr></thead><tbody>${itemRows}</tbody></table>
      <div class="total">${ctx.dt("المجموع الكلي", "Total")}: ${ctx.money(order.total)}</div>`
          : `<div class="label"><h2>${ctx.esc(ctx.model.settings.storeName?.[ctx.dashLang] || "Restore")}</h2><div class="addr"><strong>${ctx.esc(order.customer?.name || "")}</strong><br>${ctx.esc(order.customer?.phone || "")}<br>${ctx.esc(order.customer?.address || "")}<br>${ctx.esc(order.customer?.city || "")} — ${ctx.dt("موريتانيا", "Mauritanie")}</div><div class="barcode">${ctx.esc(order.id)} · ${ctx.esc(ctx.digits(order.customer?.phone).slice(-8))}</div></div>`
      }
      <p style="margin-top:24px;font-size:9px;color:#888">${ctx.dt("تم إنشاء هذا المستند من لوحة تحكم المتجر.", "Document généré depuis le tableau de bord de la boutique.")}</p>
      </body></html>`);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 350);
  }

  function viewOrderModal(id) {
    const order = ctx.R.getOrders().find((item) => item.id === id);
    if (!order) return;
    const status = ctx.R.statusMeta(order.status);
    const wa = `https://wa.me/${ctx.digits(order.customer?.phone)}?text=${encodeURIComponent(orderMessage(order, "confirm"))}`;
    ctx.openModal(
      `${ctx.dt("الطلب", "Commande")} ${order.id}`,
      `
      <div class="order-detail">
        <div>
          <div class="order-detail-section">
            <h4>${ctx.dt("المنتجات", "Articles")}</h4>
            ${(order.items || []).map((item) => `<div class="order-item-row"><img src="${ctx.esc(item.image || "assets/img/favicon.svg")}" alt=""><div class="grow"><strong>${ctx.esc(item.title)}</strong><small>${ctx.esc(item.variantTitle || "")} ${item.specsText ? `· ${ctx.esc(item.specsText)}` : ""}</small></div><span>×${item.qty}</span><strong>${ctx.money(item.line)}</strong></div>`).join("")}
            <div class="order-totals">
              <div><span>${ctx.dt("المجموع الفرعي", "Sous-total")}</span><span>${ctx.money(order.subtotal)}</span></div>
              <div><span>${ctx.dt("الشحن", "Livraison")}</span><span>${ctx.money(order.shipping)}</span></div>
              <div><span>${ctx.dt("الخصم", "Réduction")}</span><span>${ctx.money(order.discount)}</span></div>
              <div class="total"><span>${ctx.dt("المجموع", "Total")}</span><span>${ctx.money(order.total)}</span></div>
            </div>
          </div>
          <div class="order-detail-section" style="margin-top:10px">
            <h4>${ctx.dt("ملاحظات العميل", "Notes du client")}</h4>
            <p>${ctx.esc(order.customer?.notes || ctx.dt("لا توجد ملاحظات", "Aucune note"))}</p>
          </div>
        </div>
        <div>
          <div class="order-detail-section">
            <h4>${ctx.dt("العميل", "Client")}</h4>
            <p><strong>${ctx.esc(order.customer?.name || "")}</strong><br><span dir="ltr">${ctx.esc(order.customer?.phone || "")}</span><br>${ctx.esc(order.customer?.city || "")}<br>${ctx.esc(order.customer?.address || "")}<br>${ctx.esc(order.customer?.email || "")}</p>
            <div style="display:flex;gap:5px;margin-top:9px;flex-wrap:wrap"><a class="btn btn-sm btn-whatsapp" href="${wa}" target="_blank" rel="noopener">${ctx.icon("whatsapp")} ${ctx.dt("واتساب", "WhatsApp")}</a><a class="btn btn-sm btn-soft" href="tel:${ctx.esc(order.customer?.phone)}">${ctx.dt("اتصال", "Appeler")}</a></div>
          </div>
          <div class="order-detail-section" style="margin-top:10px">
            <h4>${ctx.dt("إدارة الطلب", "Gestion")}</h4>
            <div class="field"><label>${ctx.dt("الحالة", "Statut")}</label><select data-order-status="${ctx.esc(order.id)}">${ctx.statusOptions(order.status)}</select></div>
            <div class="field" style="margin-top:8px"><label>${ctx.dt("ملاحظة داخلية", "Note interne")}</label><textarea rows="3" data-order-note="${ctx.esc(order.id)}">${ctx.esc(order.internalNote || "")}</textarea></div>
            <p class="form-note" style="margin-top:8px">${ctx.dt("الدفع", "Paiement")}: <strong>${ctx.esc(order.payment?.name || "")}</strong> · ${ctx.dt("المصدر", "Source")}: ${ctx.esc(order.source || "whatsapp")}</p>
          </div>
          <div class="order-detail-section" style="margin-top:10px">
            <h4>${ctx.dt("المستندات", "Documents")}</h4>
            <div style="display:flex;gap:5px;flex-wrap:wrap"><button class="btn btn-sm btn-soft" data-action="print-invoice" data-id="${ctx.esc(order.id)}">${ctx.icon("print")} ${ctx.dt("فاتورة", "Facture")}</button><button class="btn btn-sm btn-soft" data-action="print-label" data-id="${ctx.esc(order.id)}">${ctx.dt("ملصق شحن", "Étiquette")}</button></div>
            <div style="margin-top:12px"><span class="status-pill" style="--status:${status.color}">${ctx.esc(ctx.lng(status.label))}</span></div>
          </div>
        </div>
      </div>`,
      {
        wide: true,
        footer: `<button class="btn btn-soft btn-sm" data-action="close-modal">${ctx.dt("إغلاق", "Fermer")}</button><button class="btn btn-primary btn-sm" data-action="save-order" data-id="${ctx.esc(order.id)}">${ctx.icon("check")} ${ctx.dt("حفظ التغييرات", "Enregistrer")}</button>`
      }
    );
  }

  function exportOrdersCsv() {
    const orders = ctx.orderList();
    const rows = [
      [
        "order_id",
        "date",
        "status",
        "name",
        "phone",
        "city",
        "address",
        "payment",
        "items",
        "subtotal",
        "shipping",
        "discount",
        "total",
        "currency",
        "coupon",
        "notes"
      ],
      ...orders.map((order) => [
        order.id,
        order.createdAt,
        order.status,
        order.customer?.name,
        order.customer?.phone,
        order.customer?.city,
        order.customer?.address,
        order.payment?.name,
        (order.items || []).map((item) => `${item.title} x${item.qty}`).join(" | "),
        order.subtotal,
        order.shipping,
        order.discount,
        order.total,
        order.currency || "MRU",
        order.coupon || "",
        order.customer?.notes || ""
      ])
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `restore-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    ctx.toast(ctx.dt("تم تصدير الطلبات", "Commandes exportées"), "good");
  }
}
