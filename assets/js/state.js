// @ts-check
/* ==========================================================================
   Restore — shared store state, local/Supabase sync, language and utilities
   ES module (also exposes window.RESTORE for legacy compatibility)
   ========================================================================== */
/* Assembler only — the implementation lives in services/* (one `install(ctx)` per feature, ≤600 lines each).
   `ctx` is the shared context object: every module registers its functions/constants on it and reads
   shared mutable state (e.g. ctx.state, ctx.session) from it. Install order matters and mirrors the
   original top-to-bottom order of the former monolith. See docs/ARCHITECTURE.md. */

let R;

const RAW = window.STORE;

import { install as s0 } from "./services/00-config.js";
import { install as s1p } from "./services/01-default-pages.js";
import { install as s1a } from "./services/01-default-texts.js";
import { install as s1 } from "./services/01-default-content.js";
import { install as s2 } from "./services/02-state-hydration.js";
import { install as s3 } from "./services/03-shared-utils.js";
import { install as s4 } from "./services/04-staff-auth.js";
import { install as s5 } from "./services/05-supabase-rest.js";
import { install as s6 } from "./services/06-orders.js";
import { install as s7 } from "./services/07-publish.js";
import { install as s8 } from "./services/08-catalog.js";
import { install as s9 } from "./services/09-customers.js";
import { install as s10 } from "./services/10-reviews.js";
import { install as s11 } from "./services/11-currency.js";
import { install as s12 } from "./services/12-pages-settings.js";
import { install as s13 } from "./services/13-store-utils.js";
import { install as s14 } from "./services/14-sync-events.js";
import { install as s15 } from "./services/15-backup.js";

