"use client";

import { useMemo } from "react";
import { DAY_ORDER, DAY_SHORT_LABELS, toMinutes } from "@/lib/time";
import type { DayOfWeek } from "@/types";

export interface PreviewRow {
  subject: string;
  days: string[];
  startTime: string;
  endTime: string;
  color: string;
}

interface PreviewBlock {
  key: string;
  day: DayOfWeek;
  label: string;
  color: string;
  /** Percent of the day column, 0-100. */
  top: number;
  height: number;
}

/** The default window; expands outward when events fall outside it. */
const DEFAULT_START = 7 * 60;
const DEFAULT_END = 21 * 60;

/**
 * Compact read-only week grid of the rows currently under review, styled after
 * the landing-page preview. Decorative — screen readers get the table below.
 */
export function ReviewPreviewGrid({ rows }: { rows: PreviewRow[] }) {
  const { days, blocks, eventCount } = useMemo(() => {
    const usable = rows.filter((row) => {
      if (!row.subject.trim() || row.days.length === 0) return false;
      if (!row.startTime || !row.endTime) return false;
      const start = toMinutes(row.startTime);
      const end = toMinutes(row.endTime);
      return Number.isFinite(start) && Number.isFinite(end) && end > start;
    });

    let rangeStart = DEFAULT_START;
    let rangeEnd = DEFAULT_END;
    for (const row of usable) {
      rangeStart = Math.min(rangeStart, Math.floor(toMinutes(row.startTime) / 60) * 60);
      rangeEnd = Math.max(rangeEnd, Math.ceil(toMinutes(row.endTime) / 60) * 60);
    }
    const span = Math.max(rangeEnd - rangeStart, 60);

    const present = new Set<DayOfWeek>();
    const blocks: PreviewBlock[] = [];
    usable.forEach((row, rowIndex) => {
      const start = toMinutes(row.startTime);
      const end = toMinutes(row.endTime);
      for (const rawDay of row.days) {
        if (!DAY_ORDER.includes(rawDay as DayOfWeek)) continue;
        const day = rawDay as DayOfWeek;
        present.add(day);
        blocks.push({
          key: `${rowIndex}-${day}`,
          day,
          label: row.subject.trim(),
          color: row.color,
          top: ((start - rangeStart) / span) * 100,
          height: Math.max(((end - start) / span) * 100, 2),
        });
      }
    });

    return {
      days: DAY_ORDER.filter((day) => present.has(day)),
      blocks,
      eventCount: usable.length,
    };
  }, [rows]);

  if (days.length === 0) return null;

  const columns = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };

  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="text-xs font-semibold text-foreground">Week preview</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          {eventCount} {eventCount === 1 ? "event" : "events"}
        </span>
      </div>

      <div className="grid gap-px bg-border" style={columns}>
        {days.map((day) => (
          <div
            key={day}
            className="bg-card px-1 py-1.5 text-center text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {DAY_SHORT_LABELS[day]}
          </div>
        ))}
      </div>

      <div
        className="relative grid h-56 max-h-[260px] gap-px overflow-hidden bg-border"
        style={columns}
      >
        {days.map((day) => (
          <div key={day} className="relative bg-card">
            {[0, 1, 2, 3].map((quarter) => (
              <div
                key={quarter}
                className="h-1/4 border-b border-dashed border-cal-line-soft last:border-b-0"
              />
            ))}
            {blocks
              .filter((block) => block.day === day)
              .map((block) => (
                <div
                  key={block.key}
                  className="absolute inset-x-1 overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 shadow-xs"
                  style={{
                    top: `${block.top}%`,
                    height: `${block.height}%`,
                    backgroundColor: `color-mix(in srgb, ${block.color} 16%, var(--card))`,
                    borderLeftColor: block.color,
                  }}
                >
                  <p className="truncate text-[10px] leading-tight font-semibold text-foreground">
                    {block.label}
                  </p>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
