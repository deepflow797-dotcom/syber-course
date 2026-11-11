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
  /** Upserts the page row in Supabase (staff session required). */
  async function pushPageRow(page) {
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

  /** Localised page payload: title falls back to the current language. */
  function buildPageRecord(pageData, slug, title) {
    const fallback = ctx.L(title);
    return {
      ...pageData,
      slug,
      title: {
        ar: String(title.ar || fallback).trim(),
        fr: String(title.fr || fallback).trim()
      },
      body: {
        ar: String(pageData.body?.ar || "").trim(),
        fr: String(pageData.body?.fr || "").trim()
      },
      visible: pageData.visible !== false,
      seoTitle: pageData.seoTitle || title,
      seoDescription: pageData.seoDescription || { ar: "", fr: "" },
      updatedAt: ctx.nowISO()
    };
  }

  async function savePage(pageData = {}) {
    const slug = validateSlug(pageData.slug);
    const title = pageData.title || {};
    if (!ctx.L(title).trim()) throw new Error("عنوان الصفحة مطلوب");
    const page = buildPageRecord(pageData, slug, title);
    if (ctx.REMOTE) await pushPageRow(page);
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
  const SOCIAL_PLATFORMS = new Set([
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

  function socialId(entry) {
    return String(entry.id || entry.platform || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 24);
  }

  /** Normalised entry, or null when the id/href pair is not acceptable. */
  function socialEntry(entry) {
    const id = socialId(entry);
    const href = ctx.safeHref(entry.href || "", "");
    if (!id || !href || !/^https:\/\//i.test(href)) return null;
    if (!SOCIAL_PLATFORMS.has(id) && !SOCIAL_PLATFORMS.has(id.replace("-", ""))) return null;
    return { id, icon: SOCIAL_PLATFORMS.has(id) ? id : "instagram", href };
  }

  function normalizeSocial(list) {
    const out = [];
    for (const entry of Array.isArray(list) ? list : []) {
      const normalized = socialEntry(entry);
      if (normalized) out.push(normalized);
      if (out.length >= 12) break;
    }
    return out;
  }
  /** Keys an owner may change through this endpoint. */
  const OWNER_SETTING_KEYS = [
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

  function cleanEmail(value) {
    const email = ctx.normalizeEmail(value);
    if (email && !ctx.isEmail(email)) throw new Error("البريد الإلكتروني غير صالح");
    return email;
  }

  function cleanWhatsapp(value) {
    const digits = ctx.normalizeDigits(value);
    if (digits && ![8, 11].includes(digits.length)) throw new Error("رقم واتساب غير صالح");
    if (digits.length === 11 && !digits.startsWith("222")) throw new Error("رقم واتساب موريتاني غير صالح");
    return digits;
  }

  function cleanPhoneDisplay(value, fallbackPhone) {
    const display = String(value || "")
      .trim()
      .slice(0, 32);
    if (display && !/^[+0-9 ()-]{7,32}$/.test(display)) throw new Error("صيغة الرقم المعروض غير صالحة");
    return display || ctx.formatPhone(fallbackPhone);
  }

  /** Sanitisers of the keys that are not plain copies. */
  const SETTING_SANITIZERS = {
    email: (settings, value) => {
      settings.email = cleanEmail(value);
    },
    whatsapp: (settings, value) => {
      settings.whatsapp = cleanWhatsapp(value);
    },
    phone: (settings, value) => {
      settings.phone = normalizePhone(value);
      settings.phoneDisplay = ctx.formatPhone(settings.phone);
    },
    phoneDisplay: (settings, value) => {
      settings.phoneDisplay = cleanPhoneDisplay(value, settings.phone);
    },
    social: (settings, value) => {
      settings.social = normalizeSocial(value);
    }
  };

  /** Publishes (remote) and stores (local) the new settings tree. */
  async function persistOwnerSettings(next) {
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
  }

  /** Applies one allow-listed key of the owner patch. */
  function applySetting(settings, key, patch) {
    const sanitize = SETTING_SANITIZERS[key];
    if (sanitize) {
      sanitize(settings, patch[key]);
      return;
    }
    settings[key] = patch[key];
  }

  async function updateOwnerSettings(patch = {}) {
    if (ctx.session && ctx.session.role !== "owner")
      throw new Error("هذه الإعدادات متاحة للمالك فقط / Réservé au propriétaire");
    const next = ctx.clone(ctx.state);
    for (const key of OWNER_SETTING_KEYS) {
      if (key in patch) applySetting(next.settings, key, patch);
    }
    // An explicit display keeps priority over the formatted phone.
    if (patch.phone && patch.phoneDisplay)
      next.settings.phoneDisplay = cleanPhoneDisplay(patch.phoneDisplay, next.settings.phone);
    await persistOwnerSettings(next);
    return ctx.clone(ctx.state.settings);
  }
}
