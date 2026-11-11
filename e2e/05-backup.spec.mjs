import { test, expect } from "@playwright/test";
import { demoMode, watchConsole, loginDashboard } from "./helpers.mjs";

/* P4 — the round trip that matters, through the real store state and the real UI, not through the pure module
   (tests/backup-format.test.mjs already covers the format rules in isolation). */

async function openBackupCard(page) {
  await page.evaluate(() => {
    location.hash = "#settings";
  });
  await page.click('[data-dash-tab="settings-advanced"]');
  await expect(page.locator('[data-action="backup-export"]')).toBeVisible({
    timeout: 5000
  });
}

test("staff: export the store, wipe it, import the file back — data is identical and the undo restores the wipe", async ({
  page
}) => {
  await demoMode(page);
  const errors = watchConsole(page);
  await loginDashboard(page);
  await openBackupCard(page);

  /* 1. Export through the service (same call the download button makes) and keep the text. */
  const exported = await page.evaluate(() => window.RESTORE.backupExport());
  expect(exported.fileName).toMatch(/^restore-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
  const before = await page.evaluate(() => ({
    products: window.RESTORE.state.products.length,
    pages: window.RESTORE.state.pages.length,
    storeName: window.RESTORE.state.settings.storeName
  }));
  expect(before.products).toBeGreaterThan(0);

  /* 2. Change the store on purpose, as a user would (rename it, delete a page). */
  const wiped = await page.evaluate((text) => {
    const doc = JSON.parse(text);
    doc.data.settings.storeName = { ar: "اسم مؤقت", fr: "Nom temporaire" };
    doc.data.products = doc.data.products.slice(0, 1);
    doc.data.pages = [];
    return JSON.stringify(doc);
  }, exported.text);

  /* The import path goes through the same preview the UI shows before applying. */
  const preview = await page.evaluate((text) => {
    const r = window.RESTORE.backupPreview(text);
    return { ok: r.ok, diff: r.ok ? r.preview.diff : null };
  }, wiped);
  expect(preview.ok).toBe(true);
  expect(preview.diff.storeNameChanged).toBe(true);
  const changed = Object.fromEntries(preview.diff.changes.map((row) => [row.key, row]));
  expect(changed.products.to).toBe(1);
  expect(changed.pages.to).toBe(0);

  const applied = await page.evaluate((text) => window.RESTORE.backupApply(text, { mode: "replace" }), wiped);
  expect(applied.ok).toBe(true);
  expect(await page.evaluate(() => window.RESTORE.state.products.length)).toBe(1);

  /* 3. Import the original file back: every count returns to the exported value. */
  const restored = await page.evaluate((text) => window.RESTORE.backupApply(text, { mode: "replace" }), exported.text);
  expect(restored.ok).toBe(true);
  const after = await page.evaluate(() => ({
    products: window.RESTORE.state.products.length,
    pages: window.RESTORE.state.pages.length,
    storeName: window.RESTORE.state.settings.storeName
  }));
  expect(after).toEqual(before);

  /* 4. The pre-import snapshot survives in storage and the undo button puts it back. */
  const undo = await page.evaluate(() => window.RESTORE.backupRestorePrevious());
  expect(undo.ok).toBe(true);
  expect(await page.evaluate(() => window.RESTORE.state.products.length)).toBe(1);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("staff: a corrupt or newer backup file is refused with a message and the store is untouched", async ({ page }) => {
  await demoMode(page);
  await loginDashboard(page);
  const result = await page.evaluate(() => {
    const snapshot = JSON.stringify(window.RESTORE.state);
    const bad = window.RESTORE.backupPreview("{ not json");
    const newer = window.RESTORE.backupPreview(
      JSON.stringify({
        format: "restore-backup",
        formatVersion: 99,
        data: { settings: {} }
      })
    );
    return {
      bad: { ok: bad.ok, code: bad.error?.code },
      newer: { ok: newer.ok, code: newer.error?.code },
      untouched: JSON.stringify(window.RESTORE.state) === snapshot
    };
  });
  expect(result.bad).toEqual({ ok: false, code: "invalid-json" });
  expect(result.newer).toEqual({ ok: false, code: "future-format" });
  expect(result.untouched).toBe(true);
});
