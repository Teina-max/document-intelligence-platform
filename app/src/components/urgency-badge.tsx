import { cn } from "@/lib/utils";

interface UrgencyBadgeProps {
  dateExpiration: string | null;
}

function getUrgency(dateExpiration: string | null): {
  label: string;
  className: string;
  priority: number;
} | null {
  if (!dateExpiration) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(dateExpiration);
  exp.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { label: "Expirée", className: "bg-muted text-muted-foreground border-border", priority: 4 };
  if (daysLeft <= 3) return { label: "Urgent", className: "bg-destructive/15 text-destructive border-destructive/30 animate-pulse-urgent", priority: 1 };
  if (daysLeft <= 7) return { label: "Expire bientôt", className: "bg-destructive/10 text-destructive border-destructive/20", priority: 2 };
  if (daysLeft <= 15) return { label: "À surveiller", className: "bg-amber-accent/10 text-amber-accent border-amber-accent/20", priority: 3 };
  return null;
}

export { getUrgency };

export function UrgencyBadge({ dateExpiration }: UrgencyBadgeProps) {
  const urgency = getUrgency(dateExpiration);
  if (!urgency) return <span className="text-xs text-muted-foreground/50">—</span>;

  return (
    <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium", urgency.className)}>
      {urgency.label}
    </span>
  );
}
