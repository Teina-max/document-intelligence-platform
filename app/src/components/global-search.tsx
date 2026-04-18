"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Search, FileText, ShoppingCart, Building2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  result_type: "offre" | "commande" | "entreprise";
  result_id: string;
  title: string;
  subtitle: string;
  href: string;
  statut?: string | null;
  entreprise_id?: string | null;
}

const typeConfig = {
  offre: { icon: FileText, label: "Offre", color: "text-amber-accent" },
  commande: { icon: ShoppingCart, label: "Commande", color: "text-teal" },
  entreprise: { icon: Building2, label: "Entreprise", color: "text-thermopack-blue" },
};

export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Ctrl+K shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        setResults([]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close on click outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.rpc("recherche_globale", {
        p_query: q,
        p_limit: 8,
      });
      setResults((data as SearchResult[]) ?? []);
      setSelected(-1);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(value), 250);
    },
    [search],
  );

  const navigate = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setQuery("");
      setResults([]);
      if (result.entreprise_id && result.result_type !== "entreprise") {
        router.push(`${result.href}?entreprise=${result.entreprise_id}`);
      } else if (result.result_type === "entreprise") {
        router.push(`/entreprises/${result.result_id}`);
      } else {
        router.push(result.href);
      }
    },
    [router],
  );

  // Keyboard navigation
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, -1));
      } else if (e.key === "Enter" && selected >= 0 && results[selected]) {
        e.preventDefault();
        navigate(results[selected]);
      }
    },
    [results, selected, navigate],
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/60"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Rechercher...</span>
        <kbd className="ml-2 hidden rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-background px-3 py-1.5 shadow-sm">
        <Search className="h-3.5 w-3.5 text-primary shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Référence, entreprise..."
          className="w-48 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60 sm:w-64"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {(results.length > 0 || (query.length >= 2 && !loading)) && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-md border border-border/60 bg-card shadow-lg">
          {results.length > 0 ? (
            <div className="max-h-80 overflow-y-auto py-1">
              {results.map((r, i) => {
                const cfg = typeConfig[r.result_type];
                const Icon = cfg.icon;
                return (
                  <button
                    key={`${r.result_type}-${r.result_id}`}
                    type="button"
                    onClick={() => navigate(r)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                      i === selected ? "bg-muted" : "hover:bg-muted/50",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", cfg.color)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="truncate text-xs font-medium">{r.title}</p>
                        {r.result_type === "offre" && r.statut && (
                          <span className={cn(
                            "shrink-0 inline-flex rounded px-1 py-0.5 text-[9px] font-medium",
                            r.statut === "en_attente" && "bg-amber-100 text-amber-700",
                            r.statut === "transformee" && "bg-teal/10 text-teal",
                            r.statut === "expiree" && "bg-red-100 text-red-700",
                            r.statut === "partiellement_transformee" && "bg-orange-100 text-orange-700",
                          )}>
                            {r.statut === "en_attente" ? "En attente"
                              : r.statut === "transformee" ? "Transformée"
                              : r.statut === "expiree" ? "Expirée"
                              : "Partielle"}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[10px] text-muted-foreground">{r.subtitle}</p>
                    </div>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
                      {cfg.label}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Aucun résultat pour &quot;{query}&quot;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
