import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/rate-limit";

const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  // Whitelist allowed fields
  const allowed = [
    "reference_offre",
    "entreprise_id",
    "montant_ht",
    "montant_ttc",
    "date_offre",
    "date_expiration",
    "statut",
    "notes",
    "derniere_relance",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucun champ à modifier" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("offres")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[api/offres/patch]", error.message);
    return NextResponse.json({ error: "Erreur de mise à jour" }, { status: 400 });
  }

  return NextResponse.json({ offre: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  if (role !== "admin") {
    return NextResponse.json(
      { error: "Accès réservé aux administrateurs" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const { error } = await supabase.from("offres").delete().eq("id", id);

  if (error) {
    console.error("[api/offres/delete]", error.message);
    return NextResponse.json({ error: "Erreur de suppression" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
