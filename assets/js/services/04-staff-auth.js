// @ts-check
/* state.js → Managers and staff sessions
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */

export function install(ctx) {
  Object.assign(ctx, {
    demoAccount,
    managerById,
    managerByIdentifier,
    managerPublic,
    saveManagers,
    createLocalManagerPassword,
    verifyManagerPassword,
    upgradeDemoHash,
    attemptStore,
    checkLoginLock,
    noteLoginFailure,
    clearLoginFailures,
    localSessionFor,
    persistSession,
    staffEmailFor,
    remoteLogin,
    login,
    currentSession,
    logout,
    normalizeStaffRow,
    refreshStaff,
    addManager,
    updateManager,
    deleteManager,
    changePassword,
    changeOwnerPassword
  });
  function demoAccount(owner) {
    return {
      id: owner ? "m_owner" : "m_manager",
      username: owner ? "owner" : "manager",
      email: owner ? "owner@restore.local" : "manager@restore.local",
      name: owner
        ? ctx.txt("مالك المتجر (تجريبي)", "Propriétaire (démo)")
        : ctx.txt("مدير المتجر (تجريبي)", "Gérant (démo)"),
      displayName: owner ? ctx.txt("المالك", "Propriétaire") : ctx.txt("المدير", "Gérant"),
      role: owner ? "owner" : "manager",
      passwordHash: "",
      mustChange: true,
      whatsapp: "",
      avatar: ""
    };
  }
  const DEFAULT_MANAGERS = ctx.DEMO_ALLOWED ? [demoAccount(true), demoAccount(false)] : [];

  const savedManagers = ctx.readJSON(ctx.LS_MANAGERS, null);
  ctx.managers = Array.isArray(savedManagers) && savedManagers.length ? savedManagers : ctx.clone(DEFAULT_MANAGERS);
  if (!ctx.REMOTE && !ctx.DEMO_ALLOWED && Array.isArray(ctx.managers) && ctx.managers.length) {
    // Production/local-secure mode: never keep passwordless demo accounts.
    ctx.managers = ctx.managers.filter((m) => m && m.passwordHash);
    if (!ctx.managers.length) localStorage.removeItem(ctx.LS_MANAGERS);
    else ctx.writeJSON(ctx.LS_MANAGERS, ctx.managers);
  }
  ctx.session = ctx.readSessionMeta();
  // Supabase tokens are never persisted; after reload a remote session must re-authenticate.
  if (ctx.session?.mode === "supabase") {
    ctx.session = null;
    ctx.writeSessionMeta(null);
  }
  if (ctx.session?.mode === "local" && !ctx.DEMO_ALLOWED && !ctx.REMOTE) {
    ctx.session = null;
    ctx.writeSessionMeta(null);
  }
  ctx.customerAuth = ctx.readJSON(ctx.LS_CUSTOMER_SESSION, null);
  ctx.currentCustomer = ctx.readJSON(ctx.LS_CUSTOMER, null);
  ctx.reviewCache = [];
  ctx.setupIdleLogout();

  function managerById(id) {
    return ctx.managers.find((item) => item.id === id) || null;
  }
  function managerByIdentifier(identifier) {
    const needle = String(identifier || "")
      .trim()
      .toLowerCase();
    if (!needle) return null;
    return (
      ctx.managers.find((item) =>
        [item.username, item.email, item.id].filter(Boolean).some((value) => String(value).toLowerCase() === needle)
      ) || null
    );
  }
  function managerPublic() {
    return ctx.managers.map(({ passwordHash: _passwordHash, ...item }) => ctx.clone(item));
  }
  function saveManagers() {
    ctx.writeJSON(ctx.LS_MANAGERS, ctx.managers);
  }
  async function createLocalManagerPassword(manager, password) {
    if (!manager) return false;
    if (!ctx.DEMO_ALLOWED && !ctx.REMOTE)
      throw new Error("الوضع التجريبي المحلي غير مفعّل. فعّل demoEnabled على localhost فقط أو استخدم Supabase.");
    ctx.validatePassword(password);
    manager.passwordHash = await ctx.hashPassword(password);
    manager.mustChange = false;
    saveManagers();
    return true;
  }
  async function verifyManagerPassword(manager, password) {
    if (!manager) return false;
    if (manager.passwordHash) return ctx.verifyPassword(password, manager.passwordHash);
    if (ctx.DEMO_ALLOWED && manager.mustChange && String(password || "").length >= 8) {
      // First local demo setup: user chooses the password (never shipped in code).
      await createLocalManagerPassword(manager, password);
      return true;
    }
    return false;
  }
  async function upgradeDemoHash(manager, password) {
    if (!manager || manager.passwordHash) return;
    manager.passwordHash = await ctx.hashPassword(password);
    saveManagers();
  }

  function attemptStore() {
    return ctx.readJSON(ctx.LS_LOGIN_ATTEMPTS, {});
  }
  function checkLoginLock(identifier) {
    const key = ctx.normalizeEmail(identifier);
    const record = attemptStore()[key];
    if (!record) return;
    if (Number(record.lockedUntil || 0) > Date.now()) {
      const minutes = Math.max(1, Math.ceil((record.lockedUntil - Date.now()) / 60000));
      throw new Error(
        `تم إيقاف المحاولات مؤقتًا. أعد المحاولة بعد ${minutes} دقيقة / Trop de tentatives. Réessayez dans ${minutes} min`
      );
    }
  }
  function noteLoginFailure(identifier) {
    const key = ctx.normalizeEmail(identifier);
    const store = attemptStore();
    const record = store[key] || { count: 0, firstAt: Date.now(), lockedUntil: 0 };
    if (Date.now() - Number(record.firstAt || 0) > 15 * 60000) {
      record.count = 0;
      record.firstAt = Date.now();
      record.lockedUntil = 0;
    }
    record.count = Number(record.count || 0) + 1;
    if (record.count >= 5) {
      record.lockedUntil = Date.now() + 5 * 60000;
      record.count = 0;
      record.firstAt = Date.now();
    }
    store[key] = record;
    const keys = Object.keys(store).slice(-30);
    ctx.writeJSON(ctx.LS_LOGIN_ATTEMPTS, Object.fromEntries(keys.map((item) => [item, store[item]])));
  }
  function clearLoginFailures(identifier) {
    const store = attemptStore();
    delete store[ctx.normalizeEmail(identifier)];
    ctx.writeJSON(ctx.LS_LOGIN_ATTEMPTS, store);
  }

  function localSessionFor(manager) {
    return {
      mode: "local",
      id: manager.id,
      username: manager.username,
      email: manager.email || "",
      role: manager.role === "owner" ? "owner" : "manager",
      name: ctx.L(manager.name || manager.displayName || manager.username),
      mustChange: Boolean(manager.mustChange),
      loggedAt: Date.now(),
      expiresAt: Date.now() + 12 * 3600 * 1000
    };
  }
  function persistSession(next) {
    if (next) {
      ctx.tokenVault.accessToken = next.accessToken || ctx.tokenVault.accessToken || "";
      ctx.tokenVault.refreshToken = next.refreshToken || ctx.tokenVault.refreshToken || "";
      ctx.session = { ...next, accessToken: ctx.tokenVault.accessToken, refreshToken: ctx.tokenVault.refreshToken };
      ctx.writeSessionMeta(ctx.sessionMetaOf(ctx.session));
    } else {
      ctx.tokenVault.accessToken = "";
      ctx.tokenVault.refreshToken = "";
      ctx.session = null;
      ctx.writeSessionMeta(null);
      ctx.clearSessionTimers();
    }
    ctx.scheduleSessionRefresh();
  }

  function staffEmailFor(identifier) {
    const value = String(identifier || "").trim();
    if (ctx.isEmail(value)) return ctx.normalizeEmail(value);
    const lower = value.toLowerCase();
    if (ctx.DEMO_ALLOWED && (lower === "owner" || lower === "manager")) return `${lower}@restore.local`;
    // username login → e-mail on the merchant's staff domain (BRAND.staffEmailDomain, defaults to the contact e-mail domain)
    const domain = window.BRAND?.staffEmailDomain || String(window.BRAND?.email || "").split("@")[1] || "example.com";
    return `${lower}@${domain}`;
  }

  async function remoteLogin(identifier, password) {
    const email = staffEmailFor(identifier);
    const res = await fetch(ctx.remoteUrl("/auth/v1/token?grant_type=password"), {
      method: "POST",
      headers: { apikey: ctx.CFG.supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error("بيانات الدخول غير صحيحة / Identifiants incorrects");
    const data = await res.json();
    const token = data.access_token;
    if (!token || !data.user) throw new Error("تعذر إنشاء جلسة الدخول");
    const rows = await ctx.supa(
      `/rest/v1/${ctx.CFG.staffTable}?auth_id=eq.${encodeURIComponent(data.user.id)}&select=*`,
      {},
      { token }
    );
    const staff = Array.isArray(rows) ? rows[0] : null;
    if (!staff || staff.active === false) {
      throw new Error("هذا الحساب لا يملك صلاحية دخول لوحة التحكم. راجع مالك المتجر. / Compte non autorisé.");
    }
    const next = {
      mode: "supabase",
      id: staff.id,
      authId: data.user.id,
      username: staff.email || data.user.email,
      email: staff.email || data.user.email,
      role: staff.role === "owner" ? "owner" : "manager",
      name: ctx.L(staff.name || data.user.user_metadata?.full_name || data.user.email),
      mustChange: Boolean(staff.must_change_password ?? data.user.user_metadata?.must_change_password),
      accessToken: token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
      loggedAt: Date.now()
    };
    persistSession(next);
    ctx.managers = [normalizeStaffRow(staff)];
    refreshStaff().catch(() => {});
    return ctx.session;
  }

  async function login(identifier, password) {
    const value = String(identifier || "").trim();
    if (!value || !password) throw new Error("أدخل البريد/اسم المستخدم وكلمة المرور");
    if (!ctx.REMOTE && !ctx.DEMO_ALLOWED) {
      throw new Error(
        "الوضع المحلي الآمن يتطلب Supabase. للتجربة المحلية فقط: شغّل على localhost واضبط demoEnabled:true في config.js / Mode démo local désactivé."
      );
    }
    checkLoginLock(value);
    try {
      if (ctx.REMOTE) {
        const result = await remoteLogin(value, password);
        clearLoginFailures(value);
        return result;
      }
      let manager = managerByIdentifier(value);
      if (!manager && ctx.DEMO_ALLOWED) {
        const lower = value.toLowerCase();
        if (lower === "owner" || lower === "manager") {
          ctx.managers = ctx.managers.length ? ctx.managers : ctx.clone(DEFAULT_MANAGERS);
          manager = managerByIdentifier(value);
        }
      }
      if (!manager) throw new Error("اسم المستخدم أو البريد غير موجود / Utilisateur introuvable");
      if (!(await verifyManagerPassword(manager, password)))
        throw new Error("كلمة المرور غير صحيحة / Mot de passe incorrect");
      await upgradeDemoHash(manager, password);
      persistSession(localSessionFor(manager));
      clearLoginFailures(value);
      return ctx.session;
    } catch (error) {
      noteLoginFailure(value);
      throw error;
    }
  }

  function currentSession() {
    if (!ctx.session) return null;
    if (ctx.session.expiresAt && Number(ctx.session.expiresAt) <= Date.now() && ctx.session.mode === "local") {
      logout();
      return null;
    }
    return ctx.session;
  }
  function logout() {
    persistSession(null);
    window.dispatchEvent(new CustomEvent("restore:logout"));
  }

  function normalizeStaffRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      authId: row.auth_id || "",
      username: row.email || "",
      email: row.email || "",
      name: row.name || ctx.txt(row.email || "", row.email || ""),
      role: row.role === "owner" ? "owner" : "manager",
      whatsapp: row.whatsapp || "",
      avatar: row.avatar || "",
      active: row.active !== false,
      mustChange: Boolean(row.must_change_password),
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    };
  }

  async function refreshStaff() {
    if (!ctx.REMOTE || ctx.session?.mode !== "supabase") return managerPublic();
    if (!(await ctx.remoteSessionValid())) return managerPublic();
    const rows = await ctx.supa(`/rest/v1/${ctx.CFG.staffTable}?select=*&order=created_at.asc`, {}, true);
    if (Array.isArray(rows) && rows.length) {
      ctx.managers = rows.map(normalizeStaffRow).filter(Boolean);
      saveManagers();
      window.dispatchEvent(new CustomEvent("restore:staff"));
    }
    return managerPublic();
  }

  async function addManager(data = {}) {
    if (ctx.session && ctx.session.role !== "owner")
      throw new Error("إضافة الحسابات متاحة للمالك فقط / Réservé au propriétaire");
    const role = data.role === "owner" ? "owner" : "manager";
    const name = {
      ar: String(data.nameAr || data.name || "").trim() || String(data.email || data.username || "").trim(),
      fr: String(data.nameFr || data.name || "").trim() || String(data.email || data.username || "").trim()
    };
    const whatsapp = ctx.normalizeDigits(data.whatsapp || "");
    ctx.validatePassword(data.password || "");
    if (whatsapp && ![8, 11].includes(whatsapp.length)) throw new Error("رقم واتساب غير صالح");

    if (ctx.REMOTE) {
      if (ctx.session?.mode !== "supabase" || ctx.session.role !== "owner")
        throw new Error("إضافة الحسابات متاحة للمالك فقط");
      const email = ctx.normalizeEmail(data.email || data.username);
      if (!ctx.isEmail(email)) throw new Error("أدخل بريدًا إلكترونيًا صالحًا للمدير");
      const res = await fetch(
        ctx.remoteUrl(`/functions/v1/${encodeURIComponent(ctx.CFG.createStaffFunction || "admin-create-staff")}`),
        {
          method: "POST",
          headers: {
            apikey: ctx.CFG.supabaseAnonKey,
            Authorization: `Bearer ${ctx.session.accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, password: data.password, name, role, whatsapp })
        }
      );
      if (res.status === 404)
        throw new Error("دالة إنشاء المديرين غير منشورة. راجع supabase/README.md لنشر admin-create-staff.");
      if (!res.ok) {
        const message = await ctx.readErrorMessage(res);
        throw new Error(message || "تعذر إنشاء حساب المدير");
      }
      await refreshStaff();
      ctx.addAudit(`أضاف مديرًا: ${email}`, ctx.session.email);
      return ctx.managers.find((item) => item.email === email) || null;
    }

    const username = String(data.username || data.email || "")
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9._@-]{3,64}$/.test(username)) throw new Error("اسم المستخدم أو البريد غير صالح");
    if (
      ctx.managers.some((item) =>
        [item.username, item.email].filter(Boolean).some((value) => String(value).toLowerCase() === username)
      )
    ) {
      throw new Error("اسم المستخدم مستخدم بالفعل");
    }
    const manager = {
      id: ctx.uid("m"),
      username,
      email: ctx.isEmail(username) ? username : "",
      name,
      displayName: name,
      role,
      passwordHash: await ctx.hashPassword(data.password),
      mustChange: true,
      whatsapp,
      avatar: ""
    };
    ctx.managers.push(manager);
    saveManagers();
    ctx.addAudit(`أضاف مديرًا: ${username}`, ctx.session?.username);
    return manager;
  }

  function updateManager(id, patch = {}) {
    const index = ctx.managers.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("الحساب غير موجود");
    if (ctx.session && ctx.session.role !== "owner") {
      const isSelf = ctx.session.id === id || ctx.session.username === ctx.managers[index].username;
      if (!isSelf) throw new Error("تعديل الحسابات الأخرى متاح للمالك فقط");
      patch = { ...patch };
      delete patch.role;
      delete patch.mustChange;
      delete patch.active;
    }
    if (
      ctx.managers[index].role === "owner" &&
      patch.role &&
      patch.role !== "owner" &&
      ctx.managers.filter((item) => item.role === "owner").length <= 1
    ) {
      throw new Error("لا يمكن إزالة صلاحية المالك الوحيد");
    }
    ctx.managers[index] = {
      ...ctx.managers[index],
      ...patch,
      name: patch.name || ctx.managers[index].name,
      role: patch.role === "owner" ? "owner" : patch.role === "manager" ? "manager" : ctx.managers[index].role,
      mustChange: patch.mustChange != null ? Boolean(patch.mustChange) : ctx.managers[index].mustChange
    };
    saveManagers();
    if (ctx.REMOTE && ctx.session?.mode === "supabase") {
      const body = {};
      if (patch.name) body.name = patch.name;
      if (patch.role) body.role = patch.role === "owner" ? "owner" : "manager";
      if (patch.whatsapp != null) body.whatsapp = ctx.normalizeDigits(patch.whatsapp);
      if (patch.mustChange != null) body.must_change_password = Boolean(patch.mustChange);
      if (patch.active != null) body.active = Boolean(patch.active);
      if (patch.avatar != null) body.avatar = String(patch.avatar);
      if (Object.keys(body).length) {
        ctx
          .supa(
            `/rest/v1/${ctx.CFG.staffTable}?id=eq.${encodeURIComponent(id)}`,
            {
              method: "PATCH",
              body: JSON.stringify(body),
              headers: { Prefer: "return=minimal" }
            },
            true
          )
          .catch((error) => {
            console.warn("Restore: staff update failed", error);
            refreshStaff().catch(() => {});
          });
      }
    }
    return ctx.managers[index];
  }

  function deleteManager(id) {
    if (ctx.session && ctx.session.role !== "owner")
      throw new Error("حذف الحسابات متاح للمالك فقط / Réservé au propriétaire");
    const manager = ctx.managers.find((item) => item.id === id);
    if (!manager) return;
    if (manager.role === "owner" && ctx.managers.filter((item) => item.role === "owner").length <= 1)
      throw new Error("لا يمكن حذف المالك الوحيد");
    ctx.managers = ctx.managers.filter((item) => item.id !== id);
    saveManagers();
    if (ctx.REMOTE && ctx.session?.mode === "supabase") {
      ctx
        .supa(`/rest/v1/${ctx.CFG.staffTable}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }, true)
        .catch((error) => {
          console.warn("Restore: staff delete failed", error);
          refreshStaff().catch(() => {});
        });
    }
    ctx.addAudit(`حذف مديرًا: ${manager.username}`, ctx.session?.username);
  }

  async function changePassword(username, currentPassword, newPassword, whatsapp) {
    ctx.validatePassword(newPassword);
    if (String(currentPassword) === String(newPassword)) throw new Error("اختر كلمة مرور مختلفة عن الحالية");
    const cleanWhatsapp = ctx.normalizeDigits(whatsapp || "");
    if (cleanWhatsapp && ![8, 11].includes(cleanWhatsapp.length)) throw new Error("رقم واتساب غير صالح");

    if (ctx.REMOTE) {
      if (ctx.session?.mode !== "supabase" || !ctx.session.email) throw new Error("سجّل الدخول أولًا");
      const check = await fetch(ctx.remoteUrl("/auth/v1/token?grant_type=password"), {
        method: "POST",
        headers: { apikey: ctx.CFG.supabaseAnonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email: ctx.session.email, password: currentPassword })
      });
      if (!check.ok) throw new Error("كلمة المرور الحالية غير صحيحة");
      const res = await fetch(ctx.remoteUrl("/auth/v1/user"), {
        method: "PUT",
        headers: {
          apikey: ctx.CFG.supabaseAnonKey,
          Authorization: `Bearer ${ctx.session.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password: newPassword, data: { must_change_password: false } })
      });
      if (!res.ok) throw new Error((await ctx.readErrorMessage(res)) || "تعذر تحديث كلمة المرور");
      await ctx
        .supa(
          `/rest/v1/${ctx.CFG.staffTable}?auth_id=eq.${encodeURIComponent(ctx.session.authId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ must_change_password: false, whatsapp: cleanWhatsapp }),
            headers: { Prefer: "return=minimal" }
          },
          true
        )
        .catch(() => {});
      const own = ctx.managers.find((item) => item.id === ctx.session.id || item.email === ctx.session.email);
      if (own) {
        own.mustChange = false;
        if (cleanWhatsapp) own.whatsapp = cleanWhatsapp;
        saveManagers();
      }
      persistSession({ ...ctx.session, mustChange: false });
    } else {
      const manager = managerByIdentifier(username) || managerById(ctx.session?.id);
      if (!manager) throw new Error("المستخدم غير موجود");
      if (!(await verifyManagerPassword(manager, currentPassword))) throw new Error("كلمة المرور الحالية غير صحيحة");
      manager.passwordHash = await ctx.hashPassword(newPassword);
      manager.mustChange = false;
      if (cleanWhatsapp) manager.whatsapp = cleanWhatsapp;
      saveManagers();
      persistSession({ ...(ctx.session || localSessionFor(manager)), mustChange: false });
    }

    if (cleanWhatsapp) {
      const phone = cleanWhatsapp.length === 8 ? `+222${cleanWhatsapp}` : `+${cleanWhatsapp}`;
      try {
        await ctx.updateOwnerSettings({ whatsapp: cleanWhatsapp, phone, phoneDisplay: ctx.formatPhone(phone) });
      } catch (error) {
        console.warn("Restore: could not update store WhatsApp", error);
      }
    }
    ctx.addAudit("غيّر كلمة المرور", ctx.session?.username);
    return ctx.session;
  }

  function changeOwnerPassword(currentPassword, newPassword) {
    return changePassword(ctx.session?.username || "owner", currentPassword, newPassword, "");
  }
  Object.assign(ctx, { DEFAULT_MANAGERS, savedManagers });
}
