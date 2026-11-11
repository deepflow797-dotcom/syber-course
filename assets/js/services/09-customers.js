// @ts-check
/* state.js → Customer accounts, addresses and wishlist
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */

export function install(ctx) {
  Object.assign(ctx, {
    publicCustomer,
    normalizeCustomerRow,
    saveLocalCustomer,
    readLocalCustomers,
    saveLocalCustomers,
    notifyCustomer,
    readWishlist,
    writeWishlist,
    mergeWishlist,
    getCustomer,
    getCustomerSession,
    setCustomerSession,
    loadRemoteCustomerProfile,
    customerRegister,
    customerLogin,
    customerLogout,
    customerSyncWishlist,
    customerToggleWishlist,
    customerAddAddress,
    customerUpdateAddress,
    customerDeleteAddress,
    restoreCustomerSession
  });
  function publicCustomer(customer) {
    if (!customer) return null;
    const { passwordHash: _passwordHash, ...safe } = customer;
    return ctx.clone({
      ...safe,
      addresses: Array.isArray(safe.addresses) ? safe.addresses : [],
      wishlist: Array.isArray(safe.wishlist) ? safe.wishlist : []
    });
  }
  function normalizeCustomerRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      authId: row.auth_id || "",
      name: row.name || "",
      email: ctx.normalizeEmail(row.email || ""),
      phone: ctx.normalizeDigits(row.phone || ""),
      addresses: Array.isArray(row.addresses) ? row.addresses : [],
      wishlist: ctx.uniqueStrings(row.wishlist || []).slice(0, ctx.MAX_WISHLIST),
      createdAt: row.created_at || ctx.nowISO()
    };
  }
  function saveLocalCustomer() {
    if (ctx.currentCustomer) ctx.writeJSON(ctx.LS_CUSTOMER, publicCustomer(ctx.currentCustomer));
    else localStorage.removeItem(ctx.LS_CUSTOMER);
  }
  function readLocalCustomers() {
    const rows = ctx.readJSON(ctx.LS_CUSTOMERS, []);
    return Array.isArray(rows) ? rows : [];
  }
  function saveLocalCustomers(rows) {
    ctx.writeJSON(ctx.LS_CUSTOMERS, rows);
  }
  function notifyCustomer() {
    ctx.channel?.postMessage({ type: "customer" });
    window.dispatchEvent(new CustomEvent("restore:customer", { detail: ctx.currentCustomer }));
  }
  const WISH_KEY = "restore_wish_v1";
  function readWishlist() {
    try {
      const value = JSON.parse(localStorage.getItem(WISH_KEY) || "[]");
      return ctx.uniqueStrings(Array.isArray(value) ? value : []).slice(0, ctx.MAX_WISHLIST);
    } catch {
      return [];
    }
  }
  function writeWishlist(handles) {
    const list = ctx.uniqueStrings(handles).slice(0, ctx.MAX_WISHLIST);
    localStorage.setItem(WISH_KEY, JSON.stringify(list));
    return list;
  }
  function mergeWishlist(customer) {
    if (!customer) return readWishlist();
    const merged = ctx.uniqueStrings([...readWishlist(), ...(customer.wishlist || [])]).slice(0, ctx.MAX_WISHLIST);
    writeWishlist(merged);
    if (
      merged.length !== (customer.wishlist || []).length ||
      merged.some((handle) => !(customer.wishlist || []).includes(handle))
    ) {
      customer.wishlist = merged;
      saveLocalCustomer();
      if (ctx.REMOTE && customer.authId) {
        ctx
          .supaCustomer(`/rest/v1/${ctx.CFG.customersTable}?auth_id=eq.${encodeURIComponent(customer.authId)}`, {
            method: "PATCH",
            body: JSON.stringify({ wishlist: merged }),
            headers: { Prefer: "return=minimal" }
          })
          .catch(() => {});
      }
    }
    return merged;
  }
  function getCustomer() {
    return ctx.currentCustomer;
  }
  function getCustomerSession() {
    return ctx.customerAuth;
  }
  function setCustomerSession(data) {
    ctx.customerAuth = data
      ? {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
          user: data.user,
          mode: "supabase"
        }
      : null;
    if (ctx.customerAuth) ctx.writeJSON(ctx.LS_CUSTOMER_SESSION, ctx.customerAuth);
    else localStorage.removeItem(ctx.LS_CUSTOMER_SESSION);
  }

  async function loadRemoteCustomerProfile(user) {
    if (!user?.id) throw new Error("جلسة عميل غير صالحة");
    const rows = await ctx.supaCustomer(
      `/rest/v1/${ctx.CFG.customersTable}?auth_id=eq.${encodeURIComponent(user.id)}&select=*`
    );
    let profile = Array.isArray(rows) ? rows[0] : null;
    if (!profile) {
      const created = await ctx.supaCustomer(`/rest/v1/${ctx.CFG.customersTable}`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          auth_id: user.id,
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Client",
          email: ctx.normalizeEmail(user.email || ""),
          phone: ctx.normalizeDigits(user.user_metadata?.phone || ""),
          addresses: [],
          wishlist: readWishlist()
        })
      });
      profile = Array.isArray(created) ? created[0] : created;
    }
    const customer = normalizeCustomerRow(profile);
    if (!customer) throw new Error("تعذر تحميل حساب العميل");
    customer.authId = user.id;
    ctx.currentCustomer = customer;
    saveLocalCustomer();
    mergeWishlist(customer);
    notifyCustomer();
    await ctx.refreshOrders().catch(() => {});
    return customer;
  }

  async function customerRegister(data = {}) {
    const name = String(data.name || "").trim();
    const email = ctx.normalizeEmail(data.email || "");
    const phone = ctx.normalizeDigits(data.phone || "");
    const password = String(data.password || "");
    if (name.length < 2) throw new Error("أدخل الاسم الكامل / Nom complet requis");
    if (!ctx.isEmail(email)) throw new Error("أدخل بريدًا إلكترونيًا صالحًا / E-mail invalide");
    if (phone && phone.length !== 8) throw new Error("رقم الهاتف يجب أن يكون 8 أرقام / 8 chiffres requis");
    ctx.validatePassword(password);
    const wishlist = ctx.uniqueStrings(data.wishlist || readWishlist()).slice(0, ctx.MAX_WISHLIST);

    if (ctx.REMOTE) {
      const res = await fetch(ctx.remoteUrl("/auth/v1/signup"), {
        method: "POST",
        headers: { apikey: ctx.CFG.supabaseAnonKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          data: { full_name: name, phone }
        })
      });
      if (!res.ok) throw new Error((await ctx.readErrorMessage(res)) || "تعذر إنشاء الحساب");
      const auth = await res.json();
      if (!auth.access_token || !auth.user) {
        throw new Error(
          "تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيده ثم سجّل الدخول. / Vérifiez votre e-mail pour confirmer le compte."
        );
      }
      setCustomerSession(auth);
      writeWishlist(wishlist);
      const profile = await loadRemoteCustomerProfile(auth.user);
      if (wishlist.length) await customerSyncWishlist(wishlist);
      return profile;
    }

    const rows = readLocalCustomers();
    if (rows.some((item) => ctx.normalizeEmail(item.email) === email))
      throw new Error("الحساب موجود بالفعل / Compte déjà existant");
    if (phone && rows.some((item) => ctx.normalizeDigits(item.phone) === phone))
      throw new Error("رقم الهاتف مستخدم بالفعل");
    const customer = {
      id: ctx.uid("cust"),
      authId: "",
      name,
      email,
      phone,
      passwordHash: await ctx.hashPassword(password),
      addresses: [],
      wishlist,
      createdAt: ctx.nowISO()
    };
    rows.push(customer);
    saveLocalCustomers(rows);
    ctx.currentCustomer = publicCustomer(customer);
    saveLocalCustomer();
    mergeWishlist(ctx.currentCustomer);
    notifyCustomer();
    return ctx.currentCustomer;
  }

  async function customerLogin(identifier, password) {
    let email = "";
    let phone = "";
    let secret = password;
    if (identifier && typeof identifier === "object") {
      email = ctx.normalizeEmail(identifier.email || "");
      phone = ctx.normalizeDigits(identifier.phone || "");
      secret = String(identifier.password || "");
    } else {
      const value = String(identifier || "").trim();
      if (ctx.isEmail(value)) email = ctx.normalizeEmail(value);
      else phone = ctx.normalizeDigits(value);
      secret = String(password || "");
    }
    if (!email && !phone) throw new Error("أدخل البريد الإلكتروني أو رقم الهاتف");
    if (!secret) throw new Error("أدخل كلمة المرور");
    ctx.checkLoginLock(email || phone);

    if (ctx.REMOTE && email) {
      try {
        const res = await fetch(ctx.remoteUrl("/auth/v1/token?grant_type=password"), {
          method: "POST",
          headers: { apikey: ctx.CFG.supabaseAnonKey, "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: secret })
        });
        if (!res.ok) throw new Error((await ctx.readErrorMessage(res)) || "بيانات الدخول غير صحيحة");
        const auth = await res.json();
        setCustomerSession(auth);
        const profile = await loadRemoteCustomerProfile(auth.user);
        ctx.clearLoginFailures(email || phone);
        return profile;
      } catch (error) {
        // Local demo accounts still work when Supabase is configured.
        console.warn("Restore: remote customer login failed, trying local demo account", error.message);
      }
    }

    const rows = readLocalCustomers();
    const customer = rows.find(
      (item) =>
        (email && ctx.normalizeEmail(item.email) === email) || (phone && ctx.normalizeDigits(item.phone) === phone)
    );
    if (!customer) {
      ctx.noteLoginFailure(email || phone);
      throw new Error("الحساب غير موجود / Compte introuvable");
    }
    if (!(await ctx.verifyPassword(secret, customer.passwordHash))) {
      ctx.noteLoginFailure(email || phone);
      throw new Error("كلمة المرور غير صحيحة / Mot de passe incorrect");
    }
    ctx.currentCustomer = publicCustomer(customer);
    saveLocalCustomer();
    mergeWishlist(ctx.currentCustomer);
    notifyCustomer();
    ctx.clearLoginFailures(email || phone);
    return ctx.currentCustomer;
  }

  function customerLogout() {
    if (ctx.REMOTE && ctx.customerAuth?.accessToken) {
      fetch(ctx.remoteUrl("/auth/v1/logout"), {
        method: "POST",
        headers: { apikey: ctx.CFG.supabaseAnonKey, Authorization: `Bearer ${ctx.customerAuth.accessToken}` }
      }).catch(() => {});
    }
    ctx.customerAuth = null;
    ctx.currentCustomer = null;
    localStorage.removeItem(ctx.LS_CUSTOMER_SESSION);
    localStorage.removeItem(ctx.LS_CUSTOMER);
    notifyCustomer();
    window.dispatchEvent(new CustomEvent("restore:customerLogout"));
  }

  function customerSyncWishlist(handles) {
    const list = writeWishlist(ctx.uniqueStrings(Array.isArray(handles) ? handles : readWishlist()));
    if (!ctx.currentCustomer) return list;
    ctx.currentCustomer.wishlist = list;
    saveLocalCustomer();
    if (!ctx.currentCustomer.authId) {
      const rows = readLocalCustomers();
      const index = rows.findIndex((item) => item.id === ctx.currentCustomer.id);
      if (index >= 0) {
        rows[index].wishlist = list;
        saveLocalCustomers(rows);
      }
    }
    if (ctx.REMOTE && ctx.currentCustomer.authId && ctx.customerAuth?.accessToken) {
      ctx
        .supaCustomer(
          `/rest/v1/${ctx.CFG.customersTable}?auth_id=eq.${encodeURIComponent(ctx.currentCustomer.authId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ wishlist: list }),
            headers: { Prefer: "return=minimal" }
          }
        )
        .catch((error) => console.warn("Restore: wishlist sync failed", error));
    }
    return list;
  }
  function customerToggleWishlist(handle) {
    const list = readWishlist();
    const next = list.includes(handle) ? list.filter((item) => item !== handle) : [...list, handle];
    customerSyncWishlist(next);
    return next.includes(handle);
  }

  function customerAddAddress(address = {}) {
    if (!ctx.currentCustomer) throw new Error("سجّل الدخول أولًا");
    const entry = { ...address, id: ctx.uid("addr"), createdAt: ctx.nowISO() };
    ctx.currentCustomer.addresses = [...(ctx.currentCustomer.addresses || []), entry];
    saveLocalCustomer();
    if (ctx.currentCustomer.authId && ctx.customerAuth?.accessToken) {
      ctx
        .supaCustomer(
          `/rest/v1/${ctx.CFG.customersTable}?auth_id=eq.${encodeURIComponent(ctx.currentCustomer.authId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ addresses: ctx.currentCustomer.addresses }),
            headers: { Prefer: "return=minimal" }
          }
        )
        .catch(() => {});
    }
    return entry;
  }
  function customerUpdateAddress(id, patch = {}) {
    if (!ctx.currentCustomer) return;
    ctx.currentCustomer.addresses = (ctx.currentCustomer.addresses || []).map((address) =>
      address.id === id ? { ...address, ...patch } : address
    );
    saveLocalCustomer();
    if (ctx.currentCustomer.authId && ctx.customerAuth?.accessToken) {
      ctx
        .supaCustomer(
          `/rest/v1/${ctx.CFG.customersTable}?auth_id=eq.${encodeURIComponent(ctx.currentCustomer.authId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ addresses: ctx.currentCustomer.addresses }),
            headers: { Prefer: "return=minimal" }
          }
        )
        .catch(() => {});
    }
  }
  function customerDeleteAddress(id) {
    if (!ctx.currentCustomer) return;
    ctx.currentCustomer.addresses = (ctx.currentCustomer.addresses || []).filter((address) => address.id !== id);
    saveLocalCustomer();
    if (ctx.currentCustomer.authId && ctx.customerAuth?.accessToken) {
      ctx
        .supaCustomer(
          `/rest/v1/${ctx.CFG.customersTable}?auth_id=eq.${encodeURIComponent(ctx.currentCustomer.authId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ addresses: ctx.currentCustomer.addresses }),
            headers: { Prefer: "return=minimal" }
          }
        )
        .catch(() => {});
    }
  }

  async function restoreCustomerSession() {
    if (!ctx.REMOTE || !ctx.customerAuth?.accessToken) return null;
    try {
      if (ctx.customerTokenExpiring() && !(await ctx.refreshCustomerToken())) throw new Error("expired");
      const res = await fetch(ctx.remoteUrl("/auth/v1/user"), {
        headers: { apikey: ctx.CFG.supabaseAnonKey, Authorization: `Bearer ${ctx.customerAuth.accessToken}` }
      });
      if (!res.ok) throw new Error("expired");
      const user = await res.json();
      ctx.customerAuth.user = user;
      ctx.writeJSON(ctx.LS_CUSTOMER_SESSION, ctx.customerAuth);
      return await loadRemoteCustomerProfile(user);
    } catch {
      ctx.customerAuth = null;
      ctx.currentCustomer = null;
      localStorage.removeItem(ctx.LS_CUSTOMER_SESSION);
      localStorage.removeItem(ctx.LS_CUSTOMER);
      return null;
    }
  }
  Object.assign(ctx, { WISH_KEY });
}
