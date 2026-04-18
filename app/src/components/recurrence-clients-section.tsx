"use client";

import { useState } from "react";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CsvExportButton } from "@/components/csv-export-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatting";
import { t, type Locale } from "@/lib/i18n";
import type { RecurrenceClient } from "@/types/database";

function frequenceBadge(jours: number) {
  if (jours === 0)
    return (
      <Badge variant="outline" className="font-mono text-[10px]">
        N/A
      </Badge>
    );
  if (jours <= 14)
    return (
      <Badge className="bg-teal font-mono text-[10px] text-white hover:bg-teal/90">
        {jours}j
      </Badge>
    );
  if (jours <= 30)
    return (
      <Badge className="bg-amber-accent font-mono text-[10px] text-white hover:bg-amber-accent/90">
        {jours}j
      </Badge>
    );
  return (
    <Badge variant="secondary" className="font-mono text-[10px]">
      {jours}j
    </Badge>
  );
}

interface Props {
  data: RecurrenceClient[];
  locale: Locale;
}

export function RecurrenceClientsSection({ data, locale }: Props) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? data : data.slice(0, 10);
  const hasMore = data.length > 10;

  return (
    <div className="section-divider">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-condensed text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <RefreshCw className="h-4 w-4" />
          {t("analyse.clients_recurrents", locale)}
          {data.length > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 font-mono text-[10px] font-bold text-primary">
              {data.length}
            </span>
          )}
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="ml-2 inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              {showAll ? (
                <>
                  {t("analyse.top_10", locale)}
                  <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  {t("analyse.voir_tout", locale)}
                  <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          )}
        </h2>
        <CsvExportButton
          data={data}
          filename="clients-recurrents"
          headers={[
            { key: "entreprise_nom", label: t("dashboard.entreprise", locale) },
            { key: "pays", label: t("dashboard.pays", locale) },
            { key: "nb_commandes", label: t("analyse.commandes", locale) },
            {
              key: "frequence_moyenne_jours",
              label: t("analyse.frequence", locale),
            },
            {
              key: "derniere_commande",
              label: t("analyse.derniere_cmd", locale),
            },
            { key: "ca_total", label: t("analyse.ca_total", locale) },
          ]}
        />
      </div>
      <div className="overflow-x-auto rounded-md border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="table-header-industrial hover:bg-transparent">
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">
                {t("dashboard.entreprise", locale)}
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-center">
                {t("dashboard.pays", locale)}
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">
                Cmd.
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">
                {t("analyse.frequence", locale)}
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">
                {t("analyse.derniere_cmd", locale)}
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">
                {t("analyse.ca_total", locale)}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.length > 0 ? (
              displayed.map((c) => (
                <TableRow key={c.entreprise_id} className="hover:bg-muted/30">
                  <TableCell className="text-sm font-medium">
                    {c.entreprise_nom}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex h-5 w-7 items-center justify-center rounded bg-muted font-mono text-[10px] font-medium">
                      {c.pays}
                    </span>
                  </TableCell>
                  <TableCell className="kpi-value text-right text-sm">
                    {c.nb_commandes}
                  </TableCell>
                  <TableCell className="text-right">
                    {frequenceBadge(c.frequence_moyenne_jours)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(c.derniere_commande)}
                  </TableCell>
                  <TableCell className="kpi-value text-right text-sm font-bold">
                    {formatCurrency(c.ca_total)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-sm text-muted-foreground"
                >
                  {t("analyse.pas_assez_donnees", locale)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
