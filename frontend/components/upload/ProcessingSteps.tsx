"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "cn";

const STEPS = [
  "Uploading image",
  "Reading schedule",
  "Detecting classes",
  "Preparing your calendar",
] as const;

interface ProcessingStepsProps {
  /** How many steps have completed so far (0–4). */
  completedSteps: number;
}

/** Progress list shown while the AI reads the uploaded schedule. */
export function ProcessingSteps({ completedSteps }: ProcessingStepsProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2.5">
        <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground">Analyzing your schedule...</p>
      </div>

      <ol className="mt-5 space-y-3" aria-live="polite">
        {STEPS.map((step, index) => {
          const done = index < completedSteps;
          const active = index === completedSteps;

          return (
            <li key={step} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px]",
                  done
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : active
                      ? "border-primary/30 bg-accent text-primary"
                      : "border-border bg-muted text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {done ? <Check className="size-3.5" /> : active ? <Loader2 className="size-3 animate-spin" /> : null}
              </span>
              <span
                className={cn(
                  "text-sm",
                  done ? "text-foreground" : active ? "font-medium text-primary" : "text-muted-foreground",
                )}
              >
                {step}
                {done ? <span className="sr-only"> — done</span> : null}
                {active ? <span className="sr-only"> — in progress</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}