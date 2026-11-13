import { test, expect } from "@playwright/test";
import { demoMode, watchConsole } from "./helpers.mjs";

/* Audit finding #2 (1.8.2) as a permanent browser regression: a merchant-controlled URL that contains a quote
   must stay inside its attribute. The original proof wrote a poisoned logo into localStorage["restore_state_v1"]
   before the first paint; here the same path is repeated against the fixed build and must render exactly one
   element, with no attribute the value invented. */

const POISON = 'x" data-pwned="1';
// A 1x1 transparent PNG. The poisoned value is not a real file, so the browser would fetch it and log a 404 —
// a resource error for a missing logo, not a security signal. Serving it keeps the console assertion meaningful.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);
async function absorbMissingLogos(page) {
  await page.route(/data-pwned|javascript%3A/i, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: TINY_PNG })
  );
}

test("a quote in a merchant URL cannot create an attribute on the live storefront", async ({ page }) => {
  // seed the poisoned settings before any storefront script runs
  await page.addInitScript((poison) => {
    localStorage.setItem(
      "restore_state_v1",
      JSON.stringify({
        settings: { logo: poison, logoWhite: poison, storeName: { ar: "متجر", fr: "Boutique" } }
      })
    );
  }, POISON);
  await demoMode(page);
  await absorbMissingLogos(page);
  const errors = watchConsole(page);
  await page.goto("/index.html");

  const injected = await page.locator("[data-pwned]").count();
  expect(injected, "no element may carry an attribute invented by the value").toBe(0);

  // the <img> itself still exists and keeps its src (the value is escaped, not deleted)
  const img = page.locator("#site-header img").first();
  await expect(img).toHaveAttribute("src", POISON);

  // and no script can be introduced through the same vector
  await page.addInitScript((poison) => {
    localStorage.setItem("restore_state_v1", JSON.stringify({ settings: { logo: `javascript:alert(1)${poison}` } }));
  }, POISON);
  await page.reload();
  await page.waitForTimeout(300);
  expect(await page.locator("[data-pwned]").count()).toBe(0);
  const src = await page.locator("#site-header img").first().getAttribute("src");
  expect(src, "javascript: URLs are refused, not rendered").toBe("");

  // A scheme split by a control character is still javascript: to the browser (it strips them while parsing).
  // jsdom does not normalise this, so only a real browser can prove it.
  for (const sneak of ["java\tscript:alert(1)", "\u0000javascript:alert(1)", "java\nscript:alert(1)"]) {
    await page.evaluate((value) => {
      localStorage.setItem("restore_state_v1", JSON.stringify({ settings: { logo: value } }));
    }, sneak);
    await page.reload();
    await page.waitForTimeout(200);
    const resolved = await page.locator("#site-header img").first().getAttribute("src");
    expect(resolved, `${JSON.stringify(sneak)} must not survive`).toBe("");
  }
  expect(errors).toEqual([]);
});
