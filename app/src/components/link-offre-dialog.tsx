"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Link2, Unlink } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { formatCurrency, formatDate } from "@/lib/formatting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OffreSearchResult {
  id: string;
  reference_offre: string;
  date_offre: string;
  montant_ht: number;
}

interface LinkOffreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commandeId: string;
  entrepriseId: string;
  currentOffreId: string | null;
  locale: Locale;
  onLinked: (offreId: string | null, offreRef: string | null) => void;
}

export function LinkOffreDialog({
  open,
  onOpenChange,
  commandeId,
  entrepriseId,
  currentOffreId,
  locale,
  onLinked,
}: LinkOffreDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<OffreSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      setResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setLoading(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const query = new URLSearchParams({
          entreprise_id: entrepriseId,
          ...(searchTerm && { q: searchTerm }),
        });

        const res = await fetch(`/api/offres/search?${query}`);
        if (!res.ok) throw new Error("Failed to fetch offres");

        const data = await res.json();
        setResults(data.offres || []);
      } catch {
        toast.error(t("table.error", locale));
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [open, searchTerm, entrepriseId, locale]);

  async function handleLink(offreId: string, offreRef: string) {
    setLinking(true);
    try {
      const res = await fetch(`/api/commandes/${commandeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offre_id: offreId }),
      });

      if (!res.ok) throw new Error("Link failed");

      toast.success(t("commandes.lier_offre_succes", locale));
      onLinked(offreId, offreRef);
      onOpenChange(false);
    } catch {
      toast.error(t("table.error", locale));
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink() {
    setUnlinking(true);
    try {
      const res = await fetch(`/api/commandes/${commandeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offre_id: null }),
      });

      if (!res.ok) throw new Error("Unlink failed");

      toast.success(t("commandes.delier_offre_succes", locale));
      onLinked(null, null);
      onOpenChange(false);
    } catch {
      toast.error(t("table.error", locale));
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:-translate-y-1/2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:-translate-y-1/2">
          <div className="flex flex-col gap-4 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <DialogPrimitive.Title className="font-semibold text-foreground">
                {t("commandes.lier_offre_titre", locale)}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close className="rounded-md opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
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

            {/* Unlink button if offre linked */}
            {currentOffreId && (
              <Button
                onClick={handleUnlink}
                disabled={unlinking}
                variant="outline"
                size="sm"
                className="w-full gap-2"
              >
                <Unlink className="h-4 w-4" />
                {t("commandes.delier_offre", locale)}
              </Button>
            )}

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("commandes.lier_offre_recherche", locale)}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Results list */}
            <div className="max-h-64 overflow-y-auto rounded-md border border-border/50">
              {loading ? (
                <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                  {t("common.chargement", locale)}
                </div>
              ) : results.length === 0 ? (
                <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                  {t("commandes.lier_offre_aucune", locale)}
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {results.map((offre) => (
                    <button
                      key={offre.id}
                      onClick={() => handleLink(offre.id, offre.reference_offre)}
                      disabled={linking}
                      className={cn(
                        "w-full p-3 text-left transition-colors hover:bg-accent disabled:opacity-50",
                        "flex items-center justify-between gap-2"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs font-medium text-foreground">
                          {offre.reference_offre}
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{formatDate(offre.date_offre)}</span>
                          <span className="font-semibold text-foreground">
                            {formatCurrency(offre.montant_ht)}
                          </span>
                        </div>
                      </div>
                      <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
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
