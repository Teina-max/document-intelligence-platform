"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { t, LOCALE_COOKIE, getLocaleFromCookie, type Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locale] = useState<Locale>(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=([^;]+)`));
      return getLocaleFromCookie(match?.[1]);
    }
    return "fr";
  });
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(t("login.error", locale));
      setError(t("login.error", locale));
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      {/* Mobile logo */}
      <div className="mb-8 flex items-center gap-3 lg:hidden">
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
          <h2 className="font-condensed text-xl font-bold tracking-tight">{t("login.title", locale)}</h2>
          <p className="text-sm text-muted-foreground">
            {t("login.subtitle", locale)}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("login.email", locale)}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="alicia@thermopack.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("login.password", locale)}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
                  {t("login.loading", locale)}
                </>
              ) : (
                t("login.submit", locale)
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
