import { Skeleton } from "@/components/ui/skeleton";

interface LoadingStateProps {
  /** How many placeholder cards to draw. */
  rows?: number;
  className?: string;
}

/** Skeleton placeholder used while data is loading — never a spinner. */
export function LoadingState({ rows = 3, className }: LoadingStateProps) {
  return (
    <div className={`space-y-3 ${className ?? ""}`} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-gray-200 bg-white p-5"
          aria-hidden="true"
        >
          <div className="flex items-center gap-4">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}