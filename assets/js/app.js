// @ts-check
/* ==========================================================================
   Restore storefront — front-end application (ES module)
   ========================================================================== */

import { watchStyleVars } from "./ui/style-vars.js";
import { install as s0 } from "./ui/storefront/00-context.js";
import { install as s1 } from "./ui/storefront/01-utils.js";
import { install as s2 } from "./ui/storefront/02-cart.js";
import { install as s3 } from "./ui/storefront/03-wishlist.js";
import { install as s4 } from "./ui/storefront/04-header-footer.js";
import { install as s5 } from "./ui/storefront/05-cart-drawer.js";
import { install as s6 } from "./ui/storefront/06-search.js";
import { install as s7 } from "./ui/storefront/07-mobile-menu.js";
import { install as s8 } from "./ui/storefront/08-product-card.js";
import { install as s9 } from "./ui/storefront/09-home.js";
import { install as s10 } from "./ui/storefront/10-home-sections.js";
import { install as s11 } from "./ui/storefront/11-product-page.js";
import { install as s12 } from "./ui/storefront/12-checkout.js";
import { install as s13 } from "./ui/storefront/13-wishlist-page.js";
import { install as s14 } from "./ui/storefront/14-static-pages.js";
import { install as s15a } from "./ui/storefront/15a-click-handlers.js";
import { install as s15b } from "./ui/storefront/15b-seo.js";
import { install as s15 } from "./ui/storefront/15-global-events.js";
import { install as s16 } from "./ui/storefront/16-boot.js";

const _initStorefront = () => {
  /** @type {StorefrontCtx} */
  const ctx = /** @type {StorefrontCtx} */ ({});
  const R = window.RESTORE;
  if (!R) {
    console.error("Restore: state not loaded");
    return;
  }
  Object.assign(ctx, { R });
  s0(ctx); // prelude
  s1(ctx); // Utilities
  s2(ctx); // Cart
  s3(ctx); // Wishlist
  s4(ctx); // Header & footer
  s5(ctx); // Cart drawer
  s6(ctx); // Search
  s7(ctx); // Mobile menu
  s8(ctx); // Product card
  s9(ctx); // Home
  s10(ctx); // Home sections
  s11(ctx); // Product page
  s12(ctx); // Checkout
  s13(ctx); // Wishlist page
  s14(ctx); // Static pages
  s15a(ctx); // Click handler table
  s15b(ctx); // SEO helpers (meta, canonical, JSON-LD)
  s15(ctx); // Global events
  s16(ctx); // Boot
};

_initStorefront();
watchStyleVars(); // CSP: data-driven values reach CSS custom properties, never a style attribute
