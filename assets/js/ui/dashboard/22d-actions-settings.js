/* dashboard.js → `[data-action]` handlers for settings routes (extracted verbatim from 22b-events-settings.js)
   Marketing, payments, cities, team, blog/pages, FAQ, reviews, audit, profile and owner settings.
   The former 107-branch switch is an action → handler map; each handler receives `{ ctx, node, event, index, id }`.
   The long async bodies (`save-profile-info`, `save-owner-*`, `change-own-pwd`) are named functions below. */

const ask = (ctx, ar, fr) => confirm(ctx.dt(ar, fr));
const ownerOnly = (ctx) => ctx.session?.role !== "owner";
const onlyOwnerToast = (ctx) => ctx.toast(ctx.dt("للمالك فقط", "Propriétaire uniquement"), "error");

/* ---------- marketing: coupons ---------- */

function couponActions(ctx) {
  return {
    "add-coupon": () => ctx.couponEditor(null),
    "edit-coupon": ({ index }) => ctx.couponEditor(index),
    "delete-coupon": ({ index }) => {
      if (ctx.tablesMode()) {
        const coupon = ctx.model.settings.coupons[index];
        if (coupon)
          ctx
            .catalogWrite(ctx.dt("تم حذف الكوبون", "Coupon supprimé"), () => ctx.CAT.deleteCoupon(coupon))
            .then(ctx.renderRoute);
        return;
      }
      ctx.model.settings.coupons.splice(index, 1);
      ctx.saveDraftNow();
      ctx.renderRoute();
    },
    "save-coupon": async ({ node }) => {
      if (!ctx.editBuffer) return;
      if (ctx.tablesMode()) {
        const prev = node.dataset.index === "" ? null : ctx.model.settings.coupons[Number(node.dataset.index)];
        const ok = await ctx.catalogWrite(
          ctx.dt("تم حفظ الكوبون في قاعدة البيانات", "Coupon enregistré en base"),
          async () => {
            if (prev && prev.code && prev.code.toUpperCase() !== String(ctx.editBuffer.code).toUpperCase())
              await ctx.CAT.deleteCoupon(prev); // code is the primary key
            await ctx.CAT.saveCoupon(ctx.editBuffer);
          }
        );
        if (ok) {
          ctx.closeModal();
          ctx.renderRoute();
        }
        return;
      }
      if (node.dataset.index === "") ctx.model.settings.coupons.push(ctx.editBuffer);
      else ctx.model.settings.coupons[Number(node.dataset.index)] = ctx.editBuffer;
      ctx.saveDraftNow();
      ctx.closeModal();
      ctx.renderRoute();
      ctx.toast(ctx.dt("تم حفظ الكوبون", "Coupon enregistré"), "good");
    }
  };
}

/* ---------- payments ---------- */

function paymentActions(ctx) {
  return {
    "add-payment": () => {
      ctx.editorKind = "payment";
      ctx.paymentEditor(null);
    },
    "edit-payment": ({ index }) => {
      ctx.editorKind = "payment";
      ctx.paymentEditor(index);
    },
    "delete-payment": ({ index }) => {
      if (ctx.model.settings.payments.length <= 1) {
        ctx.toast(ctx.dt("يجب ترك طريقة دفع واحدة على الأقل", "Gardez au moins un moyen de paiement"), "error");
        return;
      }
      ctx.model.settings.payments.splice(index, 1);
      ctx.saveDraftNow();
      ctx.renderRoute();
    },
    "delete-payment-buffer": () => {
      ctx.model.settings.payments = ctx.model.settings.payments.filter((item) => item.id !== ctx.editBuffer.id);
      ctx.saveDraftNow();
      ctx.closeModal();
      ctx.renderRoute();
    }
  };
}

/* ---------- shipping cities ---------- */

function cityActions(ctx) {
  return {
    "add-city": () => {
      ctx.editorKind = "city";
      ctx.cityEditor(null);
    },
    "edit-city": ({ index }) => {
      ctx.editorKind = "city";
      ctx.cityEditor(index);
    },
    "delete-city": ({ index }) => {
      ctx.model.settings.cities.splice(index, 1);
      ctx.saveDraftNow();
      ctx.renderRoute();
    },
    "delete-city-buffer": () => {
      ctx.model.settings.cities = ctx.model.settings.cities.filter((item) => item.id !== ctx.editBuffer.id);
      ctx.saveDraftNow();
      ctx.closeModal();
      ctx.renderRoute();
    }
  };
}

