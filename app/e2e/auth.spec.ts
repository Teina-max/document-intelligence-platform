import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("unauthenticated user sees login or gets redirected", async ({
    page,
  }) => {
    const res = await page.goto("/dashboard");
    // In production middleware redirects to /login (302)
    // In dev with no Supabase session, the page may render then client-redirect
    // Either way, the response should not be a 500
    expect(res?.status()).toBeLessThan(500);

    // Wait for potential client-side redirect
    await page.waitForTimeout(3_000);
    const url = page.url();
    // Should be on login OR dashboard (if middleware allows through in dev)
    expect(url).toMatch(/\/(login|dashboard)/);
  });

  test("root redirects somewhere (login or dashboard)", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2_000);
    const url = page.url();
    expect(url).toMatch(/\/(login|dashboard)/);
  });

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");

    // Logo and branding present
    await expect(page.locator("img[alt='ThermoPack']").first()).toBeVisible();

    // Form elements present
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.fill("#email", "fake@test.com");
    await page.fill("#password", "wrongpassword");
    await page.click("button[type='submit']");

    // Should show error message (use first() since multiple elements may match)
    await expect(
      page.locator("[class*='destructive'] p, [class*='destructive']").first()
    ).toBeVisible({ timeout: 10_000 });

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("email input requires valid email format", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.locator("#email");
    await emailInput.fill("not-an-email");
    await page.click("button[type='submit']");

    // HTML5 validation should prevent submission
    const validity = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validity.valid
    );
    expect(validity).toBe(false);
  });

  test("protected routes do not crash (200 or redirect)", async ({
    page,
  }) => {
    const protectedRoutes = [
      "/dashboard",
      "/direction",
      "/analyse",
      "/offres",
      "/commandes",
      "/upload",
      "/admin/users",
    ];

    for (const route of protectedRoutes) {
      const res = await page.goto(route);
      // Should not return 500 — either 200 (dev) or 302 (redirect to login)
      expect(res?.status()).toBeLessThan(500);
    }
  });

  test("setup-password page loads without crash", async ({ page }) => {
    await page.goto("/auth/setup-password");

    // Should render the password setup form
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#confirm")).toBeVisible();
  });

  test("setup-password enforces minimum length via HTML5", async ({
    page,
  }) => {
    await page.goto("/auth/setup-password");

    // Fill with short password (< 8 chars)
    await page.fill("#password", "Abc1");
    await page.fill("#confirm", "Abc1");

    // HTML5 minLength=8 validation should prevent submission
    const validity = await page
      .locator("#password")
      .evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(validity).toBe(false);
  });

  test("setup-password shows complexity hint", async ({ page }) => {
    await page.goto("/auth/setup-password");

    // Password hint should be visible
    const hint = page.getByText(/majuscule.*chiffre|mayúscula.*número/i);
    await expect(hint).toBeVisible();
  });

  test("setup-password validates password match", async ({ page }) => {
    await page.goto("/auth/setup-password");

    await page.fill("#password", "password123");
    await page.fill("#confirm", "different456");
    await page.click("button[type='submit']");

    // Should show mismatch error
    await expect(
      page.locator("div[class*='destructive'] p").first()
    ).toBeVisible({ timeout: 5_000 });
  });
});
