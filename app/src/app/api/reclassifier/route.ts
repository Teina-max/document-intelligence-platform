import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/rate-limit";

const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limiter.check(ip).limited) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const role = (user.app_metadata as Record<string, unknown>)?.role;
  if (!role || !["admin", "commercial"].includes(role as string)) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  let body: { id?: string; source?: string; target?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  if (!body.id || !body.source || !body.target) {
    return NextResponse.json(
      { error: "Champs requis: id, source, target" },
      { status: 400 }
    );
  }

  const VALID_TYPES = ["offre", "commande"] as const;
  if (!VALID_TYPES.includes(body.source as typeof VALID_TYPES[number]) ||
      !VALID_TYPES.includes(body.target as typeof VALID_TYPES[number]) ||
      body.source === body.target) {
    return NextResponse.json({ error: "Types invalides" }, { status: 400 });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(body.id)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("reclassifier_document", {
    p_id: body.id,
    p_source: body.source,
    p_target: body.target,
  });

  if (error) {
    console.error("[api/reclassifier]", error.message);
    return NextResponse.json({ error: "Erreur de reclassification" }, { status: 400 });
  }

  return NextResponse.json(data);
}