/* ---------- team ---------- */

function teamActions(ctx) {
  return {
    "add-manager": () => ctx.managerEditor(null),
    "edit-manager": ({ id }) => ctx.managerEditor(id),
    "delete-manager": ({ id }) => {
      if (!ask(ctx, "حذف حساب المدير؟", "Supprimer ce gérant ?")) return;
      try {
        ctx.R.deleteManager(id);
        ctx.renderRoute();
        ctx.toast(ctx.dt("تم حذف المدير", "Gérant supprimé"), "good");
      } catch (error) {
        ctx.toast(error.message, "error");
      }
    },
    "force-password": ({ id }) => {
      ctx.R.updateManager(id, { mustChange: true });
      ctx.renderRoute();
      ctx.toast(ctx.dt("سيُطلب تغيير كلمة المرور", "Changement de mot de passe requis"), "good");
    },
    "save-manager": () => ctx.saveManager(),
    "change-own-password": () => ctx.changeOwnPasswordModal(),
    "save-own-password": () => ctx.saveOwnPassword()
  };
}

/* ---------- blog, pages, FAQ, reviews ---------- */

function contentActions(ctx) {
  return {
    "add-post": () => ctx.postEditor(null),
    "edit-post": ({ index }) => ctx.postEditor(index),
    "delete-post": ({ index }) => {
      if (!ask(ctx, "حذف المقال؟", "Supprimer l’article ?")) return;
      ctx.model.blog.splice(index, 1);
      ctx.saveDraftNow();
      ctx.renderRoute();
    },
    "save-post": () => {
      if (!ctx.editBuffer) return;
      if (ctx.pendingPostIndex == null) ctx.model.blog.push(ctx.editBuffer);
      else ctx.model.blog[ctx.pendingPostIndex] = ctx.editBuffer;
      ctx.saveDraftNow();
      ctx.closeModal();
      ctx.renderRoute();
      ctx.toast(ctx.dt("تم حفظ المقال", "Article enregistré"), "good");
    },
    "add-page": () => ctx.pageEditor(null),
    "edit-page": ({ index }) => ctx.pageEditor(index),
    "delete-page": ({ index }) => {
      if (!ask(ctx, "حذف الصفحة؟", "Supprimer la page ?")) return;
      ctx.model.pages.splice(index, 1);
      ctx.saveDraftNow();
      ctx.renderRoute();
    },
    "save-page": () => ctx.savePageEditor(),
    "add-faq": () => ctx.faqEditor(null),
    "edit-faq": ({ index }) => ctx.faqEditor(index),
    "delete-faq": ({ index }) => {
      if (!ask(ctx, "حذف السؤال؟", "Supprimer la question ?")) return;
      ctx.model.faqs.splice(index, 1);
      ctx.saveDraftNow();
      ctx.renderRoute();
    },
    "save-faq": ({ node }) => {
      if (!ctx.editBuffer) return;
      if (node.dataset.index === "") ctx.model.faqs.push(ctx.editBuffer);
      else ctx.model.faqs[Number(node.dataset.index)] = ctx.editBuffer;
      ctx.saveDraftNow();
      ctx.closeModal();
      ctx.renderRoute();
      ctx.toast(ctx.dt("تم حفظ السؤال", "Question enregistrée"), "good");
    },
    "add-home-review": () => {
      ctx.editorKind = "review";
      ctx.reviewEditor("home", null);
    },
    "edit-home-review": ({ index }) => {
      ctx.editorKind = "review";
      ctx.reviewEditor("home", index);
    },
    "delete-home-review": ({ index }) => {
      ctx.model.homeReviews.splice(index, 1);
      ctx.saveDraftNow();
      ctx.renderRoute();
    },
    "add-product-review": () => {
      ctx.editorKind = "review";
      ctx.reviewEditor("product", null);
    },
    "edit-product-review": ({ index }) => {
      ctx.editorKind = "review";
      ctx.reviewEditor("product", index);
    },
    "delete-product-review": ({ index }) => {
      ctx.model.reviews.splice(index, 1);
      ctx.saveDraftNow();
      ctx.renderRoute();
    },
    "delete-review-buffer": () => {
      if (ctx.pendingReviewKind === "home")
        ctx.model.homeReviews = ctx.model.homeReviews.filter((item) => item.id !== ctx.editBuffer.id);
      else ctx.model.reviews = ctx.model.reviews.filter((item) => item.id !== ctx.editBuffer.id);
      ctx.saveDraftNow();
      ctx.closeModal();
      ctx.renderRoute();
    }
  };
}

