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
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex items-center gap-2.5">
        <Loader2 className="size-4 animate-spin text-indigo-600" aria-hidden="true" />
        <p className="text-sm font-semibold text-zinc-900">Analyzing your schedule...</p>
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
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : active
                      ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                      : "border-gray-200 bg-gray-50 text-gray-400",
                )}
                aria-hidden="true"
              >
                {done ? <Check className="size-3.5" /> : active ? <Loader2 className="size-3 animate-spin" /> : null}
              </span>
              <span
                className={cn(
                  "text-sm",
                  done ? "text-zinc-900" : active ? "font-medium text-indigo-700" : "text-gray-400",
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