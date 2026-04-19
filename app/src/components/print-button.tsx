"use client";

import { Printer } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

interface PrintButtonProps {
  locale: Locale;
}

export function PrintButton({ locale }: PrintButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50 print:hidden"
      title={t("dashboard.imprimer", locale)}
    >
      <Printer className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">PDF</span>
    </button>
  );
}
