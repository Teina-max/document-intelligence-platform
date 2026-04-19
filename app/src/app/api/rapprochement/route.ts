import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/rate-limit";

const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limiter.check(ip).limited) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // I6: Role check — only admin and commercial can trigger rapprochement
  const role = (user.app_metadata as Record<string, unknown>)?.role;
  if (!role || !["admin", "commercial"].includes(role as string)) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  // C1: Fail fast if env var not set
  const rapprochementUrl = process.env.N8N_RAPPROCHEMENT_URL;
  if (!rapprochementUrl) {
    console.error("[api/rapprochement] N8N_RAPPROCHEMENT_URL not configured");
    return NextResponse.json(
      { error: "Service rapprochement non configuré" },
      { status: 503 }
    );
  }

  // Proxy to n8n
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret) {
    headers["X-Webhook-Secret"] = secret;
  }

  try {
    const res = await fetch(rapprochementUrl, {
      method: "POST",
      headers,
      body: "{}",
    });

    if (!res.ok) {
      console.error("[api/rapprochement] n8n error:", res.status);
      return NextResponse.json(
        { error: "Erreur rapprochement" },
        { status: 502 }
      );
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/rapprochement] fetch error:", err);
    return NextResponse.json(
      { error: "Service rapprochement indisponible" },
      { status: 502 }
    );
  }
}
