/* dashboard.js → Shared modal / field helpers
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

export function install(ctx) {
  Object.assign(ctx, {
    openModal,
    closeModal,
    field,
    biField,
    editInput,
    editBi,
    editToggle,
    directToggle,
    imageEditor,
    editorFooter,
    statusOptions
  });
  ctx.editBuffer = null;
  ctx.orderFilter = "all";
  ctx.productSearch = "";
  ctx.productCategory = "all";
  ctx.productStock = "all";
  ctx.abandonedFilter = "open";

  function openModal(title, body, { wide = false, footer = "", onMount = null } = {}) {
    ctx.modalRoot.innerHTML = `
      <div class="dash-modal-backdrop" data-action="modal-backdrop">
        <section class="dash-modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${ctx.esc(title)}">
          <div class="dash-modal-head"><h3>${ctx.esc(title)}</h3><button type="button" data-action="close-modal" aria-label="${ctx.dt("إغلاق", "Fermer")}">${ctx.icon("close")}</button></div>
          <div class="dash-modal-body">${body}</div>
          ${footer ? `<div class="dash-modal-foot">${footer}</div>` : ""}
        </section>
      </div>`;
    document.body.classList.add("no-scroll");
    if (onMount) onMount(ctx.modalRoot);
  }
  function closeModal() {
    ctx.modalRoot.innerHTML = "";
    document.body.classList.remove("no-scroll");
    ctx.editBuffer = null;
  }

  function field(
    label,
    path,
    { type = "text", value, placeholder = "", hint = "", rows = 3, options = null, disabled = false } = {}
  ) {
    let actual = value !== undefined ? value : ctx.getPath(ctx.model, path);
    if (type === "datetime-local") actual = ctx.isoLocal(actual);
    if (options) {
      return `<div class="field"><label>${ctx.esc(label)}</label><select data-path="${ctx.esc(path)}" ${disabled ? "disabled" : ""}>${options
        .map((option) => {
          const optionValue = typeof option === "object" ? option.value : option;
          const optionLabel = typeof option === "object" ? option.label : option;
          return `<option value="${ctx.esc(optionValue)}" ${String(optionValue) === String(actual) ? "selected" : ""}>${ctx.esc(optionLabel)}</option>`;
        })
        .join("")}</select>${hint ? `<p class="form-note">${ctx.esc(hint)}</p>` : ""}</div>`;
    }
    if (type === "textarea")
      return `<div class="field"><label>${ctx.esc(label)}</label><textarea data-path="${ctx.esc(path)}" rows="${rows}" placeholder="${ctx.esc(placeholder)}" ${disabled ? "disabled" : ""}>${ctx.esc(actual ?? "")}</textarea>${hint ? `<p class="form-note">${ctx.esc(hint)}</p>` : ""}</div>`;
    return `<div class="field"><label>${ctx.esc(label)}</label><input type="${type}" data-path="${ctx.esc(path)}" value="${ctx.esc(actual ?? "")}" placeholder="${ctx.esc(placeholder)}" ${disabled ? "disabled" : ""}>${hint ? `<p class="form-note">${ctx.esc(hint)}</p>` : ""}</div>`;
  }

  function biField(label, path, { type = "text", rows = 3 } = {}) {
    const value = ctx.getPath(ctx.model, path) || {};
    if (type === "textarea") {
      return `<div class="field"><label>${ctx.esc(label)}</label><div class="bi-grid"><textarea data-path="${ctx.esc(path)}.ar" rows="${rows}" dir="rtl" placeholder="العربية">${ctx.esc(value.ar ?? "")}</textarea><textarea data-path="${ctx.esc(path)}.fr" rows="${rows}" dir="ltr" placeholder="Français">${ctx.esc(value.fr ?? "")}</textarea></div></div>`;
    }
    return `<div class="field"><label>${ctx.esc(label)}</label><div class="bi-grid"><input data-path="${ctx.esc(path)}.ar" value="${ctx.esc(value.ar ?? "")}" dir="rtl" placeholder="العربية"><input data-path="${ctx.esc(path)}.fr" value="${ctx.esc(value.fr ?? "")}" dir="ltr" placeholder="Français"></div></div>`;
  }

  function editInput(label, path, { type = "text", value = "", placeholder = "", rows = 3, help = "" } = {}) {
    const suffix = `data-edit-path="${ctx.esc(path)}"`;
    if (type === "textarea")
      return `<div class="field"><label>${ctx.esc(label)}</label><textarea ${suffix} rows="${rows}" placeholder="${ctx.esc(placeholder)}">${ctx.esc(value ?? "")}</textarea>${help ? `<p class="form-note">${ctx.esc(help)}</p>` : ""}</div>`;
    return `<div class="field"><label>${ctx.esc(label)}</label><input type="${type}" ${suffix} value="${ctx.esc(value ?? "")}" placeholder="${ctx.esc(placeholder)}">${help ? `<p class="form-note">${ctx.esc(help)}</p>` : ""}</div>`;
  }
  function editBi(label, path, value = {}, { type = "text", rows = 3 } = {}) {
    if (type === "textarea")
      return `<div class="field"><label>${ctx.esc(label)}</label><div class="bi-grid"><textarea data-edit-path="${ctx.esc(path)}.ar" rows="${rows}" dir="rtl">${ctx.esc(value?.ar ?? "")}</textarea><textarea data-edit-path="${ctx.esc(path)}.fr" rows="${rows}" dir="ltr">${ctx.esc(value?.fr ?? "")}</textarea></div></div>`;
    return `<div class="field"><label>${ctx.esc(label)}</label><div class="bi-grid"><input data-edit-path="${ctx.esc(path)}.ar" value="${ctx.esc(value?.ar ?? "")}" dir="rtl"><input data-edit-path="${ctx.esc(path)}.fr" value="${ctx.esc(value?.fr ?? "")}" dir="ltr"></div></div>`;
  }
  function editToggle(label, path, checked) {
    return `<div class="check-row"><label class="toggle"><input type="checkbox" data-edit-path="${ctx.esc(path)}" ${checked ? "checked" : ""}><span></span></label><span>${ctx.esc(label)}</span></div>`;
  }
  function directToggle(label, path, checked) {
    return `<div class="check-row"><label class="toggle"><input type="checkbox" data-path="${ctx.esc(path)}" data-type="bool" ${checked ? "checked" : ""}><span></span></label><span>${ctx.esc(label)}</span></div>`;
  }
  function imageEditor(label, path, value = "") {
    return `<div class="field"><label>${ctx.esc(label)}</label><div class="image-field">
      <span class="image-preview"><img src="${ctx.esc(value || "assets/img/favicon.svg")}" alt=""></span>
      <div class="grow">
        <input data-edit-path="${ctx.esc(path)}" value="${ctx.esc(value)}" placeholder="assets/img/...">
        <label class="upload-btn">${ctx.icon("upload")} ${ctx.dt("رفع صورة", "Téléverser")}<input type="file" accept="image/*" data-upload-path="${ctx.esc(path)}"></label>
      </div>
    </div></div>`;
  }
  function editorFooter(canDelete = false, deleteAction = "") {
    return `${canDelete ? `<button class="btn btn-danger btn-sm" type="button" data-action="${ctx.esc(deleteAction)}">${ctx.icon("trash")} ${ctx.dt("حذف", "Supprimer")}</button>` : ""}<span style="flex:1"></span><button class="btn btn-soft btn-sm" type="button" data-action="close-modal">${ctx.dt("إلغاء", "Annuler")}</button><button class="btn btn-primary btn-sm" type="button" data-action="save-editor">${ctx.icon("check")} ${ctx.dt("حفظ", "Enregistrer")}</button>`;
  }

  function statusOptions(selected) {
    return ctx.R.statuses
      .map((status) => {
        const meta = ctx.R.statusMeta(status);
        return `<option value="${status}" ${status === selected ? "selected" : ""}>${ctx.esc(ctx.lng(meta.label))}</option>`;
      })
      .join("");
  }
}
