// @ts-check
export const uid = (prefix = "id") => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
export const nowISO = () => new Date().toISOString();
export const clone = (v) => JSON.parse(JSON.stringify(v));
export const roundMRU = (n, rate = 10.6) => Math.max(0, Math.round(((Number(n) || 0) * rate) / 5) * 5);
export const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
export const normalizeDigits = (v) => String(v || "").replace(/\D/g, "");
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const safeText = (v, max = 500) =>
  String(v ?? "")
    .trim()
    .slice(0, max);
