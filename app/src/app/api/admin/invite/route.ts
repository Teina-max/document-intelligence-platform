import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRateLimiter } from "@/lib/rate-limit";

const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limiter.check(ip).limited) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  // Verify caller is authenticated AND is admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const callerRole = (user.app_metadata as Record<string, unknown>)?.role;
  if (callerRole !== "admin") {
    return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });
  }

  let body: { email?: string; password?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const { email, password, role } = body;
  if (
    !email ||
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }

  // Validate password if provided
  if (password) {
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Mot de passe : 8 caractères minimum" }, { status: 400 });
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json({ error: "Mot de passe : 1 majuscule + 1 chiffre requis" }, { status: 400 });
    }
  }

  // Validate role
  const userRole = role && ["admin", "commercial"].includes(role) ? role : "commercial";

  const admin = createAdminClient();

  if (password) {
    // Create user directly with password (no email invite needed)
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: userRole },
    });

    if (error) {
      console.error("[admin/invite] createUser error:", error.message);
      if (error.message.includes("already")) {
        return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 });
      }
      return NextResponse.json({ error: "Impossible de créer l'utilisateur" }, { status: 400 });
    }

    return NextResponse.json({ user: data.user });
  }

  // Fallback: invite by email (requires SMTP config)
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${request.nextUrl.origin}/auth/setup-password`,
    data: { role: userRole },
  });

  if (error) {
    console.error("[admin/invite] invite error:", error.message);
    return NextResponse.json({ error: "Impossible d'inviter cet utilisateur" }, { status: 400 });
  }

  // Set role in app_metadata
  if (data.user) {
    await admin.auth.admin.updateUserById(data.user.id, {
      app_metadata: { role: userRole },
    });
  }

  return NextResponse.json({ user: data.user });
}
