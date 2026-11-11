// @ts-check
/* The printable document (invoice / shipping label).
   A `window.open("")` document has an opaque origin, so under `style-src 'self'` it may not load a
   stylesheet and may not carry a `<style>` block — the printout would come out unstyled. The document is
   therefore rebuilt, in the same popup, from a real same-origin page (`print.html`) that loads
   `assets/css/print.css` normally; this module is what runs inside that page. */

/**
 * Replaces the page with the stored document body and prints it once the sheet has loaded.
 * @param {Window} win the popup window (same origin)
 * @param {Window} host the dashboard window, where the document was prepared
 * @param {string} key sessionStorage key holding `{ title, dir, lang, body }`
 */
export function renderPrintDocument(win, host, key) {
  const doc = /** @type {any} */ (win.document);
  const holder = doc.getElementById("print-root") || doc.body;
  const raw = host.sessionStorage.getItem(key);
  if (!raw) {
    holder.textContent = "Document unavailable — reopen the order.";
    return;
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    holder.textContent = "Document unavailable — reopen the order.";
    return;
  }
  /** @type {HTMLDocument} */ (doc).title = String(payload.title || "Document");
  doc.documentElement.lang = String(payload.lang || "ar");
  doc.documentElement.dir = String(payload.dir || "rtl");
  // The body is built exclusively from `esc()`-ed values in 05-orders.js (the same strings that were
  // written into the popup before); it is markup, not user input.
  holder.innerHTML = String(payload.body || "");

  const done = () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* the user can still print from the page menu */
    }
  };
  const sheet = doc.querySelector('link[rel="stylesheet"]');
  if (sheet && !sheet.sheet) sheet.addEventListener("load", done, { once: true });
  else win.setTimeout(done, 120);
}
