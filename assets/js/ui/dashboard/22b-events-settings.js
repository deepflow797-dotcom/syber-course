/* dashboard.js → Event delegation (part 2b: marketing, payments, cities, team, blog/pages, FAQ, reviews, audit, profile)
   Same [data-action] dispatch as 22-events-forms.js; split to keep every module under 600 lines. */

export function install(ctx) {
  document.addEventListener("click", (event) => {
    const actionNode = event.target.closest("[data-action]");
    if (!actionNode) return;
    const action = actionNode.dataset.action;
    const index = actionNode.dataset.index != null ? Number(actionNode.dataset.index) : null;
    const id = actionNode.dataset.id || "";

    switch (action) {
      case "add-coupon":
        ctx.couponEditor(null);
        break;
      case "edit-coupon":
        ctx.couponEditor(index);
        break;
      case "delete-coupon":
        if (ctx.tablesMode()) {
          const c = ctx.model.settings.coupons[index];
          if (c)
            ctx
              .catalogWrite(ctx.dt("تم حذف الكوبون", "Coupon supprimé"), () => ctx.CAT.deleteCoupon(c))
              .then(ctx.renderRoute);
          break;
        }
        ctx.model.settings.coupons.splice(index, 1);
        ctx.saveDraftNow();
        ctx.renderRoute();
        break;
      case "save-coupon":
        if (!ctx.editBuffer) return;
        if (ctx.tablesMode()) {
          const prev =
            actionNode.dataset.index === "" ? null : ctx.model.settings.coupons[Number(actionNode.dataset.index)];
          ctx
            .catalogWrite(ctx.dt("تم حفظ الكوبون في قاعدة البيانات", "Coupon enregistré en base"), async () => {
              if (prev && prev.code && prev.code.toUpperCase() !== String(ctx.editBuffer.code).toUpperCase())
                await ctx.CAT.deleteCoupon(prev); // code is the primary key
              await ctx.CAT.saveCoupon(ctx.editBuffer);
            })
            .then((ok) => {
              if (ok) {
                ctx.closeModal();
                ctx.renderRoute();
              }
            });
          break;
        }
        if (actionNode.dataset.index === "") ctx.model.settings.coupons.push(ctx.editBuffer);
        else ctx.model.settings.coupons[Number(actionNode.dataset.index)] = ctx.editBuffer;
        ctx.saveDraftNow();
        ctx.closeModal();
        ctx.renderRoute();
        ctx.toast(ctx.dt("تم حفظ الكوبون", "Coupon enregistré"), "good");
        break;
      case "add-payment":
        ctx.editorKind = "payment";
        ctx.paymentEditor(null);
        break;
      case "edit-payment":
        ctx.editorKind = "payment";
        ctx.paymentEditor(index);
        break;
      case "delete-payment":
        if (ctx.model.settings.payments.length <= 1) {
          ctx.toast(ctx.dt("يجب ترك طريقة دفع واحدة على الأقل", "Gardez au moins un moyen de paiement"), "error");
          break;
        }
        ctx.model.settings.payments.splice(index, 1);
        ctx.saveDraftNow();
        ctx.renderRoute();
        break;
      case "delete-payment-buffer":
        ctx.model.settings.payments = ctx.model.settings.payments.filter((item) => item.id !== ctx.editBuffer.id);
        ctx.saveDraftNow();
        ctx.closeModal();
        ctx.renderRoute();
        break;
      case "add-city":
        ctx.editorKind = "city";
        ctx.cityEditor(null);
        break;
      case "edit-city":
        ctx.editorKind = "city";
        ctx.cityEditor(index);
        break;
      case "delete-city":
        ctx.model.settings.cities.splice(index, 1);
        ctx.saveDraftNow();
        ctx.renderRoute();
        break;
      case "delete-city-buffer":
        ctx.model.settings.cities = ctx.model.settings.cities.filter((item) => item.id !== ctx.editBuffer.id);
        ctx.saveDraftNow();
        ctx.closeModal();
        ctx.renderRoute();
        break;
      case "add-manager":
        ctx.managerEditor(null);
        break;
      case "edit-manager":
        ctx.managerEditor(id);
        break;
      case "delete-manager":
        if (confirm(ctx.dt("حذف حساب المدير؟", "Supprimer ce gérant ?"))) {
          try {
            ctx.R.deleteManager(id);
            ctx.renderRoute();
            ctx.toast(ctx.dt("تم حذف المدير", "Gérant supprimé"), "good");
          } catch (error) {
            ctx.toast(error.message, "error");
          }
        }
        break;
      case "force-password":
        ctx.R.updateManager(id, { mustChange: true });
        ctx.renderRoute();
        ctx.toast(ctx.dt("سيُطلب تغيير كلمة المرور", "Changement de mot de passe requis"), "good");
        break;
      case "save-manager":
        ctx.saveManager();
        break;
      case "change-own-password":
        ctx.changeOwnPasswordModal();
        break;
      case "save-own-password":
        ctx.saveOwnPassword();
        break;
      case "add-post":
        ctx.postEditor(null);
        break;
      case "edit-post":
        ctx.postEditor(index);
        break;
      case "delete-post":
        if (confirm(ctx.dt("حذف المقال؟", "Supprimer l’article ?"))) {
          ctx.model.blog.splice(index, 1);
          ctx.saveDraftNow();
          ctx.renderRoute();
        }
        break;
      case "save-post":
        if (!ctx.editBuffer) return;
        if (ctx.pendingPostIndex == null) ctx.model.blog.push(ctx.editBuffer);
        else ctx.model.blog[ctx.pendingPostIndex] = ctx.editBuffer;
        ctx.saveDraftNow();
        ctx.closeModal();
        ctx.renderRoute();
        ctx.toast(ctx.dt("تم حفظ المقال", "Article enregistré"), "good");
        break;
      case "add-page":
        ctx.pageEditor(null);
        break;
      case "edit-page":
        ctx.pageEditor(index);
        break;
      case "delete-page":
        if (confirm(ctx.dt("حذف الصفحة؟", "Supprimer la page ?"))) {
          ctx.model.pages.splice(index, 1);
          ctx.saveDraftNow();
          ctx.renderRoute();
        }
        break;
      case "save-page":
        ctx.savePageEditor();
        break;
      case "add-faq":
        ctx.faqEditor(null);
        break;
      case "edit-faq":
        ctx.faqEditor(index);
        break;
      case "delete-faq":
        if (confirm(ctx.dt("حذف السؤال؟", "Supprimer la question ?"))) {
          ctx.model.faqs.splice(index, 1);
          ctx.saveDraftNow();
          ctx.renderRoute();
        }
        break;
      case "save-faq":
        if (!ctx.editBuffer) return;
        if (actionNode.dataset.index === "") ctx.model.faqs.push(ctx.editBuffer);
        else ctx.model.faqs[Number(actionNode.dataset.index)] = ctx.editBuffer;
        ctx.saveDraftNow();
        ctx.closeModal();
        ctx.renderRoute();
        ctx.toast(ctx.dt("تم حفظ السؤال", "Question enregistrée"), "good");
        break;
      case "add-home-review":
        ctx.editorKind = "review";
        ctx.reviewEditor("home", null);
        break;
      case "edit-home-review":
        ctx.editorKind = "review";
        ctx.reviewEditor("home", index);
        break;
      case "delete-home-review":
        ctx.model.homeReviews.splice(index, 1);
        ctx.saveDraftNow();
        ctx.renderRoute();
        break;
      case "add-product-review":
        ctx.editorKind = "review";
        ctx.reviewEditor("product", null);
        break;
      case "edit-product-review":
        ctx.editorKind = "review";
        ctx.reviewEditor("product", index);
        break;
      case "delete-product-review":
        ctx.model.reviews.splice(index, 1);
        ctx.saveDraftNow();
        ctx.renderRoute();
        break;
      case "delete-review-buffer":
        if (ctx.pendingReviewKind === "home")
          ctx.model.homeReviews = ctx.model.homeReviews.filter((item) => item.id !== ctx.editBuffer.id);
        else ctx.model.reviews = ctx.model.reviews.filter((item) => item.id !== ctx.editBuffer.id);
        ctx.saveDraftNow();
        ctx.closeModal();
        ctx.renderRoute();
        break;
      case "approve-customer-review": {
        ctx.R.moderateReview(id, "approve")
          .then(() => {
            ctx.R.addAudit(`${ctx.dt("اعتماد تقييم عميل", "Avis client approuvé")}: ${id}`);
            ctx.renderRoute();
            ctx.toast(ctx.dt("تم اعتماد التقييم", "Avis approuvé"), "good");
          })
          .catch((error) => ctx.toast(error.message, "error"));
        break;
      }
      case "reject-customer-review": {
        ctx.R.moderateReview(id, "reject")
          .then(() => {
            ctx.R.addAudit(`${ctx.dt("رفض تقييم عميل", "Avis client refusé")}: ${id}`);
            ctx.renderRoute();
            ctx.toast(ctx.dt("تم رفض التقييم", "Avis refusé"), "good");
          })
          .catch((error) => ctx.toast(error.message, "error"));
        break;
      }
      case "delete-customer-review": {
        if (confirm(ctx.dt("حذف التقييم نهائيًا؟", "Supprimer définitivement cet avis ?"))) {
          ctx.R.deleteCustomerReview(id)
            .then(() => {
              ctx.R.addAudit(`${ctx.dt("حذف تقييم عميل", "Avis client supprimé")}: ${id}`);
              ctx.renderRoute();
              ctx.toast(ctx.dt("تم حذف التقييم", "Avis supprimé"), "good");
            })
            .catch((error) => ctx.toast(error.message, "error"));
        }
        break;
      }
      case "clear-audit":
        if (confirm(ctx.dt("مسح كل سجل النشاط؟", "Effacer tout le journal ?"))) {
          localStorage.removeItem("restore_audit_v1");
          ctx.renderRoute();
        }
        break;
      case "save-profile-info": {
        const username = ctx.$("#profile-username")?.value.trim();
        const nameAr = ctx.$("#profile-name-ar")?.value.trim();
        const nameFr = ctx.$("#profile-name-fr")?.value.trim();
        const email = ctx.$("#profile-email")?.value.trim();
        const whatsapp = ctx.$("#profile-whatsapp")?.value.trim();
        (async () => {
          try {
            if (!ctx.session?.id)
              throw new Error(ctx.dt("الجلسة منتهية. أعد تسجيل الدخول.", "Session expirée. Reconnectez-vous."));
            if (!ctx.R.remote && username && username !== ctx.session.username) {
              if (!/^[a-z0-9._@-]{3,64}$/.test(username))
                throw new Error(ctx.dt("اسم مستخدم غير صالح", "Identifiant invalide"));
              if (ctx.R.managers.some((m) => m.username === username && m.id !== ctx.session.id))
                throw new Error(ctx.dt("اسم المستخدم مستخدم", "Identifiant déjà utilisé"));
              ctx.R.updateManager(ctx.session.id, { username });
              ctx.session = { ...ctx.session, username };
              localStorage.setItem("restore_session_v1", JSON.stringify(ctx.session));
            }
            if (nameAr || nameFr)
              ctx.R.updateManager(ctx.session.id, { name: { ar: nameAr || nameFr, fr: nameFr || nameAr } });
            if (email && !ctx.R.remote) ctx.R.updateManager(ctx.session.id, { email });
            if (whatsapp) {
              const digitsOnly = whatsapp.replace(/\D/g, "");
              if (digitsOnly && digitsOnly.length !== 8 && digitsOnly.length !== 11)
                throw new Error(ctx.dt("رقم واتساب غير صالح", "Numéro WhatsApp invalide"));
              ctx.R.updateManager(ctx.session.id, { whatsapp: digitsOnly });
            }
            if (ctx.R.remote) await ctx.R.refreshStaff().catch(() => {});
            ctx.R.addAudit(`${ctx.dt("تحديث الملف الشخصي", "Profil mis à jour")}: ${ctx.session?.username}`);
            ctx.toast(ctx.dt("تم حفظ المعلومات", "Informations enregistrées"), "good");
            ctx.renderRoute();
          } catch (error) {
            ctx.toast(error.message, "error");
          }
        })();
        break;
      }
      case "save-owner-contact": {
        if (ctx.session?.role !== "owner") return ctx.toast(ctx.dt("للمالك فقط", "Propriétaire uniquement"), "error");
        const allowed = new Set([
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
        const patch = {};
        document.querySelectorAll("[data-dash-panel='profile-contact'] [data-edit-path]").forEach((inp) => {
          const raw = String(inp.dataset.editPath || "");
          if (!raw.startsWith("settings.")) return;
          const key = raw.slice("settings.".length);
          if (!allowed.has(key.split(".")[0])) return;
          const val = inp.type === "checkbox" ? inp.checked : inp.value;
          ctx.setPath(patch, key, typeof val === "string" ? val.trim() : val);
        });
        (async () => {
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
        })();
        break;
      }
      case "save-owner-social": {
        if (ctx.session?.role !== "owner") return ctx.toast(ctx.dt("للمالك فقط", "Propriétaire uniquement"), "error");
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
        const socials = [];
        const rows = document.querySelectorAll("[data-dash-panel='profile-social'] .social-row");
        for (const row of rows) {
          const platform = String(row.querySelector("[data-social-platform]")?.value || "")
            .trim()
            .toLowerCase();
          let href = String(row.querySelector("[data-social-url]")?.value || "").trim();
          if (!platform && !href) continue;
          if (!allowed.has(platform))
            return ctx.toast(
              ctx.dt("اختر منصة صالحة لكل رابط", "Choisissez une plateforme valide pour chaque lien"),
              "error"
            );
          if (href && !/^https?:\/\//i.test(href)) href = `https://${href}`;
          if (!/^https:\/\//i.test(href))
            return ctx.toast(
              ctx.dt("روابط السوشيال يجب أن تبدأ بـ https://", "Les liens doivent commencer par https://"),
              "error"
            );
          socials.push({ platform, href });
        }
        (async () => {
          try {
            const saved = await ctx.R.updateOwnerSettings({ social: socials });
            const next = ctx.clone(ctx.model);
            next.settings.social = Array.isArray(saved.social)
              ? saved.social
              : socials.map((item) => ({ ...item, id: item.platform, icon: item.platform }));
            ctx.model = next;
            ctx.saveDraftNow();
            ctx.R.addAudit(`${ctx.dt("تحديث روابط السوشيال", "Liens sociaux mis à jour")}`);
            ctx.toast(ctx.dt("حُفظت الروابط ونُشرت", "Liens enregistrés et publiés"), "good");
            ctx.renderRoute();
          } catch (error) {
            ctx.toast(error.message, "error");
          }
        })();
        break;
      }
      case "remove-social": {
        if (ctx.session?.role !== "owner") return ctx.toast(ctx.dt("للمالك فقط", "Propriétaire uniquement"), "error");
        const idx = Number(actionNode.dataset.index);
        const next = ctx.clone(ctx.model);
        if (next.settings.social) next.settings.social.splice(idx, 1);
        ctx.model = next;
        ctx.saveDraftSoon();
        ctx.renderRoute();
        break;
      }
      case "add-social-link": {
        if (ctx.session?.role !== "owner") return ctx.toast(ctx.dt("للمالك فقط", "Propriétaire uniquement"), "error");
        const next = ctx.clone(ctx.model);
        next.settings.social = next.settings.social || [];
        next.settings.social.push({ platform: "", href: "" });
        ctx.model = next;
        ctx.saveDraftSoon();
        ctx.renderRoute();
        break;
      }
      case "change-own-pwd": {
        const current = ctx.$("#sec-current")?.value || "";
        const nextPwd = ctx.$("#sec-next")?.value || "";
        const confirm = ctx.$("#sec-confirm")?.value || "";
        if (!current || !nextPwd || nextPwd !== confirm)
          return ctx.toast(ctx.dt("تحقق من كلمات المرور", "Vérifiez les mots de passe"), "error");
        if (nextPwd.length < 8)
          return ctx.toast(ctx.dt("كلمة المرور 8 أحرف على الأقل", "Mot de passe : 8 caractères minimum"), "error");
        (async () => {
          try {
            await ctx.R.changePassword(ctx.session.username, current, nextPwd, "");
            ctx.session = ctx.R.currentSession();
            ctx.toast(ctx.dt("تم تغيير كلمة المرور", "Mot de passe changé"), "good");
            ctx.$("#sec-current").value = "";
            ctx.$("#sec-next").value = "";
            ctx.$("#sec-confirm").value = "";
          } catch (error) {
            ctx.toast(error.message, "error");
          }
        })();
        break;
      }
      default:
        break;
    }
  });
}
