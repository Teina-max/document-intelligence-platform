"use client";

import { useState, useEffect } from "react";
import { Mail, Check, Loader2 } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { toast } from "sonner";
import { t, type Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EntrepriseSansEmail } from "@/types/database";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
}

export function MissingEmailsDialog({ open, onOpenChange, locale }: Props) {
  const [entreprises, setEntreprises] = useState<EntrepriseSansEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSaved(new Set());
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase.rpc("entreprises_sans_email");
      if (error) {
        toast.error(error.message);
        setEntreprises([]);
      } else {
        setEntreprises((data as EntrepriseSansEmail[]) ?? []);
      }
      setLoading(false);
    })();
  }, [open]);

  async function handleSave(entrepriseId: string) {
    const email = emails[entrepriseId]?.trim();
    if (!email || !EMAIL_REGEX.test(email)) {
      toast.error(t("modal.email_invalide", locale));
      return;
    }

    setSaving(entrepriseId);
    try {
      const res = await fetch(`/api/entreprises/${entrepriseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_email: email }),
      });

      if (!res.ok) throw new Error("Save failed");

      toast.success(t("modal.email_enregistre", locale));
      setSaved((prev) => new Set(prev).add(entrepriseId));
    } catch {
      toast.error(t("table.error", locale));
    } finally {
      setSaving(null);
    }
  }

  const remaining = entreprises.filter((e) => !saved.has(e.entreprise_id));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:-translate-y-1/2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:-translate-y-1/2">
          <div className="flex flex-col gap-4 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <DialogPrimitive.Title className="flex items-center gap-2 font-semibold text-foreground">
                  <Mail className="h-4 w-4" />
                  {t("modal.sans_email_title", locale)}
                  <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 font-mono text-[10px] font-bold">
                    {remaining.length}
                  </span>
                </DialogPrimitive.Title>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("modal.sans_email_subtitle", locale)}
                </p>
              </div>
              <DialogPrimitive.Close className="rounded-md opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </DialogPrimitive.Close>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto rounded-md border border-border/50">
              {loading ? (
                <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.chargement", locale)}
                </div>
              ) : remaining.length === 0 ? (
                <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                  <Check className="mr-2 h-4 w-4 text-emerald-500" />
                  Tous les emails sont renseignés
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {remaining.map((e) => (
                    <div key={e.entreprise_id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground truncate">
                          {e.entreprise_nom}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="inline-flex h-4 w-6 items-center justify-center rounded bg-muted font-mono text-[9px] font-medium">
                            {e.pays}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {e.nb_offres_en_attente} {t("modal.offres_en_attente", locale)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input
                          type="email"
                          placeholder={t("modal.email_placeholder", locale)}
                          value={emails[e.entreprise_id] ?? ""}
                          onChange={(ev) =>
                            setEmails((prev) => ({ ...prev, [e.entreprise_id]: ev.target.value }))
                          }
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") handleSave(e.entreprise_id);
                          }}
                          className="h-8 w-48 text-xs"
                          disabled={saving === e.entreprise_id}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2.5 text-xs"
                          disabled={saving === e.entreprise_id || !emails[e.entreprise_id]?.trim()}
                          onClick={() => handleSave(e.entreprise_id)}
                        >
                          {saving === e.entreprise_id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            t("modal.enregistrer", locale)
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
