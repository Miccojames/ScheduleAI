"use client";

import { MapPin, TriangleAlert, User } from "lucide-react";
import { cn } from "cn";
import { formatTimeRange } from "@/lib/time";
import type { Entry } from "@/types";

interface ScheduleCardProps {
  entry: Entry;
  onClick?: () => void;
  showDay?: boolean;
  hasConflict?: boolean;
  /** Hides the time range (the calendar already shows it). */
  hideTime?: boolean;
  className?: string;
}

/**
 * The standard class card: a soft tint of the class colour with a solid 3px
 * left edge, text mixed toward the theme foreground so it stays readable, and
 * conflicts marked with an amber wash plus a chip.
 */
export function ScheduleCard({
  entry,
  onClick,
  showDay = false,
  hasConflict = false,
  hideTime = false,
  className,
}: ScheduleCardProps) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick } : {})}
      style={{ "--entry": entry.color } as React.CSSProperties}
      className={cn(
        "entry-surface group block w-full overflow-hidden rounded-xl border border-l-[3px] p-3 pl-3.5 text-left",
        "transition-[transform,box-shadow] duration-150 ease-out",
        onClick &&
          "cursor-pointer hover:-translate-y-px hover:shadow-lg hover:shadow-foreground/10 active:translate-y-0 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        hasConflict && "entry-conflict",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="entry-ink truncate text-sm font-semibold">{entry.subject}</p>
        {hasConflict ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-conflict-soft px-1.5 py-0.5 text-[11px] font-semibold text-conflict-fg">
            <TriangleAlert className="size-3" aria-hidden="true" />
            Conflict
          </span>
        ) : null}
      </div>

      {!hideTime ? (
        <p className="entry-ink-soft mt-1 text-xs font-medium tabular-nums">
          {showDay ? `${entry.day.charAt(0)}${entry.day.slice(1).toLowerCase()} · ` : ""}
          {formatTimeRange(entry.startTime, entry.endTime)}
        </p>
      ) : null}

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {entry.room ? (
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{entry.room}</span>
          </span>
        ) : null}
        {entry.instructor ? (
          <span className="inline-flex min-w-0 items-center gap-1">
            <User className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{entry.instructor}</span>
          </span>
        ) : null}
      </div>
    </Wrapper>
  );
}