/* ---------- customer review moderation ---------- */

function moderationActions(ctx) {
  const moderate =
    (decision, auditAr, auditFr, toastAr, toastFr) =>
    ({ id }) => {
      ctx.R.moderateReview(id, decision)
        .then(() => {
          ctx.R.addAudit(`${ctx.dt(auditAr, auditFr)}: ${id}`);
          ctx.renderRoute();
          ctx.toast(ctx.dt(toastAr, toastFr), "good");
        })
        .catch((error) => ctx.toast(error.message, "error"));
    };
  return {
    "approve-customer-review": moderate(
      "approve",
      "اعتماد تقييم عميل",
      "Avis client approuvé",
      "تم اعتماد التقييم",
      "Avis approuvé"
    ),
    "reject-customer-review": moderate(
      "reject",
      "رفض تقييم عميل",
      "Avis client refusé",
      "تم رفض التقييم",
      "Avis refusé"
    ),
    "delete-customer-review": ({ id }) => {
      if (!ask(ctx, "حذف التقييم نهائيًا؟", "Supprimer définitivement cet avis ?")) return;
      ctx.R.deleteCustomerReview(id)
        .then(() => {
          ctx.R.addAudit(`${ctx.dt("حذف تقييم عميل", "Avis client supprimé")}: ${id}`);
          ctx.renderRoute();
          ctx.toast(ctx.dt("تم حذف التقييم", "Avis supprimé"), "good");
        })
        .catch((error) => ctx.toast(error.message, "error"));
    },
    "clear-audit": () => {
      if (!ask(ctx, "مسح كل سجل النشاط؟", "Effacer tout le journal ?")) return;
      localStorage.removeItem("restore_audit_v1");
      ctx.renderRoute();
    }
  };
}

/* ---------- profile & owner settings ---------- */

/** Renames the logged-in manager in local demo mode (validated), keeping the session in sync. */
function renameSelfLocal(ctx, username) {
  if (ctx.R.remote || !username || username === ctx.session.username) return;
  if (!/^[a-z0-9._@-]{3,64}$/.test(username)) throw new Error(ctx.dt("اسم مستخدم غير صالح", "Identifiant invalide"));
  if (ctx.R.managers.some((m) => m.username === username && m.id !== ctx.session.id))
    throw new Error(ctx.dt("اسم المستخدم مستخدم", "Identifiant déjà utilisé"));
  ctx.R.updateManager(ctx.session.id, { username });
  ctx.session = { ...ctx.session, username };
  localStorage.setItem("restore_session_v1", JSON.stringify(ctx.session));
}

/** Validates and stores the WhatsApp number of the logged-in manager. */
function saveSelfWhatsapp(ctx, whatsapp) {
  if (!whatsapp) return;
  const digitsOnly = whatsapp.replace(/\D/g, "");
  if (digitsOnly && digitsOnly.length !== 8 && digitsOnly.length !== 11)
    throw new Error(ctx.dt("رقم واتساب غير صالح", "Numéro WhatsApp invalide"));
  ctx.R.updateManager(ctx.session.id, { whatsapp: digitsOnly });
}

/** Reads the profile form values. */
function readProfileForm(ctx) {
  return {
    username: ctx.$("#profile-username")?.value.trim(),
    nameAr: ctx.$("#profile-name-ar")?.value.trim(),
    nameFr: ctx.$("#profile-name-fr")?.value.trim(),
    email: ctx.$("#profile-email")?.value.trim(),
    whatsapp: ctx.$("#profile-whatsapp")?.value.trim()
  };
}

/** Applies the profile form to the managers table (thumbnail of the original body, same order). */
function applyProfileForm(ctx, form) {
  renameSelfLocal(ctx, form.username);
  if (form.nameAr || form.nameFr)
    ctx.R.updateManager(ctx.session.id, { name: { ar: form.nameAr || form.nameFr, fr: form.nameFr || form.nameAr } });
  if (form.email && !ctx.R.remote) ctx.R.updateManager(ctx.session.id, { email: form.email });
  saveSelfWhatsapp(ctx, form.whatsapp);
}

