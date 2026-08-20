import { cn } from "@/lib/utils";

/**
 * Skeleton loading placeholders for premium loading states.
 */

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shimmer",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-muted/70 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 rounded-full bg-muted/70 w-3/4" />
          <div className="h-2.5 rounded-full bg-muted/50 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
