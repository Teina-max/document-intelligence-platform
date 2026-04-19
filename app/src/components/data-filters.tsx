"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { t, type Locale } from "@/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FilterType =
  | "periode"
  | "pays"
  | "entreprise"
  | "region"
  | "statut_offre"
  | "type_commande"
  | "mois"
  | "annee";

interface EntrepriseOption {
  id: string;
  nom: string;
  region?: string | null;
}

interface DataFiltersProps {
  filters: FilterType[];
  entreprises?: EntrepriseOption[];
  regions?: string[];
  locale: Locale;
}

const DEFAULTS: Record<string, string> = {
  periode: "tout",
  pays: "tous",
  entreprise: "toutes",
  region: "toutes",
  statut: "tous",
  type: "tous",
  mois: "actuel",
  annee: String(new Date().getFullYear()),
};

export function DataFilters({ filters, entreprises = [], regions = [], locale }: DataFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const get = (key: string) => searchParams.get(key) ?? DEFAULTS[key] ?? "";

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const defaultVal = DEFAULTS[key];
      if (value === defaultVal) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      // Reset dependent filters
      if (key === "pays") {
        params.delete("region");
        params.delete("entreprise");
      }
      if (key === "region") {
        params.delete("entreprise");
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, searchParams, pathname],
  );

  // Filter entreprises by selected region
  const regionFilter = get("region");
  const filteredEntreprises = regionFilter !== "toutes"
    ? entreprises.filter((e) => e.region === regionFilter)
    : entreprises;

  return (
    <div className="flex flex-wrap gap-2">
      {filters.includes("periode") && (
        <Select value={get("periode")} onValueChange={(v) => updateParam("periode", v)}>
          <SelectTrigger className="h-8 w-[150px] text-xs font-medium">
            <SelectValue placeholder={t("filter.periode", locale)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tout">{t("filter.toute_periode", locale)}</SelectItem>
            <SelectItem value="mois">{t("filter.mois", locale)}</SelectItem>
            <SelectItem value="trimestre">{t("filter.trimestre", locale)}</SelectItem>
            <SelectItem value="annee">{t("filter.annee", locale)}</SelectItem>
          </SelectContent>
        </Select>
      )}

      {filters.includes("statut_offre") && (
        <Select value={get("statut")} onValueChange={(v) => updateParam("statut", v)}>
          <SelectTrigger className="h-8 w-[150px] text-xs font-medium">
            <SelectValue placeholder={t("filter.tous_statuts", locale)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">{t("filter.tous_statuts", locale)}</SelectItem>
            <SelectItem value="en_attente">{t("offres.en_attente", locale)}</SelectItem>
            <SelectItem value="transformee">{t("offres.transformee", locale)}</SelectItem>
            <SelectItem value="partiellement_transformee">{t("offres.partielle", locale)}</SelectItem>
            <SelectItem value="expiree">{t("offres.expiree", locale)}</SelectItem>
          </SelectContent>
        </Select>
      )}

      {filters.includes("type_commande") && (
        <Select value={get("type")} onValueChange={(v) => updateParam("type", v)}>
          <SelectTrigger className="h-8 w-[150px] text-xs font-medium">
            <SelectValue placeholder={t("filter.tous_types", locale)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">{t("filter.tous_types", locale)}</SelectItem>
            <SelectItem value="directe">{t("commandes.directe", locale)}</SelectItem>
            <SelectItem value="egale">{t("commandes.egale", locale)}</SelectItem>
            <SelectItem value="superieure">{t("commandes.superieure", locale)}</SelectItem>
            <SelectItem value="partielle">{t("offres.partielle", locale)}</SelectItem>
          </SelectContent>
        </Select>
      )}

      {filters.includes("pays") && (
        <Select value={get("pays")} onValueChange={(v) => updateParam("pays", v)}>
          <SelectTrigger className="h-8 w-[120px] text-xs font-medium">
            <SelectValue placeholder={t("filter.tous_pays", locale)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">{t("filter.tous_pays", locale)}</SelectItem>
            <SelectItem value="FR">France</SelectItem>
            <SelectItem value="ES">Espagne</SelectItem>
            <SelectItem value="MA">Maroc</SelectItem>
            <SelectItem value="TN">Tunisie</SelectItem>
            <SelectItem value="RE">Réunion</SelectItem>
          </SelectContent>
        </Select>
      )}

      {filters.includes("region") && regions.length > 0 && (
        <Select value={get("region")} onValueChange={(v) => updateParam("region", v)}>
          <SelectTrigger className="h-8 w-[200px] text-xs font-medium">
            <SelectValue placeholder={t("filter.toutes_regions", locale)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="toutes">{t("filter.toutes_regions", locale)}</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {filters.includes("entreprise") && (
        <Select value={get("entreprise")} onValueChange={(v) => updateParam("entreprise", v)}>
          <SelectTrigger className="h-8 w-[200px] text-xs font-medium">
            <SelectValue placeholder={t("filter.toutes_entreprises", locale)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="toutes">{t("filter.toutes_entreprises", locale)}</SelectItem>
            {filteredEntreprises.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {filters.includes("mois") && (
        <Select value={get("mois")} onValueChange={(v) => updateParam("mois", v)}>
          <SelectTrigger className="h-8 w-[140px] text-xs font-medium">
            <SelectValue placeholder={t("filter.mois_selector", locale)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="actuel">{t("filter.mois", locale)}</SelectItem>
            <SelectItem value="tous">{t("filter.annuel", locale)}</SelectItem>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {t(`month.${i + 1}` as Parameters<typeof t>[0], locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {filters.includes("annee") && (
        <Select value={get("annee")} onValueChange={(v) => updateParam("annee", v)}>
          <SelectTrigger className="h-8 w-[100px] text-xs font-medium">
            <SelectValue placeholder={t("filter.annee_label", locale)} />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 3 }, (_, i) => {
              const y = new Date().getFullYear() - i;
              return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
