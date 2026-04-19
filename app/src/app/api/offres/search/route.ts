import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/rate-limit";

const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limiter.check(ip).limited) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entrepriseId = searchParams.get("entreprise_id");
  const q = searchParams.get("q");

  let query = supabase
    .from("offres")
    .select("id, reference_offre, montant_ht, date_offre, statut, entreprises!inner(nom)")
    .order("date_offre", { ascending: false })
    .limit(20);

  if (entrepriseId) {
    query = query.eq("entreprise_id", entrepriseId);
  }

  if (q) {
    const escaped = q.replace(/[%_\\]/g, "\\$&");
    query = query.ilike("reference_offre", `%${escaped}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[api/offres/search]", error.message);
    return NextResponse.json({ error: "Erreur de recherche" }, { status: 500 });
  }

  const offres = (data || []).map((item: any) => ({
    id: item.id,
    reference_offre: item.reference_offre,
    entreprise_nom: item.entreprises?.nom,
    montant_ht: item.montant_ht,
    date_offre: item.date_offre,
    statut: item.statut,
  }));

  return NextResponse.json({ offres });
}
