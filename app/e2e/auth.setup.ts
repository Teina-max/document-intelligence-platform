import { test as setup, expect } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_EMAIL || "e2e-test@thermopack-test.com";
const E2E_PASSWORD = process.env.E2E_PASSWORD || "E2eTest!2026secure";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");

  await page.locator("#email").fill(E2E_EMAIL);
  await page.locator("#password").fill(E2E_PASSWORD);
  await page.locator("button[type='submit']").click();

  // Wait for redirect to dashboard after login
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Verify we're actually logged in — dashboard title should be visible
  await expect(page.locator("h1")).toBeVisible({ timeout: 10_000 });

  // Save auth state for reuse
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
