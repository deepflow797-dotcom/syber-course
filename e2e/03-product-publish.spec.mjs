import { test, expect } from "@playwright/test";
import { demoMode, watchConsole, loginDashboard } from "./helpers.mjs";

test("staff: create a product in the dashboard, publish, and see it on the storefront", async ({ page }) => {
  await demoMode(page);
  const errors = watchConsole(page);
  await loginDashboard(page);
  await page.evaluate(() => {
    location.hash = "#products";
  });
  await page.click('[data-action="add-product"]');
  const modal = page.locator(".dash-modal");
  await expect(modal).toBeVisible();
  const handle = "e2e-produit-" + Date.now().toString(36);
  const set = async (path, value) => {
    const el = modal.locator(`[data-edit-path="${path}"]`).first();
    await el.fill(String(value));
    await el.dispatchEvent("input");
    await el.dispatchEvent("change");
  };
  await set("handle", handle);
  await set("title.ar", "منتج اختبار");
  await set("title.fr", "Produit E2E");
  await set("price", 12345);
  await set("stock", 7);
  await page.click('[data-action="save-editor"]');
  await expect(modal).toHaveCount(0);
  await page.click('[data-action="publish"]');
  const confirm = page.locator('[data-action="confirm-publish"]');
  if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) await confirm.click();
  await page.waitForTimeout(400);
  const live = await page.evaluate((h) => window.RESTORE.state.products.find((p) => p.handle === h), handle);
  expect(live, "product published to live state").toBeTruthy();
  expect(live.price).toBe(12345);
  expect(live.stock).toBe(7);
  await page.goto(`/product.html?handle=${handle}`);
  const h1 = page.locator("h1").first();
  await expect(h1).toContainText(/Produit E2E|منتج اختبار/);
  await expect(h1).not.toContainText("[object Object]");
  await expect(page.locator("[data-add-cart]")).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});
