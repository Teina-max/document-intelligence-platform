"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileDown } from "lucide-react";

interface PdfLinkProps {
  storagePath: string | null;
}

export function PdfLink({ storagePath }: PdfLinkProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (!storagePath) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(storagePath, 120);
      if (error || !data?.signedUrl) return;
      window.open(data.signedUrl, "_blank");
    } finally {
      setLoading(false);
    }
  }, [storagePath]);

  if (!storagePath) return <span className="text-muted-foreground/30">—</span>;

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); handleClick(); }}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 hover:border-primary/40 disabled:opacity-50"
      title="Ouvrir le PDF"
    >
      <FileDown className="h-3.5 w-3.5" />
      <span>PDF</span>
    </button>
  );
}
