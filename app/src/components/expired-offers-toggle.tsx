"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { t, type Locale } from "@/lib/i18n";

interface ExpiredOffersToggleProps {
  locale: Locale;
  inclureExpirees: boolean;
}

export function ExpiredOffersToggle({ locale, inclureExpirees }: ExpiredOffersToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const toggle = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (inclureExpirees) {
      params.set("expirees", "0");
    } else {
      params.delete("expirees");
    }
    router.push(`/dashboard?${params.toString()}`);
  }, [router, searchParams, inclureExpirees]);

  return (
    <button
      type="button"
      onClick={toggle}
      className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
        inclureExpirees
          ? "border-amber-accent/40 bg-amber-accent/10 text-amber-accent hover:bg-amber-accent/20"
          : "border-border/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      {inclureExpirees
        ? t("filter.exclure_expirees", locale)
        : t("filter.inclure_expirees", locale)}
    </button>
  );
}
