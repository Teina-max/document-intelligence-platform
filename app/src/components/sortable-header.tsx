"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface SortableHeaderProps {
  column: string;
  label: string;
  className?: string;
}

export function SortableHeader({ column, label, className }: SortableHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const currentSort = searchParams.get("sort_by");
  const currentOrder = searchParams.get("sort_order") ?? "desc";
  const isActive = currentSort === column;

  function toggleSort() {
    const params = new URLSearchParams(searchParams.toString());
    if (isActive && currentOrder === "desc") {
      params.set("sort_by", column);
      params.set("sort_order", "asc");
    } else if (isActive && currentOrder === "asc") {
      params.delete("sort_by");
      params.delete("sort_order");
    } else {
      params.set("sort_by", column);
      params.set("sort_order", "desc");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const Icon = isActive ? (currentOrder === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={toggleSort}
      className={`inline-flex items-center gap-1 text-left hover:text-foreground transition-colors ${className ?? ""}`}
    >
      {label}
      <Icon className={`h-3 w-3 ${isActive ? "text-foreground" : "text-muted-foreground/50"}`} />
    </button>
  );
}
