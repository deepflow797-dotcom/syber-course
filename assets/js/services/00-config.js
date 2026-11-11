// @ts-check
/* state.js → prelude
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */
import { esc as escDom, sanitizeRichHTML as sanitizeDom } from "../core/dom.js";

export function install(ctx) {
  Object.assign(ctx, {
    readJSON,
    writeJSON,
    readSessionMeta,
    writeSessionMeta,
    sessionMetaOf,
    clearSessionTimers,
    scheduleSessionRefresh,
    touchActivity,
    setupIdleLogout,
    isPlainObject,
    merge
  });
  const CFG = Object.assign(
    {
      supabaseUrl: "",
      supabaseAnonKey: "",
      mode: "auto",
      demoEnabled: false,
      createOrderFunction: "create-order",
      stateTable: "restore_state",
      ordersTable: "restore_orders",
      abandonedTable: "restore_abandoned",
      auditTable: "restore_audit",
      customersTable: "restore_customers",
      reviewsTable: "restore_reviews",
      pagesTable: "restore_pages",
      staffTable: "restore_staff",
      mediaBucket: "restore-media",
      createStaffFunction: "admin-create-staff",
      pollMs: 5000
    },
    window.RESTORE_CONFIG || {}
  );

  const REMOTE = CFG.mode !== "local" && Boolean(CFG.supabaseUrl && CFG.supabaseAnonKey);
  const LOCAL_DEV = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname || "");
  const DEMO_ALLOWED = !REMOTE && CFG.demoEnabled === true && LOCAL_DEV;
  const LS_STATE = "restore_state_v1";
  const LS_DRAFT = "restore_draft_v1";
  const LS_MANAGERS = "restore_managers_v2";
  const LS_ORDERS = "restore_orders_v1";
  const LS_ABANDONED = "restore_abandoned_v1";
  const LS_AUDIT = "restore_audit_v1";
  const LS_SESSION = "restore_session_v1";
  const LS_CUSTOMER = "restore_customer_v1";
  const LS_CUSTOMERS = "restore_customers_v1";
  const LS_CUSTOMER_SESSION = "restore_customer_session_v1";
  const LS_REVIEWS = "restore_reviews_v1";
  const LS_LOGIN_ATTEMPTS = "restore_login_attempts_v1";
  const LS_LANG = "restore_lang_v1";
  const LS_THEME = "restore_theme_v1";
  const SYNC_CHANNEL = "restore_sync_v1";
  const CURRENCY_RATE = 10.6;
  const SALT = "restore-salt:";
  const MAX_REMOTE_REVIEWS = 500;
  const MAX_WISHLIST = 200;
  const SESSION_REFRESH_BEFORE_MS = 120000;
  const DASHBOARD_IDLE_MS = 30 * 60 * 1000;
  const SESSION_META_KEYS = new Set([
    "mode",
    "id",
    "authId",
    "username",
    "email",
    "role",
    "name",
    "mustChange",
    "loggedAt",
    "expiresAt",
    "whatsapp"
  ]);

  // Tokens are kept in memory only; never persisted to localStorage/sessionStorage.
  const tokenVault = { accessToken: "", refreshToken: "" };
  ctx.refreshTimer = null;
  ctx.idleTimer = null;
  ctx.lastActivity = Date.now();

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const nowISO = () => new Date().toISOString();
  const roundMRU = (n) => Math.max(0, Math.round(((Number(n) || 0) * CURRENCY_RATE) / 5) * 5);
  const uid = (prefix = "id") => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn("Restore: storage write failed", err);
      return false;
    }
  }
  function readSessionMeta() {
    try {
      const raw = sessionStorage.getItem(LS_SESSION);
      if (raw) return JSON.parse(raw);
    } catch {}
    // Migrate/clear legacy persistent sessions that may contain tokens.
    try {
      localStorage.removeItem(LS_SESSION);
    } catch {}
    return null;
  }
  function writeSessionMeta(meta) {
    try {
      if (meta) sessionStorage.setItem(LS_SESSION, JSON.stringify(meta));
      else sessionStorage.removeItem(LS_SESSION);
    } catch {}
    try {
      localStorage.removeItem(LS_SESSION);
    } catch {}
  }
  function sessionMetaOf(next) {
    if (!next) return null;
    const meta = {};
    for (const k of SESSION_META_KEYS) if (next[k] !== undefined) meta[k] = next[k];
    return meta;
  }
  function clearSessionTimers() {
    if (ctx.refreshTimer) {
      clearTimeout(ctx.refreshTimer);
      ctx.refreshTimer = null;
    }
  }
  function scheduleSessionRefresh() {
    clearSessionTimers();
    if (!ctx.session || ctx.session.mode !== "supabase" || !ctx.session.expiresAt) return;
    const wait = Math.max(5000, Number(ctx.session.expiresAt) - Date.now() - SESSION_REFRESH_BEFORE_MS);
    ctx.refreshTimer = setTimeout(() => {
      ctx.remoteSessionValid({ force: true }).catch(() => {});
    }, wait);
  }
  function touchActivity() {
    ctx.lastActivity = Date.now();
  }
  function setupIdleLogout() {
    if (ctx.idleTimer || !/dashboard\.html/i.test(location.pathname || "")) return;
    ["click", "keydown", "mousemove", "touchstart", "scroll"].forEach((ev) =>
      window.addEventListener(ev, touchActivity, { passive: true })
    );
    ctx.idleTimer = setInterval(() => {
      if (ctx.session && Date.now() - ctx.lastActivity > DASHBOARD_IDLE_MS) ctx.logout();
    }, 30000);
  }
  function isPlainObject(v) {
    return v && typeof v === "object" && !Array.isArray(v);
  }
  function merge(base, override) {
    if (Array.isArray(override)) return clone(override);
    if (!isPlainObject(override)) return override === undefined ? base : override;
    const out = isPlainObject(base) ? clone(base) : {};
    for (const [key, value] of Object.entries(override)) out[key] = merge(base?.[key], value);
    return out;
  }
  const escText = escDom;
  const sanitizeRichHTML = sanitizeDom;

  const txt = (ar, fr) => ({ ar, fr });
  const name = (ar, fr) => ({ ar, fr });
  Object.assign(ctx, {
    CFG,
    REMOTE,
    LOCAL_DEV,
    DEMO_ALLOWED,
    LS_STATE,
    LS_DRAFT,
    LS_MANAGERS,
    LS_ORDERS,
    LS_ABANDONED,
    LS_AUDIT,
    LS_SESSION,
    LS_CUSTOMER,
    LS_CUSTOMERS,
    LS_CUSTOMER_SESSION,
    LS_REVIEWS,
    LS_LOGIN_ATTEMPTS,
    LS_LANG,
    LS_THEME,
    SYNC_CHANNEL,
    CURRENCY_RATE,
    SALT,
    MAX_REMOTE_REVIEWS,
    MAX_WISHLIST,
    SESSION_REFRESH_BEFORE_MS,
    DASHBOARD_IDLE_MS,
    SESSION_META_KEYS,
    tokenVault,
    clone,
    nowISO,
    roundMRU,
    uid,
    escText,
    sanitizeRichHTML,
    txt,
    name
  });
}
