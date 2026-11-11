// @ts-check
/* dashboard.js → Authentication screens
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { renderLogin, renderPasswordChange });
  function renderLogin() {
    ctx.session = null;
    ctx.app.innerHTML = `
      <div class="dash-login">
        <section class="login-brand">
          <div>
            <a class="logo" href="index.html"><img src="${ctx.esc(ctx.model.settings.logoWhite || "assets/img/brand-logo-white.svg")}" alt="${ctx.esc(ctx.model.settings.storeName?.[ctx.dashLang] || "")}"></a>
            <h1>${ctx.dt("أدر متجرك من مكان واحد.", "Gérez votre boutique depuis un seul endroit.")}</h1>
            <p>${ctx.dt("الطلبات، المنتجات، المحتوى، الألوان، العروض والتقارير — كل شيء متصل بالمتجر مباشرة.", "Commandes, produits, contenu, couleurs, offres et rapports — tout est connecté à la boutique en direct.")}</p>
            <div class="login-features">
              <span>${ctx.dt("نشر فوري", "Publication instantanée")}</span>
              <span>${ctx.dt("عربي / فرنسي", "Arabe / Français")}</span>
              <span>${ctx.dt("Supabase", "Supabase")}</span>
              <span>PWA</span>
            </div>
          </div>
          <footer>${ctx.esc((window.BRAND?.legalName || window.BRAND?.name || {})[ctx.dashLang] || "")} · ${new Date().getFullYear()}</footer>
        </section>
        <section class="login-panel">
          <div class="login-card">
            <div class="login-lang">
              <button type="button" data-dash-lang="ar" class="${ctx.dashLang === "ar" ? "active" : ""}">العربية</button>
              <button type="button" data-dash-lang="fr" class="${ctx.dashLang === "fr" ? "active" : ""}">Français</button>
            </div>
            <h2>${ctx.dt("تسجيل الدخول", "Connexion")}</h2>
            <p>${ctx.dt("ادخل إلى لوحة تحكم متجرك.", "Accédez au tableau de bord de votre boutique.")}</p>
            <form id="login-form">
              <div class="field"><label>${ctx.dt("البريد الإلكتروني أو اسم المستخدم", "E-mail ou identifiant")}</label><input name="username" type="text" autocomplete="username" required autofocus placeholder="owner@example.com"></div>
              <div class="field"><label>${ctx.dt("كلمة المرور", "Mot de passe")}</label><input name="password" type="password" autocomplete="current-password" required></div>
              <div class="login-error" id="login-error"></div>
              <button class="btn btn-primary" type="submit">${ctx.dt("دخول", "Se connecter")}</button>
            </form>

          </div>
        </section>
      </div>`;
    ctx.$("#login-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const error = ctx.$("#login-error");
      error.textContent = "";
      try {
        await ctx.R.login(data.get("username"), data.get("password"));
        ctx.session = ctx.R.currentSession();
        ctx.R.addAudit(ctx.dt("تسجيل دخول إلى لوحة التحكم", "Connexion au tableau de bord"), ctx.session?.username);
        if (ctx.session?.mustChange) renderPasswordChange();
        else ctx.renderShell();
      } catch (err) {
        error.textContent = err.message || String(err);
      }
    });
  }

  function renderPasswordChange() {
    ctx.app.innerHTML = `
      <div class="dash-login">
        <section class="login-brand">
          <div>
            <a class="logo" href="index.html"><img src="${ctx.esc(ctx.model.settings.logoWhite || "assets/img/brand-logo-white.svg")}" alt="${ctx.esc(ctx.model.settings.storeName?.[ctx.dashLang] || "")}"></a>
            <h1>${ctx.dt("أمّن متجرك أولًا.", "Sécurisez votre boutique.")}</h1>
            <p>${ctx.dt("يجب تغيير كلمة المرور الافتراضية وربط رقم واتساب قبل استعمال لوحة التحكم.", "Changez le mot de passe par défaut et associez un numéro WhatsApp avant d’utiliser le tableau de bord.")}</p>
          </div>
          <footer>${ctx.dt("خطوة إلزامية", "Étape obligatoire")}</footer>
        </section>
        <section class="login-panel">
          <div class="login-card">
            <span class="badge-soft orange">${ctx.dt("أول تسجيل دخول", "Première connexion")}</span>
            <h2 class="u-mt-10">${ctx.dt("تغيير كلمة المرور", "Changer le mot de passe")}</h2>
            <p>${ctx.dt("الحساب", "Compte")}: <strong>${ctx.esc(ctx.session?.username || "")}</strong></p>
            <form id="password-form">
              <div class="field"><label>${ctx.dt("كلمة المرور الحالية", "Mot de passe actuel")}</label><input name="current" type="password" required></div>
              <div class="field"><label>${ctx.dt("كلمة المرور الجديدة", "Nouveau mot de passe")}</label><input name="next" type="password" minlength="8" required></div>
              <div class="field"><label>${ctx.dt("تأكيد كلمة المرور", "Confirmer le mot de passe")}</label><input name="confirm" type="password" minlength="8" required></div>
              <div class="field"><label>${ctx.dt("رقم واتساب المتجر / المدير", "WhatsApp de la boutique / du gérant")}</label><input name="whatsapp" inputmode="tel" placeholder="22246000000" dir="ltr" required value="${ctx.esc(ctx.model.settings.whatsapp || "")}"></div>
              <div class="field"><label>${ctx.dt("طرق الدفع المطلوبة", "Méthodes de paiement obligatoires")}</label>
                <div class="setup-form u-mt-8">
                  ${(ctx.model.settings.payments || [])
                    .map(
                      (p, i) => `
                    <label class="toggle-card ${p.active !== false ? "active" : ""}" data-payment="${i}">
                      <input type="checkbox" ${p.active !== false ? "checked" : ""}>
                      <div><strong>${ctx.esc(ctx.lng(p.name))}</strong><small>${p.discount ? ctx.dt("خصم ", "Réduction ") + p.discount + "%" : ""}</small></div>
                    </label>
                  `
                    )
                    .join("")}
                </div>
                <p class="form-note">${ctx.dt("اختر على الأقل طريقة دفع واحدة", "Sélectionnez au moins un moyen de paiement")}</p>
              </div>
              <div class="login-error" id="password-error"></div>
              <button class="btn btn-primary" type="submit">${ctx.dt("حفظ ومتابعة", "Enregistrer et continuer")}</button>
            </form>
          </div>
        </section>
      </div>`;
    ctx.$("#logout-must")?.addEventListener("click", () => {
      ctx.R.logout();
      renderLogin();
    });
    ctx.$("#password-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const error = ctx.$("#password-error");
      error.textContent = "";
      if (data.get("next") !== data.get("confirm")) {
        error.textContent = ctx.dt("كلمتا المرور غير متطابقتين", "Les mots de passe ne correspondent pas");
        return;
      }
      if (String(data.get("next")).length < 8) {
        error.textContent = ctx.dt("8 أحرف على الأقل", "8 caractères minimum");
        return;
      }
      try {
        await ctx.R.changePassword(ctx.session.username, data.get("current"), data.get("next"), data.get("whatsapp"));
        ctx.session = ctx.R.currentSession();
        ctx.model = ctx.clone(ctx.R.state);
        ctx.R.addAudit(ctx.dt("غيّر كلمة المرور", "Mot de passe modifié"), ctx.session?.username);
        ctx.toast(ctx.dt("تم تحديث كلمة المرور", "Mot de passe mis à jour"), "good");
        ctx.renderShell();
      } catch (err) {
        error.textContent = err.message || String(err);
      }
    });
  }
}
