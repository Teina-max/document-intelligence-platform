"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { t, LOCALE_COOKIE, getLocaleFromCookie, type Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, CheckCircle } from "lucide-react";

export default function SetupPasswordPage() {
  const [locale] = useState<Locale>(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=([^;]+)`));
      return getLocaleFromCookie(match?.[1]);
    }
    return "fr";
  });

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Supabase redirects with hash fragment containing access_token
  // The client SDK auto-detects and sets the session
  useEffect(() => {
    const supabase = createClient();
    // Listen for auth state change from the invite link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        // Session is set, user can now update password
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t("setup.min_length", locale));
      return;
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError(t("setup.complexity", locale));
      return;
    }
    if (password !== confirm) {
      setError(t("setup.mismatch", locale));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(t("setup.error", locale));
      setLoading(false);
      return;
    }

    toast.success(t("setup.success", locale));
    setSuccess(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <Image
            src="https://res.cloudinary.com/dttleawx6/image/upload/v1774510122/copy_of_capture_d_cran_2026-03-25_131424-removebg-preview_eu6n9g_11f077.png"
            alt="ThermoPack"
            width={32}
            height={32}
          />
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.12em]">{t("nav.france", locale)}</div>
            <div className="text-xs text-muted-foreground">{t("nav.subtitle", locale)}</div>
          </div>
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <h2 className="font-condensed text-xl font-bold tracking-tight">{t("setup.title", locale)}</h2>
            <p className="text-sm text-muted-foreground">{t("setup.subtitle", locale)}</p>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle className="h-10 w-10 text-emerald-500" />
                <p className="text-sm font-medium text-emerald-600">{t("setup.success", locale)}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("setup.password", locale)}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="h-10"
                  />
                  <p className="text-[10px] text-muted-foreground">{t("setup.password_hint", locale)}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("setup.confirm", locale)}
                  </Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    className="h-10"
                  />
                </div>
                {error && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
                <Button type="submit" className="mt-1 h-10 w-full font-semibold" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("setup.loading", locale)}
                    </>
                  ) : (
                    t("setup.submit", locale)
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
