"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface EditableCellProps {
  value: string | number | null;
  onSave: (value: string) => Promise<void>;
  type?: "text" | "number" | "currency";
  className?: string;
}

export function EditableCell({ value, onSave, type = "text", className }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ""));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const displayValue = type === "currency" && value != null
    ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value))
    : String(value ?? "—");

  async function handleSave() {
    if (editValue === String(value ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(editValue);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type === "currency" ? "number" : type}
        step={type === "currency" ? "0.01" : undefined}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") { setEditValue(String(value ?? "")); setEditing(false); }
        }}
        className={cn("w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-primary/30", className)}
        disabled={saving}
      />
    );
  }

  return (
    <span
      onClick={(e) => { e.stopPropagation(); setEditing(true); setEditValue(String(value ?? "")); }}
      className={cn("cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-primary/5 hover:ring-1 hover:ring-primary/20 transition-all", className)}
      title="Cliquer pour modifier"
    >
      {displayValue}
    </span>
  );
}
