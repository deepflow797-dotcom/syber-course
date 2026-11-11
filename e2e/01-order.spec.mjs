import { test, expect } from "@playwright/test";
import { demoMode, watchConsole } from "./helpers.mjs";

test("shopper: product → add to cart → checkout → order confirmation (local demo)", async ({ page }) => {
  await demoMode(page);
  const errors = watchConsole(page);
  await page.goto("/index.html");
  const handle = await page.evaluate(() => window.RESTORE.state.products.find((p) => p.stock > 0 && p.active).handle);
  await page.goto(`/product.html?handle=${handle}`);
  await expect(page.locator("[data-add-cart]")).toBeVisible();
  await page.click("[data-add-cart]");
  await page.goto("/checkout.html");
  await expect(page.locator("#checkout-form")).toBeVisible();
  await page.fill("#co-name", "Client Test");
  await page.fill("#co-phone", "22244444869");
  const city = page.locator("#co-city");
  if (await city.count()) await city.selectOption({ index: 0 }).catch(() => {});
  await page.fill("#co-address", "Tevragh Zeina, rue 42");
  const before = await page.evaluate((h) => window.RESTORE.state.products.find((p) => p.handle === h).stock, handle);
  await page.click("#place-order");
  await expect(page.locator(".checkout-success")).toBeVisible({ timeout: 10_000 });
  const orders = await page.evaluate(() => window.RESTORE.getOrders());
  expect(orders.length).toBeGreaterThan(0);
  expect(orders[0].items.some((i) => i.handle === handle)).toBeTruthy();
  expect(orders[0].total).toBeGreaterThan(0);
  const after = await page.evaluate((h) => window.RESTORE.state.products.find((p) => p.handle === h).stock, handle);
  expect(after).toBe(before - 1);
  expect(errors, errors.join("\n")).toEqual([]);
});
