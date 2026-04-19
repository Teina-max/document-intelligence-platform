import { test, expect } from "@playwright/test";

test.describe("Upload Page — Unauthenticated", () => {
  test("upload page does not crash", async ({ page }) => {
    const res = await page.goto("/upload");
    // Should not be a 500 — either redirect to login or render (dev)
    expect(res?.status()).toBeLessThan(500);
  });
});

test.describe("Upload — Webhook URL Exposure", () => {
  test("n8n webhook URLs are not in login page source", async ({ page }) => {
    await page.goto("/login");

    // The webhook URLs should NOT be visible on the login page
    // (they're only loaded by the upload component which is behind auth)
    const content = await page.content();
    expect(content).not.toContain("/webhook/thermopack/ingest-pdf");
    expect(content).not.toContain("/webhook/thermopack/rapprochement");
  });
});
