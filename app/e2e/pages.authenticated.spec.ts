import { test, expect } from "@playwright/test";

const authenticatedPages = [
  { path: "/dashboard", title: /tableau de bord|panel/i },
  { path: "/offres", title: /offres/i },
  { path: "/commandes", title: /commandes/i },
  { path: "/upload", title: /import|upload/i },
  { path: "/direction", title: /direction/i },
  { path: "/analyse", title: /analyse/i },
  { path: "/admin/users", title: /utilisateurs|users/i },
];

test.describe("Authenticated Pages — Load & Render", () => {
  for (const { path, title } of authenticatedPages) {
    test(`${path} loads with 200 and renders content`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);

      // Should NOT redirect to login
      expect(page.url()).not.toMatch(/\/login/);

      // Page should have a heading
      await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });
    });
  }
});

test.describe("Authenticated Pages — Sidebar Navigation", () => {
  test("sidebar is visible on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/dashboard");

    // Sidebar should contain nav links
    const sidebar = page.locator("[data-sidebar]").first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });
  });

  test("sidebar links navigate correctly", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Click on "Offres" nav link
    const offresLink = page.locator("a[href='/offres']").first();
    if (await offresLink.isVisible()) {
      await offresLink.click();
      await expect(page).toHaveURL(/\/offres/, { timeout: 10_000 });
    }
  });
});

test.describe("Authenticated Pages — No Secrets Leak", () => {
  for (const { path } of authenticatedPages) {
    test(`${path} does not leak secrets in HTML`, async ({ page }) => {
      await page.goto(path);
      const content = await page.content();
      expect(content).not.toContain("SUPABASE_SERVICE_ROLE");
      expect(content).not.toContain("ANTHROPIC_API_KEY");
      expect(content).not.toContain("N8N_WEBHOOK_URL");
      expect(content).not.toContain("example");
    });
  }
});

test.describe("Authenticated Pages — No Console Errors", () => {
  for (const { path } of authenticatedPages) {
    test(`${path} has no critical console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      await page.goto(path);
      await page.waitForTimeout(3_000);

      const critical = errors.filter(
        (e) =>
          !e.includes("favicon") &&
          !e.includes("404") &&
          !e.includes("403") &&
          !e.includes("HMR") &&
          !e.includes("hydrat") &&
          !e.includes("chunk") &&
          !e.includes("Failed to fetch") &&
          !e.includes("Failed to load resource")
      );

      expect(critical).toHaveLength(0);
    });
  }
});
