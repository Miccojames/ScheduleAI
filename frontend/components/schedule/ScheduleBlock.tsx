"use client";

import type { CSSProperties } from "react";
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

/**
 * One absolutely-positioned class block inside a day column. The class colour
 * drives a soft tint, a solid left edge and two shades of "ink" for the text,
 * so every palette colour stays readable on its own tint in both themes.
 */
export function ScheduleBlock({ layout, hasConflict, onSelect }: ScheduleBlockProps) {
  const { entry, topPercent, heightPercent, leftPercent, widthPercent, compact } = layout;
  const timeRange = formatTimeRange(entry.startTime, entry.endTime);
  const detail = entry.room ?? entry.instructor;

  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      title={`${entry.subject} · ${timeRange}`}
      aria-label={`${entry.subject}, ${timeRange}${entry.room ? `, ${entry.room}` : ""}${hasConflict ? ", scheduling conflict" : ""}`}
      className={cn(
        "entry-surface group absolute z-10 overflow-hidden rounded-lg border border-l-[3px] px-1.5 py-1 text-left",
        "shadow-xs transition-[transform,box-shadow] duration-150 ease-out will-change-transform",
        "hover:z-20 hover:-translate-y-px hover:shadow-lg hover:shadow-foreground/10",
        "active:translate-y-0 active:scale-[0.985]",
        "focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        hasConflict && "entry-conflict",
        compact ? "min-h-8" : "",
      )}
      style={
        {
          "--entry": entry.color,
          // Landing-page tint: the entry colour mixed against the card so the
          // block stays readable in both themes (overrides .entry-surface).
          backgroundColor: `color-mix(in srgb, ${entry.color} 16%, var(--card))`,
          top: `${topPercent}%`,
          height: `${heightPercent}%`,
          left: `calc(${leftPercent}% + 3px)`,
          width: `calc(${widthPercent}% - 6px)`,
        } as CSSProperties
      }
    >
      <p className="entry-ink truncate text-[11px] leading-[1.15] font-semibold">
        {entry.subject}
      </p>

      <div className="mt-px flex items-center gap-1">
        <p className="entry-ink-soft min-w-0 flex-1 truncate text-[10px] leading-[1.15] font-medium tabular-nums">
          {timeRange}
        </p>
        {hasConflict ? (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-conflict-soft px-1 py-px text-[9.5px] leading-[1.15] font-semibold text-conflict-fg">
            <TriangleAlert className="size-2.5" aria-hidden="true" />
            <span className="hidden lg:inline">Conflict</span>
          </span>
        ) : null}
      </div>

      {!compact && detail ? (
        <p className="mt-px truncate text-[10px] leading-[1.15] text-muted-foreground">
          {detail}
        </p>
      ) : null}
    </button>
  );
}
