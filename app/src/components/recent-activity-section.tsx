"use client";

import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { formatCurrency, formatDate } from "@/lib/formatting";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, FileText, ShoppingCart, ChevronDown, ChevronUp } from "lucide-react";

export interface RecentItem {
  id: string;
  type: "offre" | "commande";
  reference: string;
  entreprise_nom: string;
  montant_ht: number | null;
  source_import: string;
  created_at: string;
  document_date: string | null;
}

function relativeTime(dateStr: string, locale: Locale): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffD = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return locale === "es" ? "ahora" : "à l'instant";
  if (diffMin < 60) return `${diffMin} min`;
  if (diffH < 24) return `${diffH}h`;
  if (diffD < 7) return `${diffD}j`;
  return formatDate(dateStr);
}

function sourceBadge(source: string) {
  const label = source === "ocr" ? "OCR" : source === "excel" ? "Excel" : source;
  const cls =
    source === "ocr"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      : source === "excel"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

interface Props {
  items: RecentItem[];
  locale: Locale;
}

const INITIAL_LIMIT = 5;

export function RecentActivitySection({ items, locale }: Props) {
  const [expanded, setExpanded] = useState(false);
  const displayed = expanded ? items : items.slice(0, INITIAL_LIMIT);
  const hasMore = items.length > INITIAL_LIMIT;

  return (
    <div className="section-divider">
      <h2 className="mb-3 flex items-center gap-2 font-condensed text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Clock className="h-4 w-4" />
        {t("recent.title", locale)}
        {items.length > 0 && (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 font-mono text-[10px] font-bold">
            {items.length}
          </span>
        )}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-border/60 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="table-header-industrial hover:bg-transparent">
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider w-24">
                {t("recent.type", locale)}
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">
                {t("recent.reference", locale)}
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider">
                {t("recent.entreprise", locale)}
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">
                {t("recent.montant", locale)}
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-center">
                {t("recent.source", locale)}
              </TableHead>
              <TableHead className="font-condensed text-[11px] font-semibold uppercase tracking-wider text-right">
                {t("recent.date", locale)}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.length > 0 ? (
              displayed.map((item) => (
                <TableRow key={`${item.type}-${item.id}`} className="hover:bg-muted/30">
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`gap-1 font-mono text-[10px] ${
                        item.type === "offre"
                          ? "border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400"
                          : "border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                      }`}
                    >
                      {item.type === "offre" ? (
                        <FileText className="h-3 w-3" />
                      ) : (
                        <ShoppingCart className="h-3 w-3" />
                      )}
                      {item.type === "offre" ? t("recent.offre", locale) : t("recent.commande", locale)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-medium">
                    {item.reference}
                  </TableCell>
                  <TableCell className="text-sm">{item.entreprise_nom}</TableCell>
                  <TableCell className="kpi-value text-right text-sm">
                    {formatCurrency(item.montant_ht)}
                  </TableCell>
                  <TableCell className="text-center">
                    {sourceBadge(item.source_import)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {item.document_date ? formatDate(item.document_date) : relativeTime(item.created_at, locale)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  {t("recent.aucun", locale)}
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
              <><ChevronUp className="h-3.5 w-3.5" /> Réduire</>
            ) : (
              <><ChevronDown className="h-3.5 w-3.5" /> Voir les {items.length - INITIAL_LIMIT} autres</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
