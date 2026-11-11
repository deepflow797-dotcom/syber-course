// @ts-check
/* state.js → Managers and staff sessions
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */

import { managerName, normalizeWhatsapp, staffRowToManager } from "./04a-staff-rows.js";

export function install(ctx) {
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
    const domain = staffEmailDomain();
    return `${lower}@${domain}`;
  }

  function staffEmailDomain() {
    const brand = window.BRAND || {};
    if (brand.staffEmailDomain) return brand.staffEmailDomain;
    return String(brand.email || "").split("@")[1] || "example.com";
  }

  /** Supabase password grant; returns the auth payload. */
  async function supabasePasswordGrant(email, password) {
    const res = await fetch(ctx.remoteUrl("/auth/v1/token?grant_type=password"), {
      method: "POST",
      headers: { apikey: ctx.CFG.supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error("بيانات الدخول غير صحيحة / Identifiants incorrects");
    const data = await res.json();
    if (!data.access_token || !data.user) throw new Error("تعذر إنشاء جلسة الدخول");
    return data;
  }

  /** The staff row matching the Supabase auth user, refused when inactive. */
  async function staffRowFor(authId, token) {
    const rows = await ctx.supa(
      `/rest/v1/${ctx.CFG.staffTable}?auth_id=eq.${encodeURIComponent(authId)}&select=*`,
      {},
      { token }
    );
    const staff = Array.isArray(rows) ? rows[0] : null;
    if (!staff || staff.active === false) {
      throw new Error("هذا الحساب لا يملك صلاحية دخول لوحة التحكم. راجع مالك المتجر. / Compte non autorisé.");
    }
    return staff;
  }

  function supabaseSession(data, staff) {
    const email = staff.email || data.user.email;
    return {
      mode: "supabase",
      id: staff.id,
      authId: data.user.id,
      username: email,
      email,
      role: staff.role === "owner" ? "owner" : "manager",
      name: ctx.L(staff.name || data.user.user_metadata?.full_name || data.user.email),
      mustChange: Boolean(staff.must_change_password ?? data.user.user_metadata?.must_change_password),
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
      loggedAt: Date.now()
    };
  }

  async function remoteLogin(identifier, password) {
    const data = await supabasePasswordGrant(staffEmailFor(identifier), password);
    const staff = await staffRowFor(data.user.id, data.access_token);
    const next = supabaseSession(data, staff);
    persistSession(next);
    ctx.managers = [normalizeStaffRow(staff)];
    refreshStaff().catch(() => {});
    return ctx.session;
  }

  /** Local (draft) login: verifies the hash and upgrades legacy demo hashes. */
  async function localLogin(value, password) {
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
    return ctx.session;
  }

  /** Local mode needs demoEnabled; remote mode always goes through Supabase. */
  function assertLoginMode() {
    if (ctx.REMOTE || ctx.DEMO_ALLOWED) return;
    throw new Error(
      "الوضع المحلي الآمن يتطلب Supabase. للتجربة المحلية فقط: شغّل على localhost واضبط demoEnabled:true في config.js / Mode démo local désactivé."
    );
  }

  async function login(identifier, password) {
    const value = String(identifier || "").trim();
    if (!value || !password) throw new Error("أدخل البريد/اسم المستخدم وكلمة المرور");
    assertLoginMode();
    checkLoginLock(value);
    try {
      const result = ctx.REMOTE ? await remoteLogin(value, password) : await localLogin(value, password);
      clearLoginFailures(value);
      return result;
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
    return staffRowToManager(ctx, row);
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

  /** Display name of a new manager, in both languages, falling back to the identifier. */
  /** Calls the owner-only `admin-create-staff` edge function. */
  function createStaffCall(payload) {
    const fn = ctx.CFG.createStaffFunction || "admin-create-staff";
    return fetch(ctx.remoteUrl(`/functions/v1/${encodeURIComponent(fn)}`), {
      method: "POST",
      headers: {
        apikey: ctx.CFG.supabaseAnonKey,
        Authorization: `Bearer ${ctx.session.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  }

  async function staffCreationError(res) {
    const message = await ctx.readErrorMessage(res);
    return message || "تعذر إنشاء حساب المدير";
  }

  async function createRemoteManager(data, name) {
    const role = data.role === "owner" ? "owner" : "manager";
    if (ctx.session?.mode !== "supabase" || ctx.session.role !== "owner")
      throw new Error("إضافة الحسابات متاحة للمالك فقط");
    const email = ctx.normalizeEmail(data.email || data.username);
    if (!ctx.isEmail(email)) throw new Error("أدخل بريدًا إلكترونيًا صالحًا للمدير");
    const res = await createStaffCall({ email, password: data.password, name, role, whatsapp: data.whatsapp });
    if (res.status === 404)
      throw new Error("دالة إنشاء المديرين غير منشورة. راجع supabase/README.md لنشر admin-create-staff.");
    if (!res.ok) throw new Error(await staffCreationError(res));
    await refreshStaff();
    ctx.addAudit(`أضاف مديرًا: ${email}`, ctx.session.email);
    return ctx.managers.find((item) => item.email === email) || null;
  }

  /** Local (draft) creation: username uniqueness plus a hashed password. */
  async function createLocalManager(data, name, whatsapp) {
    const username = String(data.username || data.email || "")
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9._@-]{3,64}$/.test(username)) throw new Error("اسم المستخدم أو البريد غير صالح");
    const taken = ctx.managers.some((item) =>
      [item.username, item.email].filter(Boolean).some((value) => String(value).toLowerCase() === username)
    );
    if (taken) throw new Error("اسم المستخدم مستخدم بالفعل");
    const manager = {
      id: ctx.uid("m"),
      username,
      email: ctx.isEmail(username) ? username : "",
      name,
      displayName: name,
      role: data.role === "owner" ? "owner" : "manager",
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

  async function addManager(data = {}) {
    if (ctx.session && ctx.session.role !== "owner")
      throw new Error("إضافة الحسابات متاحة للمالك فقط / Réservé au propriétaire");
    const name = managerName(data);
    const whatsapp = normalizeWhatsapp(ctx, data.whatsapp);
    ctx.validatePassword(data.password || "");
    if (ctx.REMOTE) return createRemoteManager({ ...data, whatsapp }, name);
    return createLocalManager(data, name, whatsapp);
  }

  /** Managers may not touch their own role/flags, and never another account. */
  function managerPatchForSession(manager, id, patch) {
    if (!ctx.session || ctx.session.role === "owner") return patch;
    const isSelf = ctx.session.id === id || ctx.session.username === manager.username;
    if (!isSelf) throw new Error("تعديل الحسابات الأخرى متاح للمالك فقط");
    const safe = { ...patch };
    delete safe.role;
    delete safe.mustChange;
    delete safe.active;
    return safe;
  }

  function assertOwnerKept(managers, current, patch) {
    if (current.role !== "owner" || !patch.role || patch.role === "owner") return;
    if (managers.filter((item) => item.role === "owner").length <= 1)
      throw new Error("لا يمكن إزالة صلاحية المالك الوحيد");
  }

  function patchRole(next, current) {
    if (next === "owner" || next === "manager") return next;
    return current;
  }

  /** Remote patch payload (snake_case columns of the staff table). */
  function staffRowPatch(ctx, patch) {
    const body = {};
    if (patch.name) body.name = patch.name;
    if (patch.role) body.role = patch.role === "owner" ? "owner" : "manager";
    if (patch.whatsapp != null) body.whatsapp = ctx.normalizeDigits(patch.whatsapp);
    if (patch.mustChange != null) body.must_change_password = Boolean(patch.mustChange);
    if (patch.active != null) body.active = Boolean(patch.active);
    if (patch.avatar != null) body.avatar = String(patch.avatar);
    return body;
  }

  function pushStaffPatch(id, body) {
    if (!ctx.REMOTE || ctx.session?.mode !== "supabase" || !Object.keys(body).length) return;
    ctx
      .supa(
        `/rest/v1/${ctx.CFG.staffTable}?id=eq.${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify(body), headers: { Prefer: "return=minimal" } },
        true
      )
      .catch((error) => {
        console.warn("Restore: staff update failed", error);
        refreshStaff().catch(() => {});
      });
  }

  function updateManager(id, patch = {}) {
    const index = ctx.managers.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("الحساب غير موجود");
    const current = ctx.managers[index];
    const safe = managerPatchForSession(current, id, patch);
    assertOwnerKept(ctx.managers, current, safe);
    ctx.managers[index] = {
      ...current,
      ...safe,
      name: safe.name || current.name,
      role: patchRole(safe.role, current.role),
      mustChange: safe.mustChange != null ? Boolean(safe.mustChange) : current.mustChange
    };
    saveManagers();
    pushStaffPatch(id, staffRowPatch(ctx, safe));
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

  /** Validates the new password and the optional WhatsApp number. */
  function assertPasswordChange(currentPassword, newPassword, whatsapp) {
    ctx.validatePassword(newPassword);
    if (String(currentPassword) === String(newPassword)) throw new Error("اختر كلمة مرور مختلفة عن الحالية");
    const cleanWhatsapp = ctx.normalizeDigits(whatsapp || "");
    if (cleanWhatsapp && ![8, 11].includes(cleanWhatsapp.length)) throw new Error("رقم واتساب غير صالح");
    return cleanWhatsapp;
  }

  /** Remote flow: re-authenticate, update the auth user, then the staff row. */
  async function changeRemotePassword(currentPassword, newPassword, cleanWhatsapp) {
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
  }

  /** Local flow: verify the current hash, store the new one. */
  async function changeLocalPassword(username, currentPassword, newPassword, cleanWhatsapp) {
    const manager = managerByIdentifier(username) || managerById(ctx.session?.id);
    if (!manager) throw new Error("المستخدم غير موجود");
    if (!(await verifyManagerPassword(manager, currentPassword))) throw new Error("كلمة المرور الحالية غير صحيحة");
    manager.passwordHash = await ctx.hashPassword(newPassword);
    manager.mustChange = false;
    if (cleanWhatsapp) manager.whatsapp = cleanWhatsapp;
    saveManagers();
    persistSession({ ...(ctx.session || localSessionFor(manager)), mustChange: false });
  }

  /** Mirrors the new number into the store settings (best effort). */
  async function syncOwnerWhatsapp(cleanWhatsapp) {
    if (!cleanWhatsapp) return;
    const phone = cleanWhatsapp.length === 8 ? `+222${cleanWhatsapp}` : `+${cleanWhatsapp}`;
    try {
      await ctx.updateOwnerSettings({ whatsapp: cleanWhatsapp, phone, phoneDisplay: ctx.formatPhone(phone) });
    } catch (error) {
      console.warn("Restore: could not update store WhatsApp", error);
    }
  }

  async function changePassword(username, currentPassword, newPassword, whatsapp) {
    const cleanWhatsapp = assertPasswordChange(currentPassword, newPassword, whatsapp);
    if (ctx.REMOTE) await changeRemotePassword(currentPassword, newPassword, cleanWhatsapp);
    else await changeLocalPassword(username, currentPassword, newPassword, cleanWhatsapp);
    await syncOwnerWhatsapp(cleanWhatsapp);
    ctx.addAudit("غيّر كلمة المرور", ctx.session?.username);
    return ctx.session;
  }

  function changeOwnerPassword(currentPassword, newPassword) {
    return changePassword(ctx.session?.username || "owner", currentPassword, newPassword, "");
  }
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
  Object.assign(ctx, { DEFAULT_MANAGERS, savedManagers });
}
