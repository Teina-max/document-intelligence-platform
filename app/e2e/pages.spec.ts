import { test, expect } from "@playwright/test";

const protectedPages = [
  "/dashboard",
  "/offres",
  "/commandes",
  "/upload",
  "/direction",
  "/analyse",
  "/admin/users",
];

test.describe("Pages — Load Without Crash", () => {
  for (const page of protectedPages) {
    test(`${page} does not return 500`, async ({ page: p }) => {
      const res = await p.goto(page);
      expect(res?.status()).toBeLessThan(500);
    });
  }

  test("/login renders login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });

  test("/ redirects (not 500)", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBeLessThan(500);
  });
});

test.describe("Pages — No Internal Leak", () => {
  for (const route of protectedPages) {
    test(`${route} does not leak secrets`, async ({ page: p }) => {
      await p.goto(route);
      const content = await p.content();
      expect(content).not.toContain("SUPABASE_SERVICE_ROLE");
      expect(content).not.toContain("ANTHROPIC_API_KEY");
      expect(content).not.toContain("N8N_WEBHOOK_URL");
      expect(content).not.toContain("/webhook/thermopack");
      expect(content).not.toContain("example");
      expect(content).not.toContain("onrender.com");
    });
  }
});
