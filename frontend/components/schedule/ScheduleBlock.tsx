"use client";

import { TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { formatTimeRange } from "@/lib/time";
import type { DayLayout } from "@/lib/calendar";
import type { Entry } from "@/types";

interface ScheduleBlockProps {
  layout: DayLayout;
  hasConflict: boolean;
  onSelect: (entry: Entry) => void;
}

/** One absolutely-positioned class block inside a day column. */
export function ScheduleBlock({ layout, hasConflict, onSelect }: ScheduleBlockProps) {
  const { entry, topPercent, heightPercent, leftPercent, widthPercent, compact } = layout;

  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      title={`${entry.subject} · ${formatTimeRange(entry.startTime, entry.endTime)}`}
      aria-label={`${entry.subject}, ${formatTimeRange(entry.startTime, entry.endTime)}${entry.room ? `, ${entry.room}` : ""}${hasConflict ? ", scheduling conflict" : ""}`}
      className={cn(
        "absolute overflow-hidden rounded-lg border border-l-[3px] px-2 py-1.5 text-left",
        "transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-1",
        compact ? "min-h-8" : "",
      )}
      style={{
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
        left: `calc(${leftPercent}% + 2px)`,
        width: `calc(${widthPercent}% - 4px)`,
        backgroundColor: `${entry.color}1F`,
        borderColor: `${entry.color}33`,
        borderLeftColor: entry.color,
      }}
    >
      <p className="truncate text-xs leading-tight font-semibold text-zinc-900">
        {entry.subject}
      </p>
      {compact ? null : (
        <>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-gray-700">
            {formatTimeRange(entry.startTime, entry.endTime)}
          </p>
          {entry.room ? (
            <p className="truncate text-[11px] leading-tight text-gray-600">{entry.room}</p>
          ) : null}
        </>
      )}
      {hasConflict ? (
        <span className="mt-1 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">
          <TriangleAlert className="size-2.5" aria-hidden="true" />
          Conflict
        </span>
      ) : null}
    </button>
  );
}