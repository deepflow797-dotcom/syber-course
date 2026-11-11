// @ts-check
export function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
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
