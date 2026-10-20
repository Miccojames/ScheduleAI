"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "cn";
import { calendarRange, layoutDay, type DayLayout } from "@/lib/calendar";
import { DAY_ORDER, formatTime, shortLabel, todayDayOfWeek } from "@/lib/time";
import type { DayOfWeek, Entry } from "@/types";

type WeekGridVariant = "skeleton" | "live";

interface WeekGridProps {
  entries?: Entry[];
  /**
   * "skeleton" draws a decorative demo week (used automatically when there
   * are no entries); "live" positions the real entries by time.
   */
  variant?: WeekGridVariant;
  /** Left-hand header label. */
  title?: string;
  /** Extra element rendered on the right of the header (e.g. a link). */
  headerAction?: ReactNode;
  /** When provided, blocks become buttons that report their entry. */
  onSelectEntry?: (entry: Entry) => void;
  /** Extra classes for the card shell (margins, width, …). */
  className?: string;
}

/**
 * Decorative demo blocks for users with nothing scheduled yet — translated
 * from the landing page preview so both cards read as the same component.
 */
const DEMO_BLOCKS = [
  { day: 0, top: 6, height: 20, color: "#6366F1", label: "CS 201" },
  { day: 0, top: 46, height: 15, color: "#8B5CF6", label: "MATH 110" },
  { day: 1, top: 16, height: 20, color: "#10B981", label: "GYM" },
  { day: 2, top: 10, height: 24, color: "#EC4899", label: "WORK" },
  { day: 3, top: 30, height: 17, color: "#06B6D4", label: "BIO 120" },
  { day: 4, top: 22, height: 22, color: "#F59E0B", label: "SEMINAR" },
] as const;

/** A Date that refreshes every minute — enough to keep the now-line honest. */
function useNowMinute(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

/**
 * Compact week grid in the landing page's visual language: muted header bar,
 * gap-px day strip, dashed row separators and colour-mixed blocks. Sits at
 * dashboard card size, so it shows the subject first and the start time on a
 * second line when the block is tall enough.
 */
export function WeekGrid({
  entries = [],
  variant,
  title = "This week",
  headerAction,
  onSelectEntry,
  className,
}: WeekGridProps) {
  const now = useNowMinute();
  const isLive = (variant ?? (entries.length > 0 ? "live" : "skeleton")) === "live";

  const hasWeekend = entries.some(
    (entry) => entry.day === "SATURDAY" || entry.day === "SUNDAY",
  );
  // Weekend columns only appear when there is something on them, and they
  // fold away on small screens so the dashboard card stays readable.
  const visibleDays: DayOfWeek[] = isLive && hasWeekend ? DAY_ORDER : DAY_ORDER.slice(0, 5);

  const range = calendarRange(isLive ? entries : []);
  const today = todayDayOfWeek(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNowLine =
    isLive &&
    visibleDays.includes(today) &&
    nowMinutes >= range.start &&
    nowMinutes <= range.end;
  const nowTop = ((nowMinutes - range.start) / range.span) * 100;

  const gridColsClass =
    visibleDays.length > 5 ? "grid-cols-5 sm:grid-cols-7" : "grid-cols-5";
  /** Sat/Sun columns hide below the `sm` breakpoint (same fold as the calendar). */
  const columnClass = (index: number) => (index >= 5 ? "hidden sm:block" : "");

  const statusText = isLive
    ? `${entries.length} event${entries.length === 1 ? "" : "s"} tracked`
    : "8 events tracked";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-foreground/5",
        className,
      )}
    >
      {/* Header bar — same rhythm as the landing page preview. */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <div className="flex items-center gap-3">
          {headerAction}
          <span
            className="flex items-center gap-1.5 text-[11px] whitespace-nowrap text-muted-foreground"
            aria-hidden={!isLive || undefined}
          >
            <span className="size-1.5 rounded-full bg-primary" />
            {statusText}
          </span>
        </div>
      </div>

      {/* Day header strip. */}
      <div className={cn("grid gap-px bg-border", gridColsClass)}>
        {visibleDays.map((day, index) => (
          <div
            key={day}
            className={cn(
              "bg-card px-1 py-2 text-center text-[10px] font-semibold tracking-wide text-muted-foreground uppercase",
              columnClass(index),
            )}
          >
            {shortLabel(day)}
          </div>
        ))}
      </div>

      {/* Day columns. */}
      <div
        aria-hidden={!isLive || undefined}
        className={cn("relative grid h-56 gap-px overflow-hidden bg-border sm:h-64", gridColsClass)}
      >
        {visibleDays.map((day, index) => (
          <div key={day} className={cn("relative bg-card", columnClass(index))}>
            {isLive
              ? layoutDay(
                  entries.filter((entry) => entry.day === day),
                  range,
                ).map((layout) => (
                  <GridBlock
                    key={layout.entry.id}
                    layout={layout}
                    onSelectEntry={onSelectEntry}
                  />
                ))
              : DEMO_BLOCKS.filter((block) => block.day === index).map((block) => (
                  <div
                    key={block.label}
                    className="absolute inset-x-1 overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 opacity-50 shadow-xs"
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

            {/* Soft dashed row separators, painted under the blocks. */}
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                className={cn(
                  "h-1/4 border-dashed border-cal-line-soft",
                  row < 3 && "border-b",
                )}
              />
            ))}
          </div>
        ))}

        {/* Now-line: a hairline with a dot parked on the left edge. */}
        {isLive ? (
          showNowLine ? (
            <div
              aria-hidden="true"
              suppressHydrationWarning
              className="pointer-events-none absolute inset-x-0 z-[1] h-px bg-primary/70"
              style={{ top: `${nowTop}%` }}
            >
              <span className="absolute -left-1 -top-[3px] size-1.5 rounded-full bg-primary" />
            </div>
          ) : null
        ) : (
          <div
            className="pointer-events-none absolute inset-x-0 top-[52%] z-[1] h-px bg-primary/70"
          >
            <span className="absolute -left-1 -top-[3px] size-1.5 rounded-full bg-primary" />
          </div>
        )}
      </div>
    </div>
  );
}

