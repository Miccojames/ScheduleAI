"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { dayLabel, formatTimeRange } from "@/lib/time";
import type { Conflict } from "@/types";

interface ConflictWarningProps {
  conflicts: Conflict[];
  /** Optional call to action shown under the list (e.g. "View schedule"). */
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}

function describe(side: Conflict["a"]) {
  return `${side.subject} — ${dayLabel(side.day)} ${formatTimeRange(side.startTime, side.endTime)}`;
}

/** Never colour-only: warning icon + heading + both classes written out. */
export function ConflictWarning({
  conflicts,
  actionHref,
  actionLabel = "View schedule",
  className,
}: ConflictWarningProps) {
  if (conflicts.length === 0) return null;

  return (
    <div
      role="alert"
      className={cn(
        "rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <TriangleAlert className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">⚠️ Schedule Conflict</h3>
          <p className="mt-0.5 text-sm text-amber-900">These classes overlap.</p>
          <ul className="mt-2.5 space-y-1 text-sm">
            {conflicts.map((conflict, index) => (
              <li key={`${conflict.a.id}-${conflict.b.id}-${index}`} className="flex flex-col">
                <span className="font-medium">{describe(conflict.a)}</span>
                <span className="font-medium">{describe(conflict.b)}</span>
              </li>
            ))}
          </ul>
          {actionHref ? (
            <Link
              href={actionHref}
              className="mt-3 inline-block text-sm font-medium text-amber-900 underline underline-offset-4 hover:text-amber-950"
            >
              {actionLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}