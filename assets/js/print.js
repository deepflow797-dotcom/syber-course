// @ts-check
/* Entry of print.html: fills the printable document and prints it.
   A separate module (not an inline script) because `script-src 'self'` forbids inline code. */
import { renderPrintDocument } from "./ui/dashboard/print-document.js";

const key = new URLSearchParams(location.search).get("doc") || "";
renderPrintDocument(window, window.opener || window, key);
