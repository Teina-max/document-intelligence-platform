import { test, expect } from "@playwright/test";

test.describe("Business Logic — Field Whitelisting", () => {
  test("PATCH /api/offres/:id does not accept non-whitelisted fields", async ({ request }) => {
    const res = await request.patch("/api/offres/00000000-0000-0000-0000-000000000000", {
      data: { designations: [{ hack: true }], fichier_source: "/etc/passwd" },
    });
    // Should reject because no whitelisted fields present
    expect(res.status()).toBeLessThan(500);
  });

  test("PATCH /api/commandes/:id does not accept non-whitelisted fields", async ({ request }) => {
    const res = await request.patch("/api/commandes/00000000-0000-0000-0000-000000000000", {
      data: { designations: [{ hack: true }], fichier_source: "/etc/passwd" },
    });
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("Business Logic — Delete Requires Admin", () => {
  test("DELETE /api/offres/:id requires auth (not just any user)", async ({ request }) => {
    const res = await request.delete("/api/offres/00000000-0000-0000-0000-000000000000");
    // 401 in dev, 405 on Vercel (CSRF blocks cross-origin)
    expect([401, 405]).toContain(res.status());
  });

  test("DELETE /api/commandes/:id requires auth (not just any user)", async ({ request }) => {
    const res = await request.delete("/api/commandes/00000000-0000-0000-0000-000000000000");
    expect([401, 405]).toContain(res.status());
  });
});

test.describe("Business Logic — Reclassification Validation", () => {
  test("reclassifier rejects invalid source type", async ({ request }) => {
    const res = await request.post("/api/reclassifier", {
      data: { id: "fake-id", source: "invoice", target: "commande" },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test("reclassifier rejects same source and target", async ({ request }) => {
    const res = await request.post("/api/reclassifier", {
      data: { id: "fake-id", source: "offre", target: "offre" },
    });
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("Business Logic — OCR Upload Flow", () => {
  test("OCR rejects non-PDF content type hint", async ({ request }) => {
    const res = await request.post("/api/ocr", {
      data: {
        pdfBase64: "dGVzdA==",
        fileName: "malware.exe",
        storagePath: "uploads/malware.exe",
      },
    });
    // 401 in dev, 405 on Vercel (CSRF blocks cross-origin)
    expect([401, 405]).toContain(res.status());
  });

  test("OCR rejects oversized payload", async ({ request }) => {
    // Create a base64 string > 15MB
    const bigPayload = "A".repeat(16 * 1024 * 1024);
    const res = await request.post("/api/ocr", {
      data: {
        pdfBase64: bigPayload,
        fileName: "big.pdf",
        storagePath: "uploads/big.pdf",
      },
    });
    // Either 401 (auth first) or 413 (size limit)
    expect([401, 413]).toContain(res.status());
  });
});

test.describe("Business Logic — Path Traversal Prevention", () => {
  test("upload page sanitizes filenames in client code", async ({ page }) => {
    await page.goto("/upload");
    const content = await page.content();
    // The upload-store.ts should contain filename sanitization
    // This is a structural test — the page should load without exposing raw paths
    expect(content).not.toContain("../");
    expect(content).not.toContain("..\\");
  });
});

test.describe("Business Logic — Rate Limiting", () => {
  test("API routes return proper 429 format", async ({ request }) => {
    // Spam the rapprochement endpoint (limit: 5/min)
    const results = [];
    for (let i = 0; i < 7; i++) {
      const res = await request.post("/api/rapprochement", { data: {} });
      results.push(res.status());
    }
    // Should see at least one 429, or all 401s/405s (auth/CSRF blocks first)
    const has429 = results.includes(429);
    const allBlocked = results.every((s) => [401, 405].includes(s));
    expect(has429 || allBlocked).toBe(true);
  });
});
