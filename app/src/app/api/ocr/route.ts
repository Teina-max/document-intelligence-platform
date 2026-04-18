import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/rate-limit";

export const maxDuration = 60;

// 10 OCR calls per minute per IP
const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limiter.check(ip).limited) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const role = (user.app_metadata as Record<string, unknown>)?.role;
  if (!role || !["admin", "commercial"].includes(role as string)) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  let body: { files?: { fileName: string; storagePath: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide" },
      { status: 400 },
    );
  }

  if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
    return NextResponse.json(
      { error: "Champ requis : files (array de {fileName, storagePath})" },
      { status: 400 },
    );
  }

  // Validate each file entry
  for (const f of body.files) {
    if (!f.storagePath || !f.fileName) {
      return NextResponse.json(
        { error: "Chaque fichier doit avoir fileName et storagePath" },
        { status: 400 },
      );
    }
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("[api/ocr] N8N_WEBHOOK_URL not configured");
    return NextResponse.json(
      { error: "Service OCR non configuré" },
      { status: 503 },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret) {
    headers["X-Webhook-Secret"] = secret;
  }

  try {
    // Fire and forget — n8n processes async with responseMode: onReceived
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ files: body.files }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[api/ocr] n8n error:", res.status, text);
      return NextResponse.json(
        { error: "Erreur OCR" },
        { status: res.status >= 500 ? 502 : res.status },
      );
    }

    return NextResponse.json({
      status: "processing",
      count: body.files.length,
    });
  } catch (err) {
    console.error("[api/ocr] fetch error:", err);
    return NextResponse.json(
      { error: "Service OCR indisponible" },
      { status: 502 },
    );
  }
}
