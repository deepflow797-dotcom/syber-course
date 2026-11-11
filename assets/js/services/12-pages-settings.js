// @ts-check
/* state.js → Content pages and owner settings
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */

export function install(ctx) {
  Object.assign(ctx, {
    validateSlug,
    getPages,
    getPage,
    savePage,
    deletePage,
    normalizePhone,
    normalizeSocial,
    updateOwnerSettings
  });
  function validateSlug(slug) {
    const value = String(slug || "")
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 80)
      throw new Error("الرابط يجب أن يحتوي على حروف إنجليزية وأرقام وشرطات فقط");
    return value;
  }
  function getPages() {
    return ctx.clone(ctx.state.pages || []);
  }
  function getPage(slug) {
    const value = String(slug || "").trim();
    return ctx.clone((ctx.state.pages || []).find((page) => page.slug === value && page.visible !== false) || null);
  }
  async function savePage(pageData = {}) {
    const slug = validateSlug(pageData.slug);
    const title = pageData.title || {};
    if (!ctx.L(title).trim()) throw new Error("عنوان الصفحة مطلوب");
    const page = {
      ...pageData,
      slug,
      title: { ar: String(title.ar || ctx.L(title)).trim(), fr: String(title.fr || ctx.L(title)).trim() },
      body: {
        ar: String(pageData.body?.ar || "").trim(),
        fr: String(pageData.body?.fr || "").trim()
      },
      visible: pageData.visible !== false,
      seoTitle: pageData.seoTitle || title,
      seoDescription: pageData.seoDescription || { ar: "", fr: "" },
      updatedAt: ctx.nowISO()
    };
    if (ctx.REMOTE) {
      if (!(await ctx.remoteSessionValid())) throw new Error("سجّل الدخول إلى لوحة التحكم");
      await ctx.supa(
        `/rest/v1/${ctx.CFG.pagesTable}`,
        {
          method: "POST",
          body: JSON.stringify({
            slug: page.slug,
            title: page.title,
            body: page.body,
            seo_title: page.seoTitle,
            seo_description: page.seoDescription,
            visible: page.visible,
            updated_at: page.updatedAt
          }),
          headers: { Prefer: "resolution=merge-duplicates,return=representation" }
        },
        true
      );
    }
    const pages = (ctx.state.pages || []).filter((item) => item.slug !== slug);
    pages.push(page);
    ctx.state = ctx.hydrate({ ...ctx.state, pages });
    ctx.writeJSON(ctx.LS_STATE, ctx.state);
    return ctx.clone(page);
  }
  async function deletePage(slug) {
    const value = validateSlug(slug);
    if (ctx.REMOTE) {
      if (!(await ctx.remoteSessionValid())) throw new Error("سجّل الدخول إلى لوحة التحكم");
      await ctx.supa(`/rest/v1/${ctx.CFG.pagesTable}?slug=eq.${encodeURIComponent(value)}`, { method: "DELETE" }, true);
    }
    ctx.state = ctx.hydrate({ ...ctx.state, pages: (ctx.state.pages || []).filter((page) => page.slug !== value) });
    ctx.writeJSON(ctx.LS_STATE, ctx.state);
    return true;
  }

  function normalizePhone(phone) {
    const digits = ctx.normalizeDigits(phone);
    if (!digits) return "";
    if (digits.length === 8) return `+222${digits}`;
    if (digits.length === 11 && digits.startsWith("222")) return `+${digits}`;
    throw new Error("رقم الهاتف يجب أن يكون 8 أرقام موريتانية");
  }
  function normalizeSocial(list) {
    const allowed = new Set([
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
    ]);
    const out = [];
    for (const entry of Array.isArray(list) ? list : []) {
      const id = String(entry.id || entry.platform || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 24);
      const href = ctx.safeHref(entry.href || "", "");
      if (!id || !href || !/^https:\/\//i.test(href)) continue;
      if (!allowed.has(id) && !allowed.has(id.replace("-", ""))) continue;
      out.push({ id, icon: allowed.has(id) ? id : "instagram", href });
      if (out.length >= 12) break;
    }
    return out;
  }
  async function updateOwnerSettings(patch = {}) {
    if (ctx.session && ctx.session.role !== "owner")
      throw new Error("هذه الإعدادات متاحة للمالك فقط / Réservé au propriétaire");
    const next = ctx.clone(ctx.state);
    const settings = next.settings;
    const allowedKeys = [
      "storeName",
      "legalName",
      "tagline",
      "email",
      "whatsapp",
      "phone",
      "phoneDisplay",
      "address",
      "city",
      "social",
      "hours"
    ];
    for (const key of allowedKeys) {
      if (!(key in patch)) continue;
      if (key === "email") {
        const email = ctx.normalizeEmail(patch.email);
        if (email && !ctx.isEmail(email)) throw new Error("البريد الإلكتروني غير صالح");
        settings.email = email;
      } else if (key === "whatsapp") {
        const digits = ctx.normalizeDigits(patch.whatsapp);
        if (digits && ![8, 11].includes(digits.length)) throw new Error("رقم واتساب غير صالح");
        if (digits.length === 11 && !digits.startsWith("222")) throw new Error("رقم واتساب موريتاني غير صالح");
        settings.whatsapp = digits;
      } else if (key === "phone") {
        settings.phone = normalizePhone(patch.phone);
        if (!patch.phoneDisplay) settings.phoneDisplay = ctx.formatPhone(settings.phone);
      } else if (key === "social") {
        settings.social = normalizeSocial(patch.social);
      } else if (key === "phoneDisplay") {
        const display = String(patch.phoneDisplay || "")
          .trim()
          .slice(0, 32);
        if (display && !/^[+0-9 ()-]{7,32}$/.test(display)) throw new Error("صيغة الرقم المعروض غير صالحة");
        settings.phoneDisplay = display || ctx.formatPhone(settings.phone);
      } else {
        settings[key] = patch[key];
      }
    }
    next.updatedAt = ctx.nowISO();
    if (ctx.REMOTE) {
      if (!(await ctx.remoteSessionValid())) throw new Error("انتهت جلسة Supabase. أعد تسجيل الدخول.");
      await ctx.pushPublishedState(next);
    }
    ctx.state = ctx.hydrate(next);
    ctx.writeJSON(ctx.LS_STATE, ctx.state);
    ctx.applyDocument();
    ctx.channel?.postMessage({ type: "state", updatedAt: ctx.state.updatedAt });
    window.dispatchEvent(new CustomEvent("restore:changed", { detail: { source: "owner-settings" } }));
    return ctx.clone(ctx.state.settings);
  }
}
