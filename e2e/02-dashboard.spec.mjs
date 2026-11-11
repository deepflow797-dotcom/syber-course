import { test, expect } from "@playwright/test";
import { demoMode, watchConsole, loginDashboard, DASHBOARD_ROUTES } from "./helpers.mjs";

test("staff: login then visit all 18 dashboard routes with a clean console", async ({ page }) => {
  await demoMode(page);
  const errors = watchConsole(page);
  await loginDashboard(page);
  for (const r of DASHBOARD_ROUTES) {
    await page.evaluate((route) => {
      location.hash = "#" + route;
    }, r);
    await page.waitForTimeout(150);
    const len = await page.evaluate(() => document.body.innerHTML.length);
    expect(len, `route ${r} rendered`).toBeGreaterThan(5000);
    await expect(page.locator("#login-form")).toHaveCount(0);
  }
  expect(DASHBOARD_ROUTES).toHaveLength(18);
  expect(errors, errors.join("\n")).toEqual([]);
});
test("staff: wrong password shows an error and keeps the login form", async ({ page }) => {
  await demoMode(page);
  await page.goto("/dashboard.html");
  await page.fill('#login-form input[name="username"]', "owner");
  await page.fill('#login-form input[name="password"]', "nope-nope");
  await page.click('#login-form button[type="submit"]');
  await expect(page.locator("#login-error")).not.toBeEmpty();
  await expect(page.locator("#login-form")).toBeVisible();
});
