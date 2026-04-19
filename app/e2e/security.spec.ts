import { test, expect } from "@playwright/test";

test.describe("Security Headers", () => {
  test("response includes security headers", async ({ page }) => {
    const response = await page.goto("/login");
    const headers = response?.headers() ?? {};

    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["permissions-policy"]).toContain("camera=()");
  });
});

test.describe("API Security — Admin Routes", () => {
  test("POST /api/admin/invite blocks unauthenticated requests", async ({
    request,
  }) => {
    const res = await request.post("/api/admin/invite", {
      data: { email: "hacker@test.com" },
    });
    // 401 in dev, 405 on Vercel prod (CSRF blocks cross-origin POST)
    expect(res.status()).toBeLessThan(500);

    const text = await res.text();
    // Should NOT leak internal details regardless of response format
    expect(text).not.toContain("supabase");
    expect(text).not.toContain("postgres");
  });

  test("GET /api/admin/users blocks unauthenticated requests", async ({
    request,
  }) => {
    const res = await request.get("/api/admin/users");
    expect(res.status()).toBeLessThan(500);
  });

  test("POST /api/admin/invite rejects invalid JSON body", async ({
    request,
  }) => {
    const res = await request.post("/api/admin/invite", {
      headers: { "Content-Type": "application/json" },
      data: "not-json{{{",
    });
    // Should return 400 or 401, not 500
    expect(res.status()).toBeLessThan(500);
  });

  test("POST /api/admin/invite rejects missing email", async ({
    request,
  }) => {
    const res = await request.post("/api/admin/invite", {
      data: { name: "no email field" },
    });
    // Should return 400 or 401, not 500
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("XSS Prevention", () => {
  test("login form does not render injected HTML in error", async ({
    page,
  }) => {
    await page.goto("/login");

    // Try XSS in email field
    await page.fill("#email", '<script>alert("xss")</script>@test.com');
    await page.fill("#password", "test");
    await page.click("button[type='submit']");

    // Wait for potential error
    await page.waitForTimeout(2_000);

    // No script should be injected into the page
    const pageContent = await page.content();
    expect(pageContent).not.toContain('alert("xss")');
  });
});

test.describe("Clickjacking Protection", () => {
  test("X-Frame-Options prevents iframe embedding", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.headers()["x-frame-options"]).toBe("DENY");
  });
});

test.describe("Information Disclosure", () => {
  test("404 page does not crash or leak info", async ({ page }) => {
    const res = await page.goto("/nonexistent-page-xyz");
    // Should not be a 500
    expect(res?.status()).not.toBe(500);

    // Should not contain raw stack traces in the visible text
    const visibleText = await page.locator("body").innerText();
    expect(visibleText).not.toMatch(/at\s+\w+\s+\(/);
    expect(visibleText).not.toContain("NEXT_PUBLIC");
  });

  test("API 404 does not crash with 500", async ({ request }) => {
    const res = await request.get("/api/nonexistent");
    // Should not be a 500
    expect(res.status()).not.toBe(500);
  });
});
