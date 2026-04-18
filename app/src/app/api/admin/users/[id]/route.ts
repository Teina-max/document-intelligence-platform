import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRateLimiter } from "@/lib/rate-limit";

const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limiter.check(ip).limited) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  // Auth + admin check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const role = (user.app_metadata as Record<string, unknown>)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });
  }

  const { id } = await params;

  // Prevent self-deletion
  if (id === user.id) {
    return NextResponse.json({ error: "Impossible de supprimer votre propre compte" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);

  if (error) {
    console.error("[admin/users/delete] Supabase error:", error.message);
    return NextResponse.json({ error: "Impossible de supprimer cet utilisateur" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
