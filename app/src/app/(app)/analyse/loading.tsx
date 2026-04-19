import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyseLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-1 h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-[280px]" />
      </div>

      {/* Top materiaux table */}
      <div>
        <Skeleton className="mb-3 h-4 w-48" />
        <div className="rounded-md border border-border/60">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4 border-b border-border/30 p-3">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Clients recurrents table */}
      <div className="section-divider">
        <Skeleton className="mb-3 h-4 w-44" />
        <div className="rounded-md border border-border/60">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 border-b border-border/30 p-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
