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
 * The standard class card: a tinted surface with a solid 3px left border in the
 * class colour, dark text for readability, and conflict marked with an icon.
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
      className={cn(
        "block w-full rounded-2xl border border-gray-200 bg-white p-3 pl-4 text-left shadow-sm",
        "border-l-[3px] transition-shadow hover:shadow-md",
        onClick && "cursor-pointer",
        className,
      )}
      style={{ borderLeftColor: entry.color, backgroundColor: `${entry.color}14` }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-semibold text-zinc-900">{entry.subject}</p>
        {hasConflict ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
            <TriangleAlert className="size-3" aria-hidden="true" />
            Conflict
          </span>
        ) : null}
      </div>

      {!hideTime ? (
        <p className="mt-1 text-xs font-medium text-gray-700">
          {showDay ? `${entry.day.charAt(0)}${entry.day.slice(1).toLowerCase()} · ` : ""}
          {formatTimeRange(entry.startTime, entry.endTime)}
        </p>
      ) : null}

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
        {entry.room ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden="true" />
            {entry.room}
          </span>
        ) : null}
        {entry.instructor ? (
          <span className="inline-flex items-center gap-1">
            <User className="size-3.5" aria-hidden="true" />
            {entry.instructor}
          </span>
        ) : null}
      </div>
    </Wrapper>
  );
}