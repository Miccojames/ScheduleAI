"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DAY_ORDER, DAY_SHORT_LABELS, toMinutes } from "@/lib/time";
import { scheduleApi, scheduleKeys } from "@/services/schedule.api";
import type { DayOfWeek } from "@/types";

interface ThumbBlock {
  key: string;
  day: DayOfWeek;
  label: string;
  color: string;
  /** Percent of the day column, 0-100. */
  top: number;
  height: number;
  /** Placeholder block for an empty schedule — rendered faded. */
  demo?: boolean;
}

/** The default window; expands outward when events fall outside it. */
const DEFAULT_START = 7 * 60;
const DEFAULT_END = 21 * 60;

/** Placeholder blocks for an empty schedule — decorative only. */
const DEMO_BLOCKS: ThumbBlock[] = [
  { key: "demo-1", day: "MONDAY", label: "Algebra", color: "#6366F1", top: 12, height: 26, demo: true },
  { key: "demo-2", day: "TUESDAY", label: "History", color: "#EC4899", top: 40, height: 20, demo: true },
  { key: "demo-3", day: "WEDNESDAY", label: "Biology", color: "#10B981", top: 18, height: 30, demo: true },
  { key: "demo-4", day: "THURSDAY", label: "English", color: "#F59E0B", top: 55, height: 22, demo: true },
];

const DEMO_DAYS: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

/**
 * Compact read-only week thumbnail for a schedule card. Shares the entries
 * query key with useEntries, so the cache is reused across the app.
 */
export function ScheduleThumb({ scheduleId }: { scheduleId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: scheduleKeys.entries(scheduleId),
    queryFn: () => scheduleApi.entries(scheduleId),
    staleTime: 30 * 1000,
    enabled: Boolean(scheduleId),
  });

  const { days, blocks } = useMemo(() => {
    const entries = data?.entries ?? [];

    let rangeStart = DEFAULT_START;
    let rangeEnd = DEFAULT_END;
    const present = new Set<DayOfWeek>();
    const parsed: (Omit<ThumbBlock, "key" | "top" | "height"> & { start: number; end: number })[] =
      [];

    for (const entry of entries) {
      const start = toMinutes(entry.startTime);
      const end = toMinutes(entry.endTime);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      present.add(entry.day);
      rangeStart = Math.min(rangeStart, Math.floor(start / 60) * 60);
      rangeEnd = Math.max(rangeEnd, Math.ceil(end / 60) * 60);
      parsed.push({
        day: entry.day,
        label: entry.subject,
        color: entry.color,
        start,
        end,
      });
    }

    if (parsed.length === 0) {
      return { days: DEMO_DAYS, blocks: DEMO_BLOCKS };
    }

    const span = Math.max(rangeEnd - rangeStart, 60);
    const blocks: ThumbBlock[] = parsed.map((entry, index) => ({
      key: `${index}-${entry.day}-${entry.start}`,
      day: entry.day,
      label: entry.label,
      color: entry.color,
      top: ((entry.start - rangeStart) / span) * 100,
      height: Math.max(((entry.end - entry.start) / span) * 100, 4),
    }));

    return {
      days: DAY_ORDER.filter((day) => present.has(day)),
      blocks,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="h-full w-full animate-pulse bg-muted/50" aria-hidden="true" />
    );
  }

  const columns = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };

  return (
    <div aria-hidden="true" className="flex h-full w-full flex-col bg-card">
      <div className="grid shrink-0 gap-px bg-border" style={columns}>
        {days.map((day) => (
          <div
            key={day}
            className="bg-card px-1 py-1 text-center text-[9px] font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {DAY_SHORT_LABELS[day]}
          </div>
        ))}
      </div>

      <div className="relative grid min-h-0 flex-1 gap-px overflow-hidden bg-border" style={columns}>
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
                  className={`absolute inset-x-0.5 overflow-hidden rounded-md border-l-2 px-1 py-0.5 shadow-xs${
                    block.demo ? " opacity-60" : ""
                  }`}
                  style={{
                    top: `${block.top}%`,
                    height: `${block.height}%`,
                    backgroundColor: `color-mix(in srgb, ${block.color} 14%, var(--card))`,
                    borderLeftColor: block.color,
                  }}
                >
                  <p className="truncate text-[9px] leading-tight font-semibold text-foreground">
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
