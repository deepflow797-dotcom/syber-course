/* Shared e2e helpers: force LOCAL demo mode (config.js is rewritten in-flight, files on disk untouched) and
   collect console errors / page errors so every spec can assert a clean console. */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../", import.meta.url));

export async function demoMode(page) {
  const original = fs.readFileSync(ROOT + "assets/js/config.js", "utf8");
  const patched = original
    .replace(/mode:\s*"[^"]*"/, 'mode: "local"')
    .replace(/demoEnabled:\s*false/, "demoEnabled: true");
  await page.route("**/assets/js/config.js", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: patched })
  );
}
export function watchConsole(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console.error: " + m.text());
  });
  page.on("requestfailed", (r) => {
    if (/\.(js|mjs)(\?|$)/.test(r.url())) errors.push("requestfailed: " + r.url());
  });
  return errors;
}
export async function loginDashboard(page) {
  await page.goto("/dashboard.html");
  await page.fill('#login-form input[name="username"]', "owner");
  await page.fill('#login-form input[name="password"]', "Owner#12345");
  await page.click('#login-form button[type="submit"]');
  const pw = page.locator("#password-form");
  if (await pw.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pw.locator('input[name="current"]').fill("Owner#12345");
    await pw.locator('input[name="next"]').fill("Owner#123456");
    await pw.locator('input[name="confirm"]').fill("Owner#123456");
    const wa = pw.locator('input[name="whatsapp"]');
    if (await wa.count()) await wa.fill("22246000000");
    await pw.locator('button[type="submit"]').click();
  }
  await page.waitForSelector("#dash-sidebar, [data-route]", { timeout: 10_000 });
}
export const DASHBOARD_ROUTES = [
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
];
