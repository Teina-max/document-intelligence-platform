import { test, expect } from "@playwright/test";

test.describe("Navigation — Unauthenticated", () => {
  test("login page is accessible", async ({ page }) => {
    const res = await page.goto("/login");
    expect(res?.status()).toBe(200);
  });

  test("/auth/setup-password is accessible", async ({ page }) => {
    const res = await page.goto("/auth/setup-password");
    expect(res?.status()).toBe(200);
  });

  test("/auth/callback is accessible", async ({ page }) => {
    const res = await page.goto("/auth/callback");
    // May redirect, but should not crash (200 or 3xx)
    expect(res?.status()).toBeLessThan(500);
  });
});

test.describe("Login Page — UI Elements", () => {
  test("displays ThermoPack branding on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/login");

    // Left panel with stats should be visible on desktop
    await expect(page.getByText("43%")).toBeVisible();
    await expect(page.getByText("50%")).toBeVisible();
    await expect(page.getByText("+240k")).toBeVisible();
  });

  test("hides left branding panel on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/login");

    // Left panel stats should be hidden (they're inside the lg:flex panel)
    await expect(page.getByText("43%")).not.toBeVisible();

    // Login form should still be visible
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("form submit button is enabled by default", async ({ page }) => {
    await page.goto("/login");
    const btn = page.locator("button[type='submit']");
    await expect(btn).toBeEnabled();
  });

  test("form shows loading state on submit", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "test@test.com");
    await page.fill("#password", "test123");

    // Click and immediately check for loading state
    await page.click("button[type='submit']");

    // Button should be disabled during loading
    await expect(page.locator("button[type='submit']")).toBeDisabled();
  });
});

test.describe("Responsive Design", () => {
  const viewports = [
    { name: "mobile", width: 375, height: 812 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 720 },
  ];

  for (const vp of viewports) {
    test(`login page renders without errors on ${vp.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Collect console errors
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      const res = await page.goto("/login");
      expect(res?.status()).toBe(200);

      await page.waitForTimeout(1_000);

      // Filter out known non-critical errors (favicon, HMR in dev, etc.)
      const criticalErrors = errors.filter(
        (e) =>
          !e.includes("favicon") &&
          !e.includes("404") &&
          !e.includes("HMR") &&
          !e.includes("hydrat")
      );
      expect(criticalErrors).toHaveLength(0);
    });
  }
});
