/* dashboard.js → Team
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

export function install(ctx) {
  Object.assign(ctx, { viewProfile, viewTeam, managerEditor, saveManager, changeOwnPasswordModal, saveOwnPassword });

  /* ---------- profile panels ---------- */

  function contactPanel() {
    return `
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("معلومات التواصل للمتجر", "Infos de contact de la boutique")}</h3></div><div class="dash-card-body dash-form">
          ${ctx.biField(ctx.dt("اسم المتجر", "Nom de la boutique"), "settings.storeName")}
          ${ctx.biField(ctx.dt("الشعار", "Slogan"), "settings.tagline")}
          <div class="form-grid">${ctx.field(ctx.dt("واتساب المتجر", "WhatsApp de la boutique"), "settings.whatsapp", { placeholder: "222XXXXXXXX" })}${ctx.field(ctx.dt("البريد الإلكتروني", "E-mail"), "settings.email", { placeholder: "contact@example.com" })}</div>
          ${ctx.biField(ctx.dt("العنوان", "Adresse"), "settings.address", { type: "textarea", rows: 2 })}
          ${ctx.biField(ctx.dt("المدينة", "Ville"), "settings.city")}
          <div class="form-grid">${ctx.field(ctx.dt("الرقم الظاهر", "Numéro affiché"), "settings.phoneDisplay", { placeholder: "+222 46 00 00 00" })}${ctx.field(ctx.dt("رقم الهاتف (دولي)", "Téléphone (international)"), "settings.phone", { placeholder: "+22246000000" })}</div>
          <p class="form-note">${ctx.dt("هذه المعلومات تظهر في الفوتر وصفحة التواصل وفي رسالة الواتساب للطلب", "Ces infos apparaissent dans le footer, la page contact et le message WhatsApp de commande")}</p>
          <div class="btn-group" style="margin-top:10px"><button class="btn btn-primary" id="save-owner-contact">${ctx.icon("check")} ${ctx.dt("حفظ معلومات المتجر", "Enregistrer les infos boutique")}</button></div>
        </div></article>
      </div>`;
  }

  const SOCIAL_ID_OPTIONS = [
    "facebook",
    "instagram",
    "tiktok",
    "youtube",
    "x",
    "twitter",
    "snapchat",
    "whatsapp",
    "linkedin",
    "telegram"
  ];

  /** One editable social-link row. */
  function socialRowHTML(link, i) {
    const platform = String(link.platform || link.id || "");
    const options = SOCIAL_ID_OPTIONS.map(
      (id) => `<option value="${id}" ${platform === id ? "selected" : ""}>${id}</option>`
    ).join("");
    return `
              <div class="social-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
                <select data-social-platform="${i}" style="flex:1;min-width:130px;max-width:170px">
                  <option value="">${ctx.dt("اختر المنصة", "Choisir la plateforme")}</option>
                  ${options}
                </select>
                <input type="url" data-social-url="${i}" value="${ctx.esc(link.href || "")}" placeholder="https://..." style="flex:2;min-width:200px" dir="ltr">
                <button type="button" class="btn btn-sm btn-soft" data-action="remove-social" data-index="${i}" style="padding:6px" aria-label="${ctx.dt("حذف", "Supprimer")}">${ctx.icon("trash")}</button>
              </div>`;
  }

  function socialPanel() {
    return `
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("روابط التواصل الاجتماعي", "Liens réseaux sociaux")}</h3></div><div class="dash-card-body dash-form">
          <p class="form-note">${ctx.dt("أضف روابط حساباتك على المنصات الاجتماعية. ستظهر في الفوتر وصفحة التواصل.", "Ajoutez les liens de vos comptes sociaux. Ils apparaîtront dans le footer et la page contact.")}</p>
          <div id="social-links-editor">
            ${(ctx.model.settings.social || []).map(socialRowHTML).join("")}
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="add-social-link">${ctx.icon("plus")} ${ctx.dt("إضافة رابط", "Ajouter un lien")}</button>
          <div class="btn-group" style="margin-top:10px"><button class="btn btn-primary" id="save-owner-social">${ctx.icon("check")} ${ctx.dt("حفظ الروابط", "Enregistrer les liens")}</button></div>
        </div></article>
      </div>`;
  }

  function profileTabs() {
    const ownerTabs =
      ctx.session?.role === "owner"
        ? `<button data-dash-tab="profile-contact">${ctx.dt("التواصل", "Contact")}</button>
        <button data-dash-tab="profile-social">${ctx.dt("السوشيال", "Social")}</button>`
        : "";
    return `<button class="active" data-dash-tab="profile-info">${ctx.dt("معلومات الحساب", "Infos du compte")}</button>
        ${ownerTabs}
        <button data-dash-tab="profile-security">${ctx.dt("الأمان", "Sécurité")}</button>
        <button data-dash-tab="profile-payment">${ctx.dt("طرق الدفع", "Moyens de paiement")}</button>`;
  }

  function avatarCard(currentUser) {
    const hasAvatar = currentUser.avatar && currentUser.avatar.trim();
    const initials = String(ctx.lng(currentUser.name) || ctx.session?.username || "U")
      .slice(0, 2)
      .toUpperCase();
    const inner = hasAvatar
      ? `<img src="${ctx.esc(currentUser.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover">`
      : ctx.esc(initials);
    return `          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("الصورة الرمزية", "Avatar")}</h3></div><div class="dash-card-body" style="display:flex;align-items:center;gap:15px">
            <div class="image-field" style="width:100px;height:100px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,#ff6400,#a72396);color:#fff;display:grid;place-items:center;font-size:28px;font-weight:700">
              ${inner}
            </div>
            <div>
              <label class="upload-btn">${ctx.icon("upload")} ${ctx.dt("تغيير الصورة", "Changer l'image")}<input type="file" accept="image/*" id="profile-avatar-upload"></label>
              <p class="form-note">${ctx.dt("سيتم تحديث الصورة في جميع أنحاء لوحة التحكم والمتجر", "L'image sera mise à jour dans tout le tableau de bord et la boutique")}</p>
            </div>
          </div></article>`;
  }

  function activePaymentRow(payment) {
    return `<div class="list-row"><div style="display:flex;align-items:center;gap:10px"><span style="width:32px;height:32px;border-radius:8px;background:${ctx.esc(payment.color)};color:#fff;display:grid;place-items:center;font-size:9px;font-weight:800">${ctx.esc(String(ctx.lng(payment.name)).slice(0, 2))}</span><div><strong>${ctx.esc(ctx.lng(payment.name))}</strong><br><small>${ctx.esc(ctx.lng(payment.note))}</small></div></div></div>`;
  }

  function securityPanel() {
    return `<div class="dash-panel" data-dash-panel="profile-security">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("تغيير كلمة المرور", "Changer le mot de passe")}</h3></div><div class="dash-card-body dash-form">
          <div class="form-grid">
            <div class="field"><label>${ctx.dt("كلمة المرور الحالية", "Mot de passe actuel")}</label><input id="sec-current" type="password" autocomplete="current-password"></div>
            <div class="field"><label>${ctx.dt("الجديدة", "Nouveau")}</label><input id="sec-next" type="password" minlength="8" autocomplete="new-password"></div>
            <div class="field"><label>${ctx.dt("التأكيد", "Confirmer")}</label><input id="sec-confirm" type="password" autocomplete="new-password"></div>
          </div>
          <div class="btn-group" style="margin-top:10px"><button class="btn btn-primary" id="change-own-pwd">${ctx.icon("check")} ${ctx.dt("تغيير كلمة المرور", "Changer le mot de passe")}</button></div>
        </div></article>
        <article class="dash-card" style="margin-top:14px"><div class="dash-card-head"><h3>${ctx.dt("الجلسات النشطة", "Sessions actives")}</h3></div><div class="dash-card-body">
          <p class="form-note">${ctx.dt("سيتم عرض الجلسات قريباً مع إمكانية إلغاء الجلسات البعيدة", "Les sessions s'afficheront bientôt avec possibilité de révoquer les sessions distantes")}</p>
        </div></article>
      </div>`;
  }

  function paymentPanel() {
    return `<div class="dash-panel" data-dash-panel="profile-payment">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("طرق الدفع المفعلة", "Moyens de paiement actifs")}</h3></div><div class="dash-card-body">
          ${(ctx.model.settings.payments || [])
            .filter((p) => p.active !== false)
            .map(activePaymentRow)
            .join("")}
        </div></article>      </div>`;
  }

  /* ---------- team list ---------- */

  function managerInitials(manager) {
    if (manager.name)
      return String(ctx.lng(manager.name) || manager.username)
        .slice(0, 2)
        .toUpperCase();
    return String(manager.username).slice(0, 2).toUpperCase();
  }

  function managerDisplayName(manager) {
    if (ctx.lng(manager.name)) return ctx.lng(manager.name);
    return manager.username;
  }

  function managerBackground(manager) {
    if (manager.role === "owner") return "linear-gradient(135deg,#ff6400,#a72396)";
    return "#375e97";
  }

  function managerRoleLabel(manager) {
    if (manager.role === "owner") return ctx.dt("مالك", "Propriétaire");
    return ctx.dt("مدير", "Gérant");
  }

  function forcePasswordButton(manager) {
    if (manager.username === ctx.session?.username) return "";
    return `<button class="btn btn-sm btn-soft" data-action="force-password" data-id="${manager.id}">${ctx.dt("إلزام التغيير", "Forcer MDP")}</button>`;
  }

  function deleteManagerButton(manager) {
    const owners = ctx.R.managers.filter((item) => item.role === "owner").length;
    if (manager.role === "owner" && owners <= 1) return "";
    return `<button class="btn btn-sm btn-soft" data-action="delete-manager" data-id="${manager.id}">${ctx.icon("trash")}</button>`;
  }

  function managerStateBadge(manager) {
    if (manager.mustChange)
      return `<span class="badge-soft orange">${ctx.dt("تغيير كلمة المرور", "Changer MDP")}</span>`;
    return `<span class="badge-soft green">${ctx.dt("نشط", "Actif")}</span>`;
  }

  function managerCard(manager) {
    return `<article class="dash-card"><div class="dash-card-body"><div style="display:flex;align-items:center;gap:10px"><span class="dash-avatar" style="background:${managerBackground(manager)}">${ctx.esc(managerInitials(manager))}</span><div style="flex:1"><strong style="font-size:12px">${ctx.esc(managerDisplayName(manager))}</strong><br><small style="font-size:8px;color:var(--soft-muted)">@${ctx.esc(manager.username)} · ${managerRoleLabel(manager)}</small></div>${managerStateBadge(manager)}</div><div style="margin-top:11px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;gap:5px"><span style="font-size:8px;color:var(--soft-muted);direction:ltr">${ctx.esc(manager.whatsapp || "—")}</span><span style="flex:1"></span>${forcePasswordButton(manager)}<button class="btn btn-sm btn-soft" data-action="edit-manager" data-id="${manager.id}">${ctx.icon("edit")}</button>${deleteManagerButton(manager)}</div></div></article>`;
  }

  /** The manager row of the logged-in user, with a session-based fallback. */
  function currentManager() {
    const managers = ctx.R.managers || [];
    const found =
      managers.find((item) => item.id === ctx.session?.id) ||
      managers.find((item) => item.username === ctx.session?.username);
    if (found) return found;
    return {
      username: ctx.session?.username,
      name: { ar: ctx.session?.name, fr: ctx.session?.name },
      whatsapp: "",
      email: ""
    };
  }

  function usernameLabel() {
    if (ctx.R.remote) return ctx.dt("البريد الإلكتروني", "E-mail");
    return ctx.dt("اسم المستخدم", "Nom d'utilisateur");
  }

  function profileReadonlyAttributes() {
    return {
      username: ctx.R.remote || ctx.session?.role !== "owner" ? "readonly" : "",
      email: ctx.R.remote ? "readonly" : ""
    };
  }

  function roleLabel() {
    if (ctx.session?.role === "owner") return ctx.dt("المالك", "Propriétaire");
    return ctx.dt("مدير", "Gérant");
  }

  function remoteEmailNote() {
    if (!ctx.R.remote) return "";
    return `<p class="form-note">${ctx.dt("لتغيير بريد الدخول، استخدم لوحة Supabase > Authentication.", "Pour changer l’e-mail de connexion, utilisez Supabase > Authentication.")}</p>`;
  }

  function profileIdentityFields(currentUser) {
    const { username: readonlyAttr, email: emailReadonly } = profileReadonlyAttributes();
    return `<div class="form-grid">
              <div class="field"><label>${usernameLabel()}</label><input id="profile-username" value="${ctx.esc(ctx.session?.username || "")}" ${readonlyAttr} dir="ltr" autocomplete="username"></div>
              <div class="field"><label>${ctx.dt("الدور", "Rôle")}</label><input value="${roleLabel()}" readonly></div>
              <div class="field"><label>${ctx.dt("الاسم بالعربية", "Nom en arabe")}</label><input id="profile-name-ar" value="${ctx.esc(currentUser.name?.ar || "")}" dir="rtl"></div>
              <div class="field"><label>Nom en français</label><input id="profile-name-fr" value="${ctx.esc(currentUser.name?.fr || "")}" dir="ltr"></div>
              <div class="field"><label>${ctx.dt("البريد الإلكتروني للتواصل", "E-mail de contact")}</label><input id="profile-email" type="email" value="${ctx.esc(currentUser.email || "")}" ${emailReadonly} dir="ltr" autocomplete="email"></div>
              <div class="field"><label>${ctx.dt("واتساب", "WhatsApp")}</label><input id="profile-whatsapp" value="${ctx.esc(currentUser.whatsapp || "")}" dir="ltr" placeholder="222..." inputmode="tel"></div>
            </div>
            ${remoteEmailNote()}`;
  }

  function profileInfoCard(currentUser) {
    return `          <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("معلومات الحساب", "Informations du compte")}</h3></div><div class="dash-card-body dash-form">
            ${profileIdentityFields(currentUser)}
            <div class="btn-group" style="margin-top:10px"><button class="btn btn-primary" id="save-profile-info">${ctx.icon("check")} ${ctx.dt("حفظ المعلومات", "Enregistrer")}</button></div>
          </div></article>`;
  }

  function viewProfile() {
    const currentUser = currentManager();

    return `
      <div class="dash-view-head"><div><h2>${ctx.dt("ملفي الشخصي", "Mon profil")}</h2><p>${ctx.dt("إدارة معلومات الحساب والتواصل والدفع", "Gérer les informations du compte, contact et paiement")}</p></div></div>
      <div class="dash-tabs">
        ${profileTabs()}
      </div>

      <div class="dash-panel active" data-dash-panel="profile-info">
        <div class="dash-grid cols-2">
          ${profileInfoCard(currentUser)}
          ${avatarCard(currentUser)}
        </div>
      </div>

      ${ctx.session?.role === "owner" ? contactPanel() : ""}

      ${ctx.session?.role === "owner" ? socialPanel() : ""}

      ${securityPanel()}

      ${paymentPanel()}
`;
  }
  function viewTeam() {
    return `
      <div class="dash-view-head"><div><h2>${ctx.dt("الفريق", "Équipe")}</h2><p>${ctx.dt("صلاحيات المالك والمديرين.", "Accès propriétaire et gérants.")}</p></div><div class="dash-view-actions"><button class="btn btn-soft" data-action="change-own-password">${ctx.dt("كلمة مروري", "Mon mot de passe")}</button><button class="btn btn-primary" data-action="add-manager">${ctx.icon("plus")} ${ctx.dt("مدير جديد", "Nouveau gérant")}</button></div></div>
      <div class="dash-grid cols-2">
        ${ctx.R.managers.map(managerCard).join("")}
      </div>
      <article class="dash-card" style="margin-top:14px"><div class="dash-card-body"><h3 style="font-size:12px;margin-bottom:7px">${ctx.dt("نصائح الأمان", "Conseils de sécurité")}</h3><ul style="list-style:disc;padding-inline-start:17px;font-size:10px;color:var(--muted);line-height:1.9"><li>${ctx.dt("يُطلب من كل مدير تغيير كلمة المرور عند أول دخول.", "Chaque gérant doit changer son mot de passe à la première connexion.")}</li><li>${ctx.dt("استخدم Supabase Auth في الإنتاج بدل الحسابات المحلية.", "Utilisez Supabase Auth en production au lieu des comptes locaux.")}</li><li>${ctx.dt("راجع سجل النشاط بانتظام.", "Consultez régulièrement le journal d’activité.")}</li></ul></div></article>`;
  }

  ctx.pendingManagerId = null;
  /** Username field (local) or e-mail field (remote), plus the optional e-mail field in local mode. */
  function managerIdentityFields(manager, remote) {
    const email = ctx.esc(manager?.email || "");
    const emailField = `<div class="field"><label>${ctx.dt("البريد الإلكتروني (اختياري)", "E-mail (optionnel)")}</label><input id="manager-email" type="email" value="${email}" dir="ltr" placeholder="manager@example.com" autocomplete="off"></div>`;
    if (remote)
      return `<div class="field"><label>${ctx.dt("البريد الإلكتروني", "E-mail")}</label><input id="manager-email" type="email" value="${email}" ${manager ? "readonly" : ""} dir="ltr" placeholder="manager@example.com" autocomplete="off"></div>`;
    return `<div class="field"><label>${ctx.dt("اسم المستخدم", "Nom d’utilisateur")}</label><input id="manager-username" value="${ctx.esc(manager?.username || "")}" ${manager ? "readonly" : ""} dir="ltr" placeholder="manager2" autocomplete="off"></div>
         ${emailField}`;
  }

  function managerRoleField(manager) {
    const managerSelected = manager?.role === "owner" ? "" : "selected";
    const ownerSelected = manager?.role === "owner" ? "selected" : "";
    return `<div class="field"><label>${ctx.dt("الدور", "Rôle")}</label><select id="manager-role"><option value="manager" ${managerSelected}>${ctx.dt("مدير", "Gérant")}</option><option value="owner" ${ownerSelected}>${ctx.dt("مالك", "Propriétaire")}</option></select></div>`;
  }

  function managerNote(remote) {
    if (remote)
      return ctx.dt(
        "يُنشأ الحساب في Supabase عبر دالة المالك الآمنة. سيُطلب من المدير تغيير كلمة المرور عند أول دخول. لا يمكن تغيير البريد بعد الإنشاء من هنا.",
        "Le compte est créé dans Supabase via la fonction sécurisée du propriétaire. Le gérant devra changer son mot de passe à la première connexion. L’e-mail ne peut plus être modifié ici."
      );
    return ctx.dt(
      "سيُطلب من المدير الجديد تغيير كلمة المرور عند أول دخول.",
      "Le nouveau gérant devra changer son mot de passe à la première connexion."
    );
  }

  function managerPasswordField(manager) {
    if (manager) return "";
    return `<div class="field"><label>${ctx.dt("كلمة مرور مؤقتة (8 أحرف على الأقل)", "Mot de passe temporaire (8 caractères min.)")}</label><input id="manager-password" type="password" minlength="8" placeholder="********" autocomplete="new-password"></div>`;
  }

  function managerEditorHTML(manager, remote) {
    return `
      <div class="form-grid">
        ${managerIdentityFields(manager, remote)}
        ${managerRoleField(manager)}
        <div class="field"><label>${ctx.dt("الاسم بالعربية", "Nom en arabe")}</label><input id="manager-name-ar" value="${ctx.esc(manager?.name?.ar || "")}" dir="rtl"></div>
        <div class="field"><label>Nom en français</label><input id="manager-name-fr" value="${ctx.esc(manager?.name?.fr || "")}" dir="ltr"></div>
        <div class="field"><label>WhatsApp</label><input id="manager-whatsapp" value="${ctx.esc(manager?.whatsapp || "")}" dir="ltr" placeholder="222..." inputmode="tel"></div>
        ${managerPasswordField(manager)}
      </div>
      <p class="form-note" style="margin-top:10px">${managerNote(remote)}</p>`;
  }

  const MANAGER_MODAL_FOOTER = `<button class="btn btn-soft btn-sm" data-action="close-modal">${ctx.dt("إلغاء", "Annuler")}</button><button class="btn btn-primary btn-sm" data-action="save-manager">${ctx.dt("حفظ", "Enregistrer")}</button>`;

  function managerEditor(id) {
    const manager = id ? ctx.R.managers.find((item) => item.id === id) : null;
    ctx.pendingManagerId = id || null;
    const remote = Boolean(ctx.R.remote);
    ctx.openModal(
      manager ? ctx.lng(manager.name) : ctx.dt("مدير جديد", "Nouveau gérant"),
      managerEditorHTML(manager, remote),
      { footer: MANAGER_MODAL_FOOTER }
    );
  }

  /** Reads the manager modal fields. */
  function readManagerForm() {
    return {
      username: ctx.$("#manager-username")?.value.trim() || "",
      email: ctx.$("#manager-email")?.value.trim().toLowerCase() || "",
      role: ctx.$("#manager-role")?.value === "owner" ? "owner" : "manager",
      nameAr: ctx.$("#manager-name-ar")?.value.trim(),
      nameFr: ctx.$("#manager-name-fr")?.value.trim(),
      whatsapp: ctx.$("#manager-whatsapp")?.value.trim()
    };
  }

  /** Localised validation for a new manager; returns the temporary password. */
  function assertNewManager(form) {
    const password = ctx.$("#manager-password")?.value || "";
    if (password.length < 8)
      throw new Error(ctx.dt("كلمة المرور 8 أحرف على الأقل", "Mot de passe : 8 caractères minimum"));
    if (ctx.R.remote && !form.email)
      throw new Error(
        ctx.dt("البريد الإلكتروني مطلوب لإنشاء حساب Supabase", "L’e-mail est requis pour un compte Supabase")
      );
    if (!ctx.R.remote && !form.username)
      throw new Error(ctx.dt("اسم المستخدم مطلوب", "Le nom d’utilisateur est requis"));
    return password;
  }

  async function createManager(form) {
    const password = assertNewManager(form);
    const created = await ctx.R.addManager({
      username: form.username || form.email,
      email: form.email,
      password,
      nameAr: form.nameAr,
      nameFr: form.nameFr,
      role: form.role,
      whatsapp: form.whatsapp
    });
    if (!ctx.R.remote) ctx.model = ctx.clone(ctx.R.state);
    ctx.R.addAudit(
      `${ctx.dt("إضافة مدير", "Gérant ajouté")}: ${created?.email || created?.username || form.email || form.username}`
    );
  }

  /** Refuses to demote the last remaining owner. */
  function assertOwnerRemains(current, role) {
    const owners = ctx.R.managers.filter((item) => item.role === "owner").length;
    if (current?.role === "owner" && role !== "owner" && owners <= 1)
      throw new Error(ctx.dt("لا يمكن إزالة صلاحية المالك الوحيد", "Impossible de retirer le dernier propriétaire"));
  }

  /** Patch applied to an edited manager (email only in local demo mode). */
  function managerPatch(form, fallback) {
    const patch = {
      name: { ar: form.nameAr || form.nameFr || fallback, fr: form.nameFr || form.nameAr || fallback },
      role: form.role,
      whatsapp: form.whatsapp
    };
    if (!ctx.R.remote && form.email) patch.email = form.email;
    return patch;
  }

  function updateManager(form) {
    const current = ctx.R.managers.find((item) => item.id === ctx.pendingManagerId);
    assertOwnerRemains(current, form.role);
    const fallback = current?.username || "";
    ctx.R.updateManager(ctx.pendingManagerId, managerPatch(form, fallback));
    ctx.R.addAudit(`${ctx.dt("تعديل مدير", "Gérant modifié")}: ${fallback}`);
  }

  async function saveManager() {
    const form = readManagerForm();
    try {
      if (ctx.pendingManagerId) updateManager(form);
      else await createManager(form);
      if (ctx.R.remote) await ctx.R.refreshStaff().catch(() => {});
      ctx.closeModal();
      ctx.renderRoute();
      ctx.toast(ctx.dt("تم حفظ الفريق", "Équipe enregistrée"), "good");
    } catch (error) {
      ctx.toast(error.message, "error");
    }
  }

  function changeOwnPasswordModal() {
    ctx.openModal(
      ctx.dt("تغيير كلمة المرور", "Changer le mot de passe"),
      `
      <div class="dash-form">
        <div class="field"><label>${ctx.dt("كلمة المرور الحالية", "Mot de passe actuel")}</label><input id="own-current" type="password"></div>
        <div class="form-grid"><div class="field"><label>${ctx.dt("الجديدة", "Nouveau")}</label><input id="own-next" type="password" minlength="8"></div><div class="field"><label>${ctx.dt("التأكيد", "Confirmer")}</label><input id="own-confirm" type="password"></div></div>
        <div class="field"><label>WhatsApp</label><input id="own-whatsapp" value="${ctx.esc(ctx.R.managers.find((item) => item.username === ctx.session?.username)?.whatsapp || "")}" dir="ltr"></div>
      </div>`,
      {
        footer: `<button class="btn btn-soft btn-sm" data-action="close-modal">${ctx.dt("إلغاء", "Annuler")}</button><button class="btn btn-primary btn-sm" data-action="save-own-password">${ctx.dt("حفظ", "Enregistrer")}</button>`
      }
    );
  }

  async function submitOwnPassword(current, next, whatsapp) {
    await ctx.R.changePassword(ctx.session.username, current, next, whatsapp);
    ctx.session = ctx.R.currentSession();
    ctx.closeModal();
    ctx.toast(ctx.dt("تم تحديث كلمة المرور", "Mot de passe mis à jour"), "good");
  }

  /** Returns the new password when both fields match, otherwise null (after a toast). */
  function readOwnPassword() {
    const next = ctx.$("#own-next")?.value || "";
    const repeat = ctx.$("#own-confirm")?.value || "";
    if (next === repeat) return next;
    ctx.toast(ctx.dt("كلمتا المرور غير متطابقتين", "Les mots de passe diffèrent"), "error");
    return null;
  }

  async function saveOwnPassword() {
    const next = readOwnPassword();
    if (!next) return;
    try {
      await submitOwnPassword(ctx.$("#own-current")?.value || "", next, ctx.$("#own-whatsapp")?.value || "");
    } catch (error) {
      ctx.toast(error.message, "error");
    }
  }
}
