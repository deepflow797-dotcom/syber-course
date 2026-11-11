// @ts-check
/* Dynamic styling without inline `style` attributes.
   The CSP is `style-src 'self'`, so the browser ignores `style="..."` and `<style>` blocks entirely.
   Templates therefore carry classes (`assets/css/restore.css`, utility layer) for everything static, and
   leave the few data-driven values in `data-sv` attributes. This module reads those attributes after a
   render and writes the values into CSS custom properties with CSSOM (`style.setProperty`), which CSP
   does allow. Removing this pass degrades colours, never layout. */

/**
 * `data-sv` channel → the custom property it feeds.
 * `bg`/`fg`/`w`/`h` are page-local and namespaced (`--sv-*`); `status`/`pay`/`bar`/`accent` keep the
 * names the existing stylesheets already read, so a status pill or a pay rail styled before this change
 * keeps working unchanged.
 */
const CHANNELS = {
  bg: "--sv-bg",
  fg: "--sv-fg",
  w: "--sv-w",
  h: "--sv-h",
  status: "--status",
  pay: "--pay",
  bar: "--bar",
  accent: "--accent"
};

/**
 * Applies every `data-sv` attribute under `root` to its element's inline custom properties.
 * Format: `data-sv="bg:#ff6400;w:80"` (values are never HTML — they are set as CSS values only).
 * @param {ParentNode | null | undefined} root
 * @returns {number} how many elements were styled
 */
export function applyStyleVars(root) {
  if (!root || typeof (/** @type {any} */ (root).querySelectorAll) !== "function") return 0;
  const nodes = /** @type {any} */ (root).querySelectorAll("[data-sv]");
  let count = 0;
  for (const el of nodes) {
    const spec = el.getAttribute("data-sv");
    if (!spec) continue;
    for (const pair of spec.split(";")) {
      const at = pair.indexOf(":");
      if (at < 1) continue;
      const channel = pair.slice(0, at).trim();
      const value = pair.slice(at + 1).trim();
      const prop = CHANNELS[channel];
      if (!prop || !value) continue;
      el.style.setProperty(prop, value);
      count++;
    }
  }
  return count;
}

/**
 * Sets one channel on a single element (for values computed after the markup pass, e.g. a chart redraw).
 * @param {Element | null | undefined} el
 * @param {"bg"|"fg"|"status"|"pay"|"bar"|"accent"|"w"|"h"} channel
 * @param {string | number} value
 */
export function setChannel(el, channel, value) {
  const prop = CHANNELS[channel];
  if (!el || !prop) return;
  /** @type {HTMLElement} */ (el).style.setProperty(prop, String(value));
}

/**
 * Runs `applyStyleVars` on every mutation of the document body — one observer per page, so a renderer
 * never has to remember to call it after setting `innerHTML`.
 * @returns {void}
 */
export function watchStyleVars() {
  if (typeof MutationObserver !== "function") return;
  const run = (node) => applyStyleVars(node);
  run(document);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) run(/** @type {Element} */ (node));
      }
      if (record.type === "attributes" && record.target.nodeType === 1) run(/** @type {Element} */ (record.target));
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-sv"]
  });
}
