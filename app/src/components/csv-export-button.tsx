"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface CsvExportButtonProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  filename: string;
  headers: { key: string; label: string }[];
}

export function CsvExportButton({ data, filename, headers }: CsvExportButtonProps) {
  function exportCsv() {
    const headerRow = headers.map((h) => h.label).join(";");
    const rows = data.map((row) =>
      headers
        .map((h) => {
          const val = row[h.key];
          if (val == null) return "";
          const str = String(val);
          return str.includes(";") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(";"),
    );
    const csv = "\uFEFF" + [headerRow, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (data.length === 0) return null;

  return (
    <Button variant="outline" size="sm" onClick={exportCsv} className="h-7 gap-1.5 text-xs font-medium">
      <Download className="h-3.5 w-3.5" />
      CSV
    </Button>
  );
}
