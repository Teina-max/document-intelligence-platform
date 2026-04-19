import { Skeleton } from "@/components/ui/skeleton";

export default function DirectionLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-1 h-4 w-64" />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/60 p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="rounded-md border border-border/60 p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-48 w-full" />
      </div>
    </div>
  );
}
