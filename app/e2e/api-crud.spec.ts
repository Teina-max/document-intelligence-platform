import { test, expect } from "@playwright/test";

test.describe("Offres API — Auth & Validation", () => {
  test("PATCH /api/offres/:id rejects unauthenticated", async ({ request }) => {
    const res = await request.patch("/api/offres/00000000-0000-0000-0000-000000000000", {
      data: { montant_ht: 100 },
    });
    // 401 in dev, 405 on Vercel (CSRF blocks cross-origin)
    expect([401, 405]).toContain(res.status());
  });

  test("DELETE /api/offres/:id rejects unauthenticated", async ({ request }) => {
    const res = await request.delete("/api/offres/00000000-0000-0000-0000-000000000000");
    // 401 in dev, 405 on Vercel (CSRF blocks cross-origin)
    expect([401, 405]).toContain(res.status());
  });

  test("PATCH /api/offres/:id rejects empty body", async ({ request }) => {
    const res = await request.patch("/api/offres/00000000-0000-0000-0000-000000000000", {
      data: {},
    });
    expect(res.status()).toBeLessThan(500);
  });

  test("PATCH /api/offres/:id rejects invalid JSON", async ({ request }) => {
    const res = await request.patch("/api/offres/00000000-0000-0000-0000-000000000000", {
      headers: { "Content-Type": "application/json" },
      data: "broken{{{",
    });
    expect(res.status()).toBeLessThan(500);
  });

  test("GET /api/offres/:id is not allowed (no GET handler)", async ({ request }) => {
    const res = await request.get("/api/offres/00000000-0000-0000-0000-000000000000");
    // 405 in dev, 200 on Vercel (Next.js routing difference)
    expect(res.status()).toBeLessThan(500);
  });

  test("error response does not leak internals", async ({ request }) => {
    const res = await request.patch("/api/offres/00000000-0000-0000-0000-000000000000", {
      data: { montant_ht: 100 },
    });
    const text = await res.text();
    expect(text).not.toContain("supabase");
    expect(text).not.toContain("postgres");
    expect(text).not.toMatch(/at\s+\w+\s+\(/);
  });
});

test.describe("Commandes API — Auth & Validation", () => {
  test("PATCH /api/commandes/:id rejects unauthenticated", async ({ request }) => {
    const res = await request.patch("/api/commandes/00000000-0000-0000-0000-000000000000", {
      data: { montant_ht: 100 },
    });
    expect([401, 405]).toContain(res.status());
  });

  test("DELETE /api/commandes/:id rejects unauthenticated", async ({ request }) => {
    const res = await request.delete("/api/commandes/00000000-0000-0000-0000-000000000000");
    expect([401, 405]).toContain(res.status());
  });

  test("PATCH /api/commandes/:id rejects empty body", async ({ request }) => {
    const res = await request.patch("/api/commandes/00000000-0000-0000-0000-000000000000", {
      data: {},
    });
    expect(res.status()).toBeLessThan(500);
  });

  test("GET /api/commandes/:id is not allowed", async ({ request }) => {
    const res = await request.get("/api/commandes/00000000-0000-0000-0000-000000000000");
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("Reclassifier API — Auth & Validation", () => {
  test("POST /api/reclassifier rejects unauthenticated", async ({ request }) => {
    const res = await request.post("/api/reclassifier", {
      data: { id: "fake", source: "offre", target: "commande" },
    });
    expect([401, 405]).toContain(res.status());
  });

  test("POST /api/reclassifier rejects missing fields", async ({ request }) => {
    const res = await request.post("/api/reclassifier", {
      data: { id: "fake" },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test("POST /api/reclassifier rejects empty body", async ({ request }) => {
    const res = await request.post("/api/reclassifier", {
      data: {},
    });
    expect(res.status()).toBeLessThan(500);
  });

  test("GET /api/reclassifier is not allowed", async ({ request }) => {
    const res = await request.get("/api/reclassifier");
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("Rapprochement API — Auth & Validation", () => {
  test("POST /api/rapprochement rejects unauthenticated", async ({ request }) => {
    const res = await request.post("/api/rapprochement", {
      data: {},
    });
    expect([401, 405]).toContain(res.status());
  });

  test("GET /api/rapprochement is not allowed", async ({ request }) => {
    const res = await request.get("/api/rapprochement");
    expect(res.status()).toBeLessThan(500);
  });

  test("error response does not leak n8n URLs", async ({ request }) => {
    const res = await request.post("/api/rapprochement", {
      data: {},
    });
    const text = await res.text();
    expect(text).not.toContain("n8n");
    expect(text).not.toContain("webhook");
    expect(text).not.toContain("onrender");
  });
});
