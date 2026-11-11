import ar from "./ar.js";
import fr from "./fr.js";
export const I18N = { ar, fr };
export function t(lang, key, vars = {}) {
  const dict = I18N[lang] || I18N.ar || {};
  let s = dict[key] ?? I18N.ar?.[key] ?? I18N.fr?.[key] ?? key;
  for (const [k, v] of Object.entries(vars || {})) s = String(s).replaceAll(`{${k}}`, String(v));
  return s;
}
export function L(lang, value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return value[lang] || value.ar || value.fr || Object.values(value).find(Boolean) || "";
}
export { ar, fr };
export default I18N;
