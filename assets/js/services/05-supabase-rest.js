// @ts-check
/* state.js → Supabase REST helpers
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */

export function install(ctx) {
  Object.assign(ctx, {
    remoteUrl,
    readErrorMessage,
    remoteSessionValid,
    supa,
    customerTokenExpiring,
    refreshCustomerToken,
    supaCustomer,
    uploadMedia,
    resizeImage
  });
  function remoteUrl(path) {
    return `${String(ctx.CFG.supabaseUrl || "").replace(/\/$/, "")}${path}`;
  }
  async function readErrorMessage(res) {
    const text = await res.text().catch(() => "");
    if (!text) return "";
    try {
      const parsed = JSON.parse(text);
      return parsed.msg || parsed.message || parsed.error_description || parsed.error || text.slice(0, 180);
    } catch {
      return text.slice(0, 180);
    }
  }
  async function remoteSessionValid(opts = {}) {
    if (!ctx.REMOTE || !ctx.session || ctx.session.mode !== "supabase") return false;
    if (!ctx.session.accessToken) ctx.session.accessToken = ctx.tokenVault.accessToken;
    if (!ctx.session.refreshToken) ctx.session.refreshToken = ctx.tokenVault.refreshToken;
    if (!ctx.session.accessToken) return false;
    if (
      !opts.force &&
      (!ctx.session.expiresAt || Number(ctx.session.expiresAt) > Date.now() + ctx.SESSION_REFRESH_BEFORE_MS)
    )
      return true;
    if (!ctx.session.refreshToken) return false;
    try {
      const res = await fetch(remoteUrl("/auth/v1/token?grant_type=refresh_token"), {
        method: "POST",
        headers: { apikey: ctx.CFG.supabaseAnonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: ctx.session.refreshToken })
      });
      if (!res.ok) {
        if (opts.force) ctx.logout();
        return false;
      }
      const data = await res.json();
      ctx.persistSession({
        ...ctx.session,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || ctx.session.refreshToken,
        expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000
      });
      return true;
    } catch {
      if (opts.force) ctx.logout();
      return false;
    }
  }
  /**
   * Authenticated/anonymous call to the merchant's Supabase REST API.
   * @param {string} path
   * @param {Omit<RequestInit, "headers"> & { headers?: Record<string, string> }} [options]
   * @param {boolean | { token: string }} [auth] true = staff session token, object = explicit token (customer)
   */
  async function supa(path, options = {}, auth = false) {
    if (!ctx.REMOTE) throw new Error("Supabase is not configured");
    /** @type {Record<string, string>} */
    const headers = { apikey: ctx.CFG.supabaseAnonKey, "Content-Type": "application/json", ...(options.headers || {}) };
    const request = {
      ...options,
      headers
    };
    /** @type {string | null} */
    let token = null;
    if (auth === true) {
      if (await remoteSessionValid()) token = ctx.session?.accessToken;
      else throw new Error("انتهت جلسة لوحة التحكم. سجّل الدخول مجددًا.");
    } else if (auth && auth.token) {
      token = auth.token;
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(remoteUrl(path), request);
    if (!res.ok) {
      const message = await readErrorMessage(res);
      throw new Error(message || `Supabase ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json().catch(() => null);
  }

  function customerTokenExpiring() {
    return (
      !ctx.customerAuth?.accessToken ||
      !ctx.customerAuth?.expiresAt ||
      Number(ctx.customerAuth.expiresAt) <= Date.now() + 45000
    );
  }
  async function refreshCustomerToken() {
    if (!ctx.REMOTE || !ctx.customerAuth?.refreshToken) return false;
    try {
      const res = await fetch(remoteUrl("/auth/v1/token?grant_type=refresh_token"), {
        method: "POST",
        headers: { apikey: ctx.CFG.supabaseAnonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: ctx.customerAuth.refreshToken })
      });
      if (!res.ok) return false;
      const data = await res.json();
      ctx.customerAuth = {
        ...ctx.customerAuth,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || ctx.customerAuth.refreshToken,
        expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000
      };
      ctx.writeJSON(ctx.LS_CUSTOMER_SESSION, ctx.customerAuth);
      return true;
    } catch {
      return false;
    }
  }
  async function supaCustomer(path, options = {}) {
    if (!ctx.REMOTE || !ctx.customerAuth?.accessToken) throw new Error("سجّل الدخول بحساب العميل أولًا");
    if (customerTokenExpiring() && !(await refreshCustomerToken()))
      throw new Error("انتهت جلسة العميل. أعد تسجيل الدخول.");
    const request = {
      ...options,
      headers: {
        apikey: ctx.CFG.supabaseAnonKey,
        Authorization: `Bearer ${ctx.customerAuth.accessToken}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    };
    let res = await fetch(remoteUrl(path), request);
    if (res.status === 401 && (await refreshCustomerToken())) {
      request.headers.Authorization = `Bearer ${ctx.customerAuth.accessToken}`;
      res = await fetch(remoteUrl(path), request);
    }
    if (!res.ok) throw new Error((await readErrorMessage(res)) || `Supabase ${res.status}`);
    if (res.status === 204) return null;
    return res.json().catch(() => null);
  }

  async function uploadMedia(dataUrl, folder = "uploads") {
    if (!ctx.REMOTE) return null;
    if (!(await remoteSessionValid())) throw new Error("انتهت جلسة Supabase. أعد تسجيل الدخول.");
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const allowed = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
    const extension = allowed[blob.type];
    if (!extension) throw new Error("صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو WebP أو GIF.");
    if (blob.size > 5 * 1024 * 1024) throw new Error("الصورة أكبر من 5MB");
    const stamp = new Date().toISOString().slice(0, 10);
    const id = crypto.randomUUID ? crypto.randomUUID() : ctx.uid("img");
    const safeFolder =
      String(folder || "uploads")
        .replace(/[^a-z0-9/_-]/gi, "")
        .slice(0, 80) || "uploads";
    const objectPath = `${safeFolder}/${stamp}/${id}.${extension}`;
    const res = await fetch(
      remoteUrl(
        `/storage/v1/object/${encodeURIComponent(ctx.CFG.mediaBucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`
      ),
      {
        method: "POST",
        headers: {
          apikey: ctx.CFG.supabaseAnonKey,
          Authorization: `Bearer ${ctx.session.accessToken}`,
          "Content-Type": blob.type,
          "x-upsert": "false"
        },
        body: blob
      }
    );
    if (!res.ok) throw new Error((await readErrorMessage(res)) || `Storage ${res.status}`);
    return remoteUrl(
      `/storage/v1/object/public/${encodeURIComponent(ctx.CFG.mediaBucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`
    );
  }

  function resizeImage(file, maxDimension = 1400, quality = 0.86) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("لم يتم اختيار صورة"));
      if (!/^image\//.test(file.type || "")) return reject(new Error("الملف ليس صورة صالحة"));
      if (file.size > 10 * 1024 * 1024) return reject(new Error("الصورة أكبر من 10MB"));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
      reader.onload = () => {
        if (file.type === "image/svg+xml") {
          resolve(String(reader.result || ""));
          return;
        }
        const image = new Image();
        image.onerror = () => reject(new Error("صورة غير صالحة"));
        image.onload = () => {
          try {
            const max = Math.max(200, Number(maxDimension) || 1400);
            const scale = Math.min(1, max / Math.max(image.width || 1, image.height || 1));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round((image.width || 1) * scale));
            canvas.height = Math.max(1, Math.round((image.height || 1) * scale));
            const context = canvas.getContext("2d");
            if (!context) throw new Error("تعذر تجهيز الصورة");
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/webp", Math.min(0.95, Math.max(0.6, Number(quality) || 0.86))));
          } catch (error) {
            reject(error);
          }
        };
        image.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }
}
