"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/i18n";

interface LocaleToggleProps {
  locale: Locale;
}

export function LocaleToggle({ locale }: LocaleToggleProps) {
  const router = useRouter();

  function switchLocale(newLocale: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${newLocale};path=/;max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <div className="flex items-center rounded-md border border-border/60 text-[11px] font-semibold">
      <button
        type="button"
        onClick={() => switchLocale("fr")}
        className={`rounded-l-md px-2 py-1 transition-colors ${
          locale === "fr"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => switchLocale("es")}
        className={`rounded-r-md px-2 py-1 transition-colors ${
          locale === "es"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        ES
      </button>
    </div>
  );
}
