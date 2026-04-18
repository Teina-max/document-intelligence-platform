"use client";

import { useState } from "react";
import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";
import type { AlertesDashboard } from "@/types/database";
import { Clock, Mail, MailX } from "lucide-react";
import { MissingEmailsDialog } from "@/components/missing-emails-dialog";

interface Props {
  alertes: AlertesDashboard;
  locale: Locale;
}

export function AlertesBanner({ alertes, locale }: Props) {
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const items = [
    {
      key: "expirent",
      count: alertes.expirent_7j,
      label: t("alertes.expirent_semaine", locale),
      icon: Clock,
      color: "text-destructive bg-destructive/10 border-destructive/20",
      href: "/offres?expire_7j=1",
    },
    {
      key: "relancees",
      count: alertes.jamais_relancees,
      label: t("alertes.jamais_relancees", locale),
      icon: MailX,
      color: "text-amber-accent bg-amber-accent/10 border-amber-accent/20",
      href: "/offres?jamais_relancees=1",
    },
    {
      key: "sans_email",
      count: alertes.sans_email,
      label: t("alertes.sans_email", locale),
      icon: Mail,
      color: "text-muted-foreground bg-muted/10 border-muted/20",
    },
  ].filter(item => item.count > 0);

  if (items.length === 0) return null;

  const cardClasses = "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer transition-opacity hover:opacity-80";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {items.map((item) =>
          item.href ? (
            <Link
              key={item.key}
              href={item.href}
              className={`${cardClasses} ${item.color}`}
            >
              <item.icon className="h-3.5 w-3.5" />
              <span className="font-mono font-bold">{item.count}</span>
              <span>{item.label}</span>
            </Link>
          ) : (
            <button
              key={item.key}
              type="button"
              onClick={() => setEmailDialogOpen(true)}
              className={`${cardClasses} ${item.color}`}
            >
              <item.icon className="h-3.5 w-3.5" />
              <span className="font-mono font-bold">{item.count}</span>
              <span>{item.label}</span>
            </button>
          )
        )}
      </div>
      <MissingEmailsDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        locale={locale}
      />
    </>
  );
}