interface GridBlockProps {
  layout: DayLayout;
  onSelectEntry?: (entry: Entry) => void;
}

/** One block in the compact grid — a div by default, a button when selectable. */
function GridBlock({ layout, onSelectEntry }: GridBlockProps) {
  const { entry, topPercent, heightPercent, leftPercent, widthPercent, compact } = layout;
  const style: CSSProperties = {
    top: `${topPercent}%`,
    height: `${heightPercent}%`,
    left: `calc(${leftPercent}% + 4px)`,
    width: `calc(${widthPercent}% - 8px)`,
    backgroundColor: `color-mix(in srgb, ${entry.color} 16%, var(--card))`,
    borderLeftColor: entry.color,
  };

  const body = (
    <>
      <p className="truncate text-[10px] leading-tight font-semibold text-foreground">
        {entry.subject}
      </p>
      {!compact ? (
        <p className="mt-0.5 truncate text-[9.5px] leading-tight font-medium tabular-nums text-muted-foreground">
          {formatTime(entry.startTime)}
        </p>
      ) : null}
    </>
  );

  const blockClass =
    "absolute min-h-5 overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 shadow-xs";

  if (onSelectEntry) {
    return (
      <button
        type="button"
        onClick={() => onSelectEntry(entry)}
        title={`${entry.subject} · ${formatTime(entry.startTime)}`}
        aria-label={`${entry.subject} at ${formatTime(entry.startTime)}`}
        className={cn(
          blockClass,
          "cursor-pointer text-left transition-[transform,box-shadow] duration-150 hover:z-10 hover:shadow-md hover:shadow-foreground/10 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
        )}
        style={style}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={blockClass} style={style}>
      {body}
    </div>
  );
}
