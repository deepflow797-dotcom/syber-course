// @ts-check
export function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}
/* Schemes that execute code when a URL is followed.
   The comparison runs on a copy with every C0 control character and space removed, because browsers strip those
   while parsing a scheme: `java\tscript:`, `java\nscript:` and `\u0000javascript:` all navigate to javascript:. */
const UNSAFE_SCHEME = /^(javascript|vbscript|data):/i;
const normalizeScheme = (value) => value.replace(/[\u0000-\u0020]+/g, "").replace(/\u00a0/g, "");

/** Escapes a value for an HTML attribute. Aliased on `ctx` so templates read uniformly. */
export const escAttr = esc;

/**
 * Escapes a value for an HTML attribute **and** refuses URL schemes that execute code.
 * `esc()` alone is not enough for `href`/`src`: `esc()` keeps `javascript:` intact, and a single unescaped
 * quote in a merchant-set logo or image URL is enough to add a new attribute to the element
 * (audit finding #2 of 1.8.2). Everything that reaches `src`, `href` or a `data-*` URL goes through this.
 * Relative paths, `http(s)`, `mailto:`, `tel:` and `data:image/…` are allowed; anything else becomes "".
 * @param {unknown} value
 * @returns {string}
 */
export function urlAttr(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const scheme = normalizeScheme(raw.toLowerCase());
  if (UNSAFE_SCHEME.test(scheme)) {
    // a data: URL is only acceptable for an image payload, never for a document or a script
    if (!scheme.startsWith("data:image/")) return "";
  }
  return esc(raw);
}

export function sanitizeRichHTML(html) {
  const raw = String(html ?? "");
  const DP = globalThis.DOMPurify;
  if (DP && typeof DP.sanitize === "function") {
    return DP.sanitize(raw, {
      ALLOWED_TAGS: [
        "a",
        "b",
        "strong",
        "i",
        "em",
        "u",
        "p",
        "br",
        "ul",
        "ol",
        "li",
        "h1",
        "h2",
        "h3",
        "h4",
        "blockquote",
        "code",
        "pre",
        "span",
        "div",
        "img",
        "figure",
        "figcaption",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "hr",
        "small",
        "mark"
      ],
      ALLOWED_ATTR: [
        "href",
        "target",
        "rel",
        "src",
        "alt",
        "title",
        "width",
        "height",
        "loading",
        "class",
        "id",
        "dir",
        "lang",
        "colspan",
        "rowspan"
      ],
      FORBID_ATTR: ["style"],
      FORBID_TAGS: [
        "script",
        "style",
        "iframe",
        "object",
        "embed",
        "form",
        "input",
        "button",
        "textarea",
        "select",
        "meta",
        "link",
        "base"
      ],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ["target", "rel"]
    });
  }
  return esc(raw);
}