/** Profil form → managers table, in local demo mode and remote (extracted async IIFE). */
async function saveProfileInfo(ctx) {
  try {
    if (!ctx.session?.id)
      throw new Error(ctx.dt("الجلسة منتهية. أعد تسجيل الدخول.", "Session expirée. Reconnectez-vous."));
    applyProfileForm(ctx, readProfileForm(ctx));
    if (ctx.R.remote) await ctx.R.refreshStaff().catch(() => {});
    ctx.R.addAudit(`${ctx.dt("تحديث الملف الشخصي", "Profil mis à jour")}: ${ctx.session?.username}`);
    ctx.toast(ctx.dt("تم حفظ المعلومات", "Informations enregistrées"), "good");
    ctx.renderRoute();
  } catch (error) {
    ctx.toast(error.message, "error");
  }
}

const CONTACT_FIELDS = new Set([
  "storeName",
  "legalName",
  "tagline",
  "email",
  "whatsapp",
  "phone",
  "phoneDisplay",
  "address",
  "city",
  "hours"
]);

/** Reads the allowlisted contact inputs of the profile panel into a settings patch. */
function readContactPatch(ctx) {
  const patch = {};
  document.querySelectorAll("[data-dash-panel='profile-contact'] [data-edit-path]").forEach((input) => {
    const raw = String(input.dataset.editPath || "");
    if (!raw.startsWith("settings.")) return;
    const key = raw.slice("settings.".length);
    if (!CONTACT_FIELDS.has(key.split(".")[0])) return;
    const value = input.type === "checkbox" ? input.checked : input.value;
    ctx.setPath(patch, key, typeof value === "string" ? value.trim() : value);
  });
  return patch;
}

async function saveOwnerContact(ctx) {
  if (ownerOnly(ctx)) return onlyOwnerToast(ctx);
  const patch = readContactPatch(ctx);
  try {
    await ctx.R.updateOwnerSettings(patch);
    const next = ctx.clone(ctx.model);
    Object.entries(patch).forEach(([key, value]) => ctx.setPath(next, `settings.${key}`, value));
    ctx.model = next;
    ctx.saveDraftNow();
    ctx.R.addAudit(`${ctx.dt("تحديث تواصل المتجر", "Contact boutique mis à jour")}`);
    ctx.toast(ctx.dt("تم حفظ معلومات المتجر ونشرها", "Infos boutique enregistrées et publiées"), "good");
    ctx.renderRoute();
  } catch (error) {
    ctx.toast(error.message, "error");
  }
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

const toastPlatform = (ctx) =>
  ctx.toast(ctx.dt("اختر منصة صالحة لكل رابط", "Choisissez une plateforme valide pour chaque lien"), "error");
const toastHttps = (ctx) =>
  ctx.toast(ctx.dt("روابط السوشيال يجب أن تبدأ بـ https://", "Les liens doivent commencer par https://"), "error");

/** Normalises a typed URL to https:// (adding the scheme when the user omitted it). */
function normaliseSocialHref(href) {
  if (!href) return href;
  const withScheme = /^https?:\/\//i.test(href) ? href : `https://${href}`;
  return /^https:\/\//i.test(withScheme) ? withScheme : "";
}

/** One social row → `{ platform, href }`, `null` when empty, or `{ error }` when invalid. */
function readSocialRow(ctx, row) {
  const platform = String(row.querySelector("[data-social-platform]")?.value || "")
    .trim()
    .toLowerCase();
  const typed = String(row.querySelector("[data-social-url]")?.value || "").trim();
  if (!platform && !typed) return null;
  if (!SOCIAL_PLATFORMS.has(platform)) {
    toastPlatform(ctx);
    return { error: true };
  }
  const href = normaliseSocialHref(typed);
  if (!href) {
    toastHttps(ctx);
    return { error: true };
  }
  return { platform, href };
}

/** Reads the social rows, normalising the scheme; returns `{ ok: false }` when a row is invalid. */
function readSocialRows(ctx) {
  const socials = [];
  for (const row of document.querySelectorAll("[data-dash-panel='profile-social'] .social-row")) {
    const parsed = readSocialRow(ctx, row);
    if (parsed?.error) return { ok: false };
    if (parsed) socials.push(parsed);
  }
  return { ok: true, socials };
}

async function saveOwnerSocial(ctx) {
  if (ownerOnly(ctx)) return onlyOwnerToast(ctx);
  const parsed = readSocialRows(ctx);
  if (!parsed.ok) return;
  try {
    const saved = await ctx.R.updateOwnerSettings({ social: parsed.socials });
    const next = ctx.clone(ctx.model);
    next.settings.social = Array.isArray(saved.social)
      ? saved.social
      : parsed.socials.map((item) => ({ ...item, id: item.platform, icon: item.platform }));
    ctx.model = next;
    ctx.saveDraftNow();
    ctx.R.addAudit(`${ctx.dt("تحديث روابط السوشيال", "Liens sociaux mis à jour")}`);
    ctx.toast(ctx.dt("حُفظت الروابط ونُشرت", "Liens enregistrés et publiés"), "good");
    ctx.renderRoute();
  } catch (error) {
    ctx.toast(error.message, "error");
  }
}

const toastPasswordMismatch = (ctx) => ctx.toast(ctx.dt("تحقق من كلمات المرور", "Vérifiez les mots de passe"), "error");

/** Reads the three password inputs. */
function passwordInputs(ctx) {
  return {
    current: ctx.$("#sec-current")?.value || "",
    nextPwd: ctx.$("#sec-next")?.value || "",
    repeat: ctx.$("#sec-confirm")?.value || ""
  };
}

/** True when the three fields are filled and the confirmation matches. */
function passwordsMatch(fields) {
  return Boolean(fields.current && fields.nextPwd && fields.nextPwd === fields.repeat);
}

/** Validates the password form, toasting the first problem found. */
function passwordFieldsValid(ctx) {
  const fields = passwordInputs(ctx);
  if (!passwordsMatch(fields)) {
    toastPasswordMismatch(ctx);
    return false;
  }
  if (fields.nextPwd.length >= 8) return true;
  ctx.toast(ctx.dt("كلمة المرور 8 أحرف على الأقل", "Mot de passe : 8 caractères minimum"), "error");
  return false;
}

/** Reads and validates the change-password form; returns null (after a toast) when invalid. */
function readNewPassword(ctx) {
  if (!passwordFieldsValid(ctx)) return null;
  return { current: ctx.$("#sec-current").value, nextPwd: ctx.$("#sec-next").value };
}

async function changeOwnPassword(ctx) {
  const values = readNewPassword(ctx);
  if (!values) return;
  try {
    await ctx.R.changePassword(ctx.session.username, values.current, values.nextPwd, "");
    ctx.session = ctx.R.currentSession();
    ctx.toast(ctx.dt("تم تغيير كلمة المرور", "Mot de passe changé"), "good");
    ctx.$("#sec-current").value = "";
    ctx.$("#sec-next").value = "";
    ctx.$("#sec-confirm").value = "";
  } catch (error) {
    ctx.toast(error.message, "error");
  }
}

function ownerActions(ctx) {
  return {
    "save-profile-info": () => saveProfileInfo(ctx),
    "save-owner-contact": () => saveOwnerContact(ctx),
    "save-owner-social": () => saveOwnerSocial(ctx),
    "remove-social": ({ index }) => {
      if (ownerOnly(ctx)) return onlyOwnerToast(ctx);
      const next = ctx.clone(ctx.model);
      if (next.settings.social) next.settings.social.splice(Number(index), 1);
      ctx.model = next;
      ctx.saveDraftSoon();
      ctx.renderRoute();
    },
    "add-social-link": () => {
      if (ownerOnly(ctx)) return onlyOwnerToast(ctx);
      const next = ctx.clone(ctx.model);
      next.settings.social = next.settings.social || [];
      next.settings.social.push({ platform: "", href: "" });
      ctx.model = next;
      ctx.saveDraftSoon();
      ctx.renderRoute();
    },
    "change-own-pwd": () => changeOwnPassword(ctx)
  };
}

/** The complete `[data-action]` table for the settings routes. */
export function buildSettingsActions(ctx) {
  return {
    ...couponActions(ctx),
    ...paymentActions(ctx),
    ...cityActions(ctx),
    ...teamActions(ctx),
    ...contentActions(ctx),
    ...moderationActions(ctx),
    ...ownerActions(ctx)
  };
}
