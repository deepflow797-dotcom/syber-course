/* Browser-less smoke test: boots every public page + the dashboard (all 18 routes) inside jsdom in LOCAL demo mode
   and fails on any uncaught error, console.error, unhandled rejection or empty render.
   Run: npm run test:smoke   (devDependency jsdom; no network, no Supabase).  Internal: node pages.smoke.mjs <root> <page> */
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = process.argv[2] || fileURLToPath(new URL("../../", import.meta.url));
const PAGE = process.argv[3];
const URL_ = process.argv[4] || "http://localhost:8100/?handle=iphone-13-pro-max&slug=about&";
if (!PAGE) {
  // orchestrate: one child process per page (fresh globals each time)
  const { spawnSync } = await import("node:child_process");
  // print.html is a shell filled at runtime from sessionStorage and guide.html is a static document, so
  // both are checked for a clean render rather than for a store-sized body.
  const SHELL_PAGES = new Set(["print.html", "guide.html"]);
  const pages = [
    "index.html",
    "collection.html",
    "product.html",
    "checkout.html",
    "wishlist.html",
    "page.html",
    "account.html",
    "blog.html",
    "blog-post.html",
    "dashboard.html",
    "print.html",
    "guide.html"
  ];
  let failed = 0;
  for (const p of pages) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ROOT, p], { encoding: "utf8" });
    const line = r.stdout.trim().split("\n").pop() || "";
    let fp;
    try {
      fp = JSON.parse(line);
    } catch {
      fp = null;
    }
    const minBody = SHELL_PAGES.has(p) ? 200 : 5000;
    const bad =
      !fp ||
      fp.errors.length ||
      fp.bodyLen < minBody ||
      (p === "dashboard.html" && (fp.hasLogin || Object.values(fp.routesOut).some((n) => n < 5000)));
    if (bad) failed++;
    console.log(
      `${bad ? "FAIL" : "OK  "} ${p.padEnd(16)} body=${fp?.bodyLen ?? "?"}${p === "dashboard.html" && fp ? ` routes=${Object.keys(fp.routesOut).length}` : ""}${fp?.errors?.length ? " " + fp.errors.join(" ; ").slice(0, 400) : ""}${!fp ? " " + (r.stderr || "").split("\n").slice(-6).join(" | ") : ""}`
    );
  }
  console.log(
    failed ? `\n${failed} page(s) FAILED` : "\nsmoke ok — all pages and dashboard routes render without errors"
  );
  process.exit(failed ? 1 : 0);
}
const html = fs.readFileSync(path.join(ROOT, PAGE), "utf8");
const errors = [];
const { VirtualConsole } = await import("jsdom");
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("jsdom:" + String(e.message || e).split("\n")[0]));
const dom = new JSDOM(html, { url: URL_ + PAGE, pretendToBeVisual: true, virtualConsole: vc });
const w = dom.window;
// expose globals
for (const k of [
  "window",
  "document",
  "navigator",
  "location",
  "localStorage",
  "sessionStorage",
  "HTMLElement",
  "Element",
  "Node",
  "CustomEvent",
  "Event",
  "MutationObserver",
  "getComputedStyle",
  "history",
  "Image",
  "FormData",
  "DOMParser",
  "Blob",
  "File",
  "FileReader",
  "requestAnimationFrame",
  "cancelAnimationFrame"
]) {
  try {
    Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
  } catch {}
}
globalThis.self = w;
if (!w.matchMedia)
  w.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {}
  });
globalThis.matchMedia = w.matchMedia;
w.IntersectionObserver = globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
w.scrollTo = () => {};
globalThis.scrollTo = w.scrollTo;
if (!w.requestAnimationFrame) {
  w.requestAnimationFrame = (f) => setTimeout(f, 0);
  globalThis.requestAnimationFrame = w.requestAnimationFrame;
}
w.fetch = globalThis.fetch = async () => {
  throw new Error("no network in smoke");
};
w.alert = () => {};
w.confirm = () => true;
w.prompt = () => null;
console.error = (...a) => errors.push("console.error:" + a.map(String).join(" ").split("\n")[0]);
w.addEventListener("error", (e) => errors.push("window.error:" + (e.error?.stack || e.message)));
process.on("unhandledRejection", (e) =>
  errors.push("unhandled:" + (e?.stack || e).toString().split("\n").slice(0, 2).join(" | "))
);

// data.js / config.js are plain scripts setting window.*; purify is a classic script
const run = (file) => {
  const code = fs.readFileSync(path.join(ROOT, file), "utf8");
  w.eval(code);
};
run("assets/js/data.js");
run("assets/js/config.js");
w.RESTORE_CONFIG.mode = "local";
w.RESTORE_CONFIG.demoEnabled = true;
globalThis.STORE = w.STORE;
globalThis.RESTORE_CONFIG = w.RESTORE_CONFIG;
run("assets/vendor/purify.min.js");
globalThis.DOMPurify = w.DOMPurify;
const q = "?t=" + Date.now();
await import(pathToFileURL(path.join(ROOT, "assets/js/state.js")).href + q);
globalThis.RESTORE = w.RESTORE;
const R = w.RESTORE;
// log a staff session for dashboard pages (local demo)
if (PAGE === "dashboard.html") {
  try {
    await R.login("owner", "Owner#12345");
  } catch (e) {
    errors.push("login:" + e.message);
  }
}
if (PAGE === "print.html") {
  // entry of the printable document: no state, no storefront boot
  await import(pathToFileURL(path.join(ROOT, "assets/js/print.js")).href + q);
} else {
  await import(
    pathToFileURL(path.join(ROOT, PAGE === "dashboard.html" ? "assets/js/dashboard.js" : "assets/js/app.js")).href + q
  );
}
await new Promise((r) => setTimeout(r, 600));
// exercise a few interactions
if (PAGE !== "dashboard.html" && PAGE !== "print.html") {
  for (const sel of [
    "[data-add-to-cart]",
    ".add-to-cart",
    "[data-cart-open]",
    "#cart-toggle",
    "[data-lang-toggle]",
    ".lang-toggle",
    "[data-theme-toggle]"
  ]) {
    const el = w.document.querySelector(sel);
    if (el) el.click();
  }
  await new Promise((r) => setTimeout(r, 200));
}
const routesOut = {};
if (PAGE === "dashboard.html") {
  const sess = R.currentSession?.();
  if (sess?.mustChange) {
    try {
      await R.changePassword("Owner#12345", "Owner#123456");
    } catch (e) {
      errors.push("chpw:" + e.message);
    }
  }
  for (const r of [
    "overview",
    "orders",
    "abandoned",
    "products",
    "categories",
    "reviews",
    "content",
    "homepage",
    "appearance",
    "marketing",
    "blog",
    "pages",
    "payments",
    "team",
    "reports",
    "settings",
    "audit",
    "profile"
  ]) {
    w.location.hash = "#" + r;
    w.dispatchEvent(new w.Event("hashchange"));
    await new Promise((x) => setTimeout(x, 150));
    routesOut[r] = w.document.body.innerHTML.length;
  }
}
const body = w.document.body.innerHTML;
fs.writeFileSync(process.env.DUMP || "/dev/null", body);
const fp = {
  page: PAGE,
  url: URL_,
  rKeys: Object.keys(R).length,
  rSample: Object.keys(R).sort().join(",").length,
  bodyLen: body.length,
  bodyHash: [...body].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7),
  lang: w.document.documentElement.lang,
  hasLogin: body.includes("login-form"),
  routesOut,
  errors
};
console.log(JSON.stringify(fp));
process.exit(0);
