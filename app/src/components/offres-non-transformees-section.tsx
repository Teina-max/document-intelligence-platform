"use client";

import { useState } from "react";
import { toast } from "sonner";
import { t, type Locale } from "@/lib/i18n";
import { formatCurrency, formatDate } from "@/lib/formatting";
import type { OffreNonTransformee } from "@/types/database";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronDown, ChevronUp, Mail, Check } from "lucide-react";
import { CsvExportButton } from "@/components/csv-export-button";
import { ExpiredOffersToggle } from "@/components/expired-offers-toggle";
import { buildMailtoUrl } from "@/lib/mailto-relance";

const INITIAL_LIMIT = 5;

function urgencyBadge(jours: number | null) {
  if (jours == null)
    return <Badge variant="outline" className="font-mono text-[10px]">N/A</Badge>;
  if (jours < 0)
    return <Badge variant="destructive" className="font-mono text-[10px]">Expirée</Badge>;
  if (jours < 7)
    return <Badge variant="destructive" className="font-mono text-[10px]">{jours}j</Badge>;
  if (jours < 15)
    return (
      <Badge className="bg-amber-accent font-mono text-[10px] text-white hover:bg-amber-accent/90">
        {jours}j
      </Badge>
    );
  return (
    <Badge className="bg-teal font-mono text-[10px] text-white hover:bg-teal/90">
      {jours}j
    </Badge>
  );
}

interface Props {
  offres: OffreNonTransformee[];
  locale: Locale;
  inclureExpirees: boolean;
}

export function OffresNonTransformeesSection({ offres, locale, inclureExpirees }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [localOffres, setLocalOffres] = useState<OffreNonTransformee[]>(offres);
  const [relancing, setRelancing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const displayedOffres = expanded ? localOffres : localOffres.slice(0, INITIAL_LIMIT);
  const hasMore = localOffres.length > INITIAL_LIMIT;

  const visibleOffresToRelance = displayedOffres.filter(o => o.contact_email);
  const allVisibleSelected = visibleOffresToRelance.length > 0 &&
    visibleOffresToRelance.every(o => selected.has(o.id));

  async function handleRelancer(offre: OffreNonTransformee) {
    if (!offre.contact_email) {
      toast.error(t("table.no_email", locale));
      return;
    }

    setRelancing(offre.id);
    try {
      window.open(
        buildMailtoUrl({
          reference_offre: offre.reference_offre,
          contact_email: offre.contact_email,
          contact_nom: offre.contact_nom,
          montant_ht: offre.montant_ht,
          date_expiration: offre.date_expiration,
          jours_restants: offre.jours_restants,
          entreprise_pays: offre.entreprise_pays,
        }),
        '_blank'
      );

      const res = await fetch(`/api/offres/${offre.id}`, {
        method: "PATCH",
        body: JSON.stringify({ derniere_relance: new Date().toISOString() }),
      });

      if (!res.ok) throw new Error("Update failed");

      setLocalOffres(prev =>
        prev.map(o => o.id === offre.id ? { ...o, derniere_relance: new Date().toISOString() } : o)
      );
      toast.success(t("table.relance_ok", locale));
    } catch {
      toast.error(t("table.error", locale));
    } finally {
      setRelancing(null);
    }
  }

  function handleSelectAll() {
    if (allVisibleSelected) {
      setSelected(new Set());
    } else {
      const newSelected = new Set(selected);
      visibleOffresToRelance.forEach(o => newSelected.add(o.id));
      setSelected(newSelected);
    }
  }

  function handleSelectOne(id: string) {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  }

  async function handleBulkRelance() {
    const selectedOffres = localOffres.filter(o => selected.has(o.id) && o.contact_email);

    for (const o of selectedOffres) {
      window.open(
        buildMailtoUrl({
          reference_offre: o.reference_offre,
          contact_email: o.contact_email!,
          contact_nom: o.contact_nom,
          montant_ht: o.montant_ht,
          date_expiration: o.date_expiration,
          jours_restants: o.jours_restants,
          entreprise_pays: o.entreprise_pays,
        }),
        '_blank'
      );

      fetch(`/api/offres/${o.id}`, {
        method: "PATCH",
        body: JSON.stringify({ derniere_relance: new Date().toISOString() }),
      }).catch(err => console.error(`Failed to update ${o.id}:`, err));
    }

    setLocalOffres(prev =>
      prev.map(o =>
        selected.has(o.id)
          ? { ...o, derniere_relance: new Date().toISOString() }
          : o
      )
    );

    toast.success(`${selectedOffres.length} relance(s) envoyée(s)`);
    setSelected(new Set());
  }

  return (
    <div className="section-divider">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-condensed text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-thermopack-red" />
          {t("dashboard.offres_non_transformees", locale)}
          {offres.length > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-accent px-1.5 font-mono text-[10px] font-bold text-white">
              {offres.length}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              onClick={handleBulkRelance}
              className="h-8 bg-primary text-white hover:bg-primary/90"
              size="sm"
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              {t("table.relancer_selection", locale)} ({selected.size})
            </Button>
          )}
          <ExpiredOffersToggle locale={locale} inclureExpirees={inclureExpirees} />
          <CsvExportButton
            data={offres}
            filename="offres-non-transformees"
            headers={[
              { key: "reference_offre", label: t("dashboard.reference", locale) },
              { key: "entreprise_nom", label: t("dashboard.entreprise", locale) },
              { key: "montant_ht", label: t("dashboard.montant_ht", locale) },
              { key: "date_offre", label: t("dashboard.date_offre", locale) },
              { key: "date_expiration", label: t("dashboard.expiration", locale) },
              { key: "jours_restants", label: "Jours restants" },
            ]}
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border/60 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="table-header-industrial hover:bg-transparent">
              <TableHead className="w-8 px-3">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-muted-foreground/30 accent-primary cursor-pointer"
                  title={t("table.tout_selectionner", locale)}
                />
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">{t("dashboard.reference", locale)}</TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">{t("dashboard.entreprise", locale)}</TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">{t("dashboard.montant_ht", locale)}</TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">{t("dashboard.date_offre", locale)}</TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">{t("dashboard.expiration", locale)}</TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-center">{t("dashboard.urgence", locale)}</TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">{t("table.derniere_relance", locale)}</TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-center w-16">{t("table.actions", locale)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedOffres.length > 0 ? (
              displayedOffres.map((o) => (
                <TableRow key={o.id} className="hover:bg-muted/30">
                  <TableCell className="w-8 px-3">
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => handleSelectOne(o.id)}
                      disabled={!o.contact_email}
                      className="h-4 w-4 rounded border-muted-foreground/30 accent-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs font-medium">{o.reference_offre}</TableCell>
                  <TableCell className="text-sm">{o.entreprise_nom}</TableCell>
                  <TableCell className="kpi-value text-right text-sm">{formatCurrency(o.montant_ht)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(o.date_offre)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(o.date_expiration)}</TableCell>
                  <TableCell className="text-center">{urgencyBadge(o.jours_restants)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {o.derniere_relance ? formatDate(o.derniere_relance) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      onClick={() => handleRelancer(o)}
                      disabled={relancing === o.id || !o.contact_email}
                      className="inline-flex items-center justify-center rounded-md border border-primary/20 bg-primary/5 p-1.5 text-xs text-primary transition-colors hover:bg-primary/10 hover:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={t("table.relancer", locale)}
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                  {t("dashboard.aucune_offre_attente", locale)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-center gap-1.5 border-t border-border/60 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Réduire
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Voir les {offres.length - INITIAL_LIMIT} autres offres
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
