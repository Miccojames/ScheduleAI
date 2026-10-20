import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

/** Error card with a retry action — used on every data surface. */
export function ErrorState({
  title = "We couldn't load this",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 px-6 py-12 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-card text-destructive shadow-sm">
        <CloudOff className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground text-pretty">{message}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}