/* Test helper: boot the real storefront (window.RESTORE) in jsdom, LOCAL demo mode, no network.
   Re-uses scripts/seed-catalog.mjs so tests and the SQL seed exercise the exact same boot path. */
import { fileURLToPath } from "node:url";
export { bootStorefront } from "../../scripts/seed-catalog.mjs";
export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
