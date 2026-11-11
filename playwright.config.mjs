// End-to-end tests (real Chromium) against the static site served locally in LOCAL demo mode — no Supabase, no network.
// Run: npm run test:e2e   (first time: npm run test:e2e:install)
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]] : [["list"]],
  use: { baseURL: "http://127.0.0.1:8100", locale: "fr-FR", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: "python3 -m http.server 8100 --bind 127.0.0.1",
    url: "http://127.0.0.1:8100/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 20_000
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }]
});
