// @ts-check
/* ==========================================================================
   Restore dashboard application
   ========================================================================== */
/* Assembler only — the implementation lives in ui/dashboard/* (one `install(ctx)` per feature, ≤600 lines each).
   `ctx` is the shared context object: every module registers its functions/constants on it and reads
   shared mutable state (e.g. ctx.state, ctx.session) from it. Install order matters and mirrors the
   original top-to-bottom order of the former monolith. See docs/ARCHITECTURE.md. */

import { watchStyleVars } from "./ui/style-vars.js";
import { install as s0 } from "./ui/dashboard/00-context.js";
import { install as s1 } from "./ui/dashboard/01-auth-screens.js";
import { install as s2 } from "./ui/dashboard/02-shell.js";
import { install as s3 } from "./ui/dashboard/03-overview.js";
import { install as s4 } from "./ui/dashboard/04-modal-helpers.js";
import { install as s5 } from "./ui/dashboard/05-orders.js";
import { install as s6 } from "./ui/dashboard/06-abandoned.js";
import { install as s7 } from "./ui/dashboard/07-products.js";
import { install as s8 } from "./ui/dashboard/08-categories.js";
import { install as s9 } from "./ui/dashboard/09-content-nav.js";
import { install as s10 } from "./ui/dashboard/10-homepage.js";
import { install as s11 } from "./ui/dashboard/11-appearance.js";
import { install as s12 } from "./ui/dashboard/12-marketing.js";
import { install as s13 } from "./ui/dashboard/13-blog-pages.js";
import { install as s14 } from "./ui/dashboard/14-reviews.js";
import { install as s15 } from "./ui/dashboard/15-payments-cities.js";
import { install as s16 } from "./ui/dashboard/16-team.js";
import { install as s17 } from "./ui/dashboard/17-reports.js";
import { install as s18 } from "./ui/dashboard/18-settings.js";
import { install as s19 } from "./ui/dashboard/19-audit.js";
import { install as s20 } from "./ui/dashboard/20-publish.js";
import { install as s21 } from "./ui/dashboard/21-events-nav.js";
import { install as s22 } from "./ui/dashboard/22-events-forms.js";
import { install as s22b } from "./ui/dashboard/22b-events-settings.js";
import { install as s23 } from "./ui/dashboard/23-events-misc.js";
import { install as s24 } from "./ui/dashboard/24-boot.js";

const _initDashboard = () => {
  /** @type {DashboardCtx} */
  const ctx = /** @type {DashboardCtx} */ ({});
  const R = window.RESTORE;
  if (!R) return;
  Object.assign(ctx, { R });
  s0(ctx); // prelude
  s1(ctx); // Authentication screens
  s2(ctx); // Application shell
  s3(ctx); // Overview
  s4(ctx); // Shared modal / field helpers
  s5(ctx); // Orders
  s6(ctx); // Abandoned checkout
  s7(ctx); // Products
  s8(ctx); // Categories
  s9(ctx); // Storefront content and navigation
  s10(ctx); // Homepage
  s11(ctx); // Appearance
  s12(ctx); // Marketing / coupons
  s13(ctx); // Blog and pages
  s14(ctx); // Reviews
  s15(ctx); // Payments and shipping cities
  s16(ctx); // Team
  s17(ctx); // Reports
  s18(ctx); // Settings
  s19(ctx); // Audit log
  s20(ctx); // Publish, preview and draft lifecycle
  s21(ctx); // Event delegation (part 1)
  s22(ctx); // Event delegation (part 2a)
  s22b(ctx); // Event delegation (part 2b)
  s23(ctx); // Event delegation (part 3)
  s24(ctx); // Boot
};

_initDashboard();
watchStyleVars(); // CSP: data-driven values reach CSS custom properties, never a style attribute
