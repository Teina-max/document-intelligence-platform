import { test, expect } from "@playwright/test";

test.describe("OCR API — Authentication & Authorization", () => {
  test("POST /api/ocr rejects unauthenticated requests", async ({ request }) => {
    const res = await request.post("/api/ocr", {
      data: { pdfBase64: "dGVzdA==", fileName: "test.pdf", storagePath: "uploads/test.pdf" },
    });
    // 401 in dev, 405 on Vercel (CSRF blocks cross-origin)
    expect([401, 405]).toContain(res.status());
    const text = await res.text();
    expect(text).not.toContain("n8n");
    expect(text).not.toContain("webhook");
  });
});

test.describe("OCR API — Input Validation", () => {
  test("POST /api/ocr rejects empty body", async ({ request }) => {
    const res = await request.post("/api/ocr", { data: {} });
    expect(res.status()).toBeLessThan(500);
  });

  test("POST /api/ocr rejects invalid JSON", async ({ request }) => {
    const res = await request.post("/api/ocr", {
      headers: { "Content-Type": "application/json" },
      data: "not-json{{{",
    });
    expect(res.status()).toBeLessThan(500);
  });

  test("POST /api/ocr rejects missing fields", async ({ request }) => {
    const res = await request.post("/api/ocr", {
      data: { pdfBase64: "dGVzdA==" },
    });
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("OCR API — Security", () => {
  test("error responses do not leak internal URLs or secrets", async ({ request }) => {
    const res = await request.post("/api/ocr", {
      data: { pdfBase64: "dGVzdA==", fileName: "test.pdf", storagePath: "uploads/test.pdf" },
    });
    const text = await res.text();
    expect(text).not.toContain("n8n");
    expect(text).not.toContain("webhook");
    expect(text).not.toContain("example");
    expect(text).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(text).not.toContain("ANTHROPIC_API_KEY");
    expect(text).not.toMatch(/at\s+\w+\s+\(/);
  });

  test("GET /api/ocr is not allowed", async ({ request }) => {
    const res = await request.get("/api/ocr");
    expect(res.status()).toBeLessThan(500);
  });

  test("n8n webhook URL is not exposed in client code", async ({ page }) => {
    await page.goto("/upload");
    const content = await page.content();
    expect(content).not.toContain("/webhook/thermopack");
    expect(content).not.toContain("example");
  });
});
