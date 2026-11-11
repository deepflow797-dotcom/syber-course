// @ts-check
/* state.js → Query, pricing and store utilities
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */
import { effectiveUnitPrice } from "../domain/pricing.js";

export function install(ctx) {
  Object.assign(ctx, {
    normalizeText,
    queryTokens,
    productSearchText,
    matchesQuery,
    effectivePrice,
    bestCardImage,
    isStoreOpen,
    orderId,
    decrementStock,
    statusMeta,
    formatPhone
  });
  const AR_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(AR_DIACRITICS, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const STOP_WORDS = new Set(["series", "série", "serie", "the", "and", "with", "من", "سلسلة", "ال", "في"]);
  function queryTokens(query) {
    return normalizeText(query)
      .split(" ")
      .filter((token) => token && !STOP_WORDS.has(token));
  }
  function productSearchText(product) {
    const options = (product.options || []).flatMap((option) => [option.name, ...(option.values || [])]);
    return normalizeText(
      [
        product.title,
        product.vendor,
        product.type,
        product.handle,
        product.sku,
        ...(product.collections || []),
        ...options,
        product.condition
      ].join(" ")
    );
  }
  function matchesQuery(product, query) {
    const tokens = queryTokens(query);
    if (!tokens.length) return true;
    const haystack = productSearchText(product);
    return tokens.every((token) => haystack.includes(token));
  }
  function effectivePrice(product) {
    const variants = (product.variants || []).filter((v) => v.available);
    if (!variants.length) return effectiveUnitPrice(product);
    return Math.min(effectiveUnitPrice(product), ...variants.map((v) => effectiveUnitPrice(product, v)));
  }
  function bestCardImage(product) {
    return product.image || product.images?.[0] || "";
  }
  function isStoreOpen(date = new Date()) {
    const hours = ctx.state.settings.hours || {};
    if (hours.closed || hours.maintenance) return false;
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: ctx.state.settings.timezone || "Africa/Nouakchott",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).formatToParts(date);
      const get = (type) => parts.find((part) => part.type === type)?.value;
      const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const day = map[get("weekday")];
      if (!(hours.days || [0, 1, 2, 3, 4, 5, 6]).includes(day)) return false;
      const current = Number(get("hour")) * 60 + Number(get("minute"));
      const [openHour, openMinute] = String(hours.open || "09:00")
        .split(":")
        .map(Number);
      const [closeHour, closeMinute] = String(hours.close || "19:00")
        .split(":")
        .map(Number);
      const start = openHour * 60 + openMinute;
      const end = closeHour * 60 + closeMinute;
      return end < start ? current >= start || current < end : current >= start && current < end;
    } catch {
      return true;
    }
  }
  function orderId() {
    const date = new Date();
    return `RS-${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }
  /** Optimistic local stock update after checkout (authoritative stock lives in restore_products).
   * @param {Array<{ handle: string, qty?: number }>} items */
  function decrementStock(items) {
    try {
      const next = ctx.clone(ctx.state);
      for (const item of items || []) {
        const product = next.products.find((candidate) => candidate.handle === item.handle);
        if (!product) continue;
        product.stock = Math.max(0, Number(product.stock || 0) - Number(item.qty || 1));
        product.lowStock = product.stock <= Number(next.settings.lowStockThreshold || 2);
      }
      next.updatedAt = ctx.nowISO();
      ctx.state = next;
      ctx.writeJSON(ctx.LS_STATE, ctx.state);
      ctx.channel?.postMessage({ type: "state", updatedAt: ctx.state.updatedAt });
      window.dispatchEvent(new CustomEvent("restore:changed", { detail: { source: "stock" } }));
    } catch (error) {
      console.warn("Restore: could not update local stock", error);
    }
  }
  function statusMeta(id) {
    const map = {
      new: { label: ctx.txt("جديد", "Nouveau"), color: "#ff6400" },
      confirmed: { label: ctx.txt("مؤكد", "Confirmé"), color: "#0b6fb8" },
      preparing: { label: ctx.txt("قيد التجهيز", "En préparation"), color: "#8e44ad" },
      shipped: { label: ctx.txt("تم الشحن", "Expédié"), color: "#00a651" },
      delivered: { label: ctx.txt("تم التسليم", "Livré"), color: "#2e7d32" },
      cancelled: { label: ctx.txt("ملغي", "Annulé"), color: "#c0392b" },
      returned: { label: ctx.txt("مرتجع", "Retourné"), color: "#7f8c8d" }
    };
    return map[id] || map.new;
  }
  function formatPhone(value) {
    const digits = ctx.normalizeDigits(value);
    if (digits.startsWith("222") && digits.length >= 11)
      return `+222 ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`.trim();
    if (digits.length === 8)
      return `+222 ${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`;
    return value || "";
  }
  Object.assign(ctx, { AR_DIACRITICS, STOP_WORDS });
}
