"use client";

import { usePathname } from "next/navigation";
import { t, type Locale, type TranslationKey } from "@/lib/i18n";

const pageTitles: Record<string, TranslationKey> = {
  "/dashboard": "dashboard.title",
  "/direction": "direction.title",
  "/analyse": "analyse.title",
  "/offres": "offres.title",
  "/commandes": "commandes.title",
  "/upload": "upload.title",
  "/admin/users": "admin.title",
};

interface PageTitleProps {
  locale: Locale;
}

export function PageTitle({ locale }: PageTitleProps) {
  const pathname = usePathname();
  const key = pageTitles[pathname];

  if (!key) return null;

  return (
    <h1 className="text-base font-semibold tracking-tight">
      {t(key, locale)}
    </h1>
  );
}