if (!RAW) {
  console.warn("Restore: window.STORE missing");
} else {
  const ctx = {};
  ctx.RAW = RAW;
  s0(ctx); // prelude
  s1p(ctx); // Default pages / press / blog
  s1a(ctx); // Default texts (FAQ, nav, payments, cities…)
  s1(ctx); // Default content (products, buildState, hydrate)
  s2(ctx); // Default content (part 2)
  s3(ctx); // Utilities shared by auth, reviews and media
  s4(ctx); // Managers and staff sessions
  s5(ctx); // Supabase REST helpers
  s6(ctx); // Orders, abandoned carts and audit
  s7(ctx); // Published state, drafts and remote polling
  s8(ctx); // Catalog (products / collections / coupons) — relational source of truth
  s9(ctx); // Customer accounts, addresses and wishlist
  s10(ctx); // Product reviews (moderated)
  s11(ctx); // Currency display
  s12(ctx); // Content pages and owner settings
  s13(ctx); // Query, pricing and store utilities
  s14(ctx); // Cross-tab and cross-device notifications
  s15(ctx); // Backup export / import (P4)
  ctx.applyDocument();
  R = {
    config: ctx.CFG,
    remote: ctx.REMOTE,
    demoAllowed: ctx.DEMO_ALLOWED,
    localDev: ctx.LOCAL_DEV,
    get state() {
      return ctx.state;
    },
    set state(value) {
      ctx.state = value;
    },
    get store() {
      return ctx.state;
    },
    get draft() {
      return ctx.draft;
    },
    get lang() {
      return ctx.lang;
    },
    get theme() {
      return ctx.theme;
    },
    get managers() {
      return ctx.managerPublic();
    },
    get orders() {
      return ctx.getOrders();
    },
    get abandoned() {
      return ctx.getAbandoned();
    },
    get audit() {
      return ctx.getAudit();
    },
    escText: ctx.escText,
    sanitizeRichHTML: ctx.sanitizeRichHTML,
    sanitizeHTML: ctx.sanitizeRichHTML,
    t: ctx.t,
    L: ctx.L,
    money: ctx.money,
    formatDate: ctx.formatDate,
    formatPhone: ctx.formatPhone,
    formatCurrency: ctx.formatCurrency,
    normalizeText: ctx.normalizeText,
    matchesQuery: ctx.matchesQuery,
    queryTokens: ctx.queryTokens,
    safeHref: ctx.safeHref,
    setLang: ctx.setLang,
    setTheme: ctx.setTheme,
    applyDocument: ctx.applyDocument,
    clone: ctx.clone,
    uid: ctx.uid,
    uploadMedia: ctx.uploadMedia,
    resizeImage: ctx.resizeImage,
    effectivePrice: ctx.effectivePrice,
    bestCardImage: ctx.bestCardImage,
    isStoreOpen: ctx.isStoreOpen,
    getCurrencyMode: ctx.getCurrencyMode,
    setCurrencyMode: ctx.setCurrencyMode,
    login: ctx.login,
    logout: ctx.logout,
    currentSession: ctx.currentSession,
    changePassword: ctx.changePassword,
    changeOwnerPassword: ctx.changeOwnerPassword,
    addManager: ctx.addManager,
    updateManager: ctx.updateManager,
    deleteManager: ctx.deleteManager,
    refreshStaff: ctx.refreshStaff,
    customerLogin: ctx.customerLogin,
    customerRegister: ctx.customerRegister,
    customerLogout: ctx.customerLogout,
    getCustomer: ctx.getCustomer,
    getCustomerSession: ctx.getCustomerSession,
    restoreCustomerSession: ctx.restoreCustomerSession,
    customerSyncWishlist: ctx.customerSyncWishlist,
    customerToggleWishlist: ctx.customerToggleWishlist,
    customerAddAddress: ctx.customerAddAddress,
    customerUpdateAddress: ctx.customerUpdateAddress,
    customerDeleteAddress: ctx.customerDeleteAddress,
    getCustomerOrders: ctx.getCustomerOrders,
    getOrders: ctx.getOrders,
    addOrder: ctx.addOrder,
    submitOrder: ctx.submitOrder,
    updateOrder: ctx.updateOrder,
    refreshOrders: ctx.refreshOrders,
    submitReview: ctx.submitReview,
    moderateReview: ctx.moderateReview,
    deleteCustomerReview: ctx.deleteCustomerReview,
    refreshReviews: ctx.refreshReviews,
    getProductReviews: ctx.getProductReviews,
    getPendingReviews: ctx.getPendingReviews,
    getAllCustomerReviews: ctx.getAllCustomerReviews,
    customerReviews: ctx.customerReviews,
    addReview: ctx.submitReview,
    getApprovedReviews: ctx.getProductReviews,
    orderId: ctx.orderId,
    statusMeta: ctx.statusMeta,
    decrementStock: ctx.decrementStock,
    getAbandoned: ctx.getAbandoned,
    saveAbandoned: ctx.saveAbandoned,
    removeAbandoned: ctx.removeAbandoned,
    getPages: ctx.getPages,
    getPage: ctx.getPage,
    savePage: ctx.savePage,
    deletePage: ctx.deletePage,
    updateOwnerSettings: ctx.updateOwnerSettings,
    getAudit: ctx.getAudit,
    addAudit: ctx.addAudit,
    publish: ctx.publish,
    saveDraft: ctx.saveDraft,
    discardDraft: ctx.discardDraft,
    useDraft: ctx.useDraft,
    resetLocalDemo: ctx.resetLocalDemo,
    backupExport: ctx.backupExport,
    backupPreview: ctx.backupPreview,
    backupApply: ctx.backupApply,
    backupRestorePrevious: ctx.backupRestorePrevious,
    loadRemoteState: ctx.loadRemoteState,
    catalog: ctx.catalog,
    loadCatalog: ctx.loadCatalog,
    supa: ctx.supa,
    remoteSessionValid: ctx.remoteSessionValid,
    get statuses() {
      return ["new", "confirmed", "preparing", "shipped", "delivered", "cancelled", "returned"];
    }
  };
  window.RESTORE = R;
}

export { R };
export default R;
