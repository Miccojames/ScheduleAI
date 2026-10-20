"use client";

import { Fragment, useEffect, useRef, useState, type DragEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScheduleBlock } from "@/components/schedule/ScheduleBlock";
import { calendarRange, hourMarks, layoutDay } from "@/lib/calendar";
import { DAY_ORDER, formatTime, fromMinutes, shortLabel, toMinutes, todayDayOfWeek } from "@/lib/time";
import { cn } from "cn";
import type { MoveTarget } from "@/hooks/useMoveEntry";
import type { Conflict, DayOfWeek, Entry } from "@/types";

interface WeeklyCalendarProps {
  entries: Entry[];
  conflicts: Conflict[];
  onSelectEntry: (entry: Entry) => void;
  onAddClass?: (day: DayOfWeek) => void;
  /** When provided, weekly blocks become draggable (desktop HTML5 DnD). */
  onMoveEntry?: (entry: Entry, target: MoveTarget) => void;
}

const HOUR_HEIGHT_PX = 56;
const HALF_HOUR = 30;
/** Drag moves snap to 15-minute marks. */
const SNAP_MINUTES = 15;

/** A Date that refreshes every minute — enough to keep the now-line honest. */
function useNowMinute(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

/** Day-of-month for each weekday of the week containing `now`. */
function weekDates(now: Date): Record<DayOfWeek, number> {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

  const dates = {} as Record<DayOfWeek, number>;
  DAY_ORDER.forEach((day, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    dates[day] = date.getDate();
  });
  return dates;
}

/**
 * CSS-grid week view: a sticky time gutter plus one column per day.
 * Blocks are positioned by percentage of the day range, which keeps the grid
 * fluid at any width.
 */
export function WeeklyCalendar({
  entries,
  conflicts,
  onSelectEntry,
  onAddClass,
  onMoveEntry,
}: WeeklyCalendarProps) {
  const now = useNowMinute();
  const today = todayDayOfWeek(now);
  const dates = weekDates(now);

  // --- Drag-to-reschedule state (only active when onMoveEntry is provided) ---
  const dragEntryRef = useRef<Entry | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<
    (MoveTarget & { subject: string; topPercent: number; heightPercent: number }) | null
  >(null);
  const hasWeekend = entries.some(
    (entry) => entry.day === "SATURDAY" || entry.day === "SUNDAY",
  );
  const days: DayOfWeek[] = hasWeekend ? DAY_ORDER : DAY_ORDER.slice(0, 5);

  const range = calendarRange(entries);
  const marks = hourMarks(range);
  const conflictedIds = new Set(conflicts.flatMap((conflict) => [conflict.a.id, conflict.b.id]));
  const gridHeight = (range.span / 60) * HOUR_HEIGHT_PX;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNowLine =
    days.includes(today) && nowMinutes >= range.start && nowMinutes <= range.end;
  const nowTop = ((nowMinutes - range.start) / range.span) * 100;

  const offsetOf = (minute: number) => `${((minute - range.start) / range.span) * 100}%`;

  // --- Drag-to-reschedule helpers -------------------------------------------------
  // The pointer (clientY) is treated as the block's CENTER while dragging, which
  // feels natural no matter where on the block the user grabbed. The result
  // snaps to SNAP_MINUTES and keeps the block's original duration.
  function computeDrop(
    event: DragEvent<HTMLDivElement>,
    day: DayOfWeek,
    durationMinutes: number,
  ): MoveTarget & { start: number } {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(
      Math.max((event.clientY - rect.top) / Math.max(rect.height, 1), 0),
      1,
    );
    const center = range.start + fraction * range.span;
    const snapped = Math.round((center - durationMinutes / 2) / SNAP_MINUTES) * SNAP_MINUTES;
    const start = Math.min(
      Math.max(snapped, range.start),
      Math.max(range.end - durationMinutes, range.start),
    );
    return {
      day,
      startTime: fromMinutes(start),
      endTime: fromMinutes(start + durationMinutes),
      start,
    };
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, day: DayOfWeek) {
    if (!onMoveEntry || !dragEntryRef.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const entry = dragEntryRef.current;
    const durationMinutes = toMinutes(entry.endTime) - toMinutes(entry.startTime);
    const target = computeDrop(event, day, durationMinutes);
    setDragPreview({
      ...target,
      subject: entry.subject,
      topPercent: ((target.start - range.start) / range.span) * 100,
      heightPercent: (durationMinutes / range.span) * 100,
    });
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>, day: DayOfWeek) {
    // Clear the ghost only when the pointer genuinely left this column
    // (child-element enter/leave events are filtered via contains()).
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    setDragPreview((preview) => (preview?.day === day ? null : preview));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, day: DayOfWeek) {
    if (!onMoveEntry || !dragEntryRef.current) return;
    event.preventDefault();
    const entry = dragEntryRef.current;
    const durationMinutes = toMinutes(entry.endTime) - toMinutes(entry.startTime);
    const target = computeDrop(event, day, durationMinutes);
    clearDragState();
    // Dropped back where it started → nothing to do.
    if (target.day === entry.day && target.startTime === entry.startTime) return;
    onMoveEntry(entry, {
      day: target.day,
      startTime: target.startTime,
      endTime: target.endTime,
    });
  }

  function clearDragState() {
    dragEntryRef.current = null;
    setDraggingId(null);
    setDragPreview(null);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-foreground/5">
      {/* WeekPreview-style header bar: label left, tracked count right. */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
        <span className="text-xs font-semibold text-foreground">
          This week
          {onMoveEntry ? (
            <span className="ml-2 hidden text-[11px] font-normal text-muted-foreground sm:inline">
              · drag an event to reschedule
            </span>
          ) : null}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] whitespace-nowrap text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          {entries.length} event{entries.length === 1 ? "" : "s"} tracked
        </span>
      </div>

      <div className="flex border-b border-border bg-card">
        <div className="w-14 shrink-0 sm:w-16" aria-hidden="true" />
        {days.map((day) => {
          const isToday = day === today;
          return (
            <div key={day} className="flex-1 border-l border-cal-line px-1 py-2 text-center">
              <p className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                {shortLabel(day)}
              </p>
              {isToday ? (
                <span className="sr-only" suppressHydrationWarning>
                  (today)
                </span>
              ) : null}
              <p
                suppressHydrationWarning
                className={cn(
                  "mx-auto mt-0.5 flex size-6 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums",
                  isToday
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                    : "text-foreground/80",
                )}
              >
                {dates[day]}
              </p>
              {onAddClass ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="mt-0.5 text-muted-foreground hover:text-primary"
                  aria-label={`Add class on ${shortLabel(day)}`}
                  onClick={() => onAddClass(day)}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex">
        <div
          className="relative w-14 shrink-0 border-r border-cal-line sm:w-16"
          style={{ height: gridHeight }}
        >
          {marks.map((minute) => (
            <div
              key={minute}
              className="relative -mt-2.5 pr-2 text-right text-[10.5px] leading-none font-medium tabular-nums text-cal-axis first:mt-0"
              style={{ height: HOUR_HEIGHT_PX }}
            >
              {formatTime(fromMinutes(minute)).replace(":00", "")}
            </div>
          ))}

          {showNowLine ? (
            <span
              aria-hidden="true"
              suppressHydrationWarning
              className="absolute right-0 z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cal-now ring-[3px] ring-card"
              style={{ top: `${nowTop}%` }}
            />
          ) : null}
        </div>

        {days.map((day) => {
          const dayEntries = entries.filter((entry) => entry.day === day);
          const layouts = layoutDay(dayEntries, range);
          const isToday = day === today;

          return (
            <div
              key={day}
              className={cn(
                "relative flex-1 border-l border-cal-line",
                isToday && "bg-cal-today",
              )}
              style={{ height: gridHeight }}
              suppressHydrationWarning
              onDragOver={onMoveEntry ? (event) => handleDragOver(event, day) : undefined}
              onDragLeave={onMoveEntry ? (event) => handleDragLeave(event, day) : undefined}
              onDrop={onMoveEntry ? (event) => handleDrop(event, day) : undefined}
            >
              {marks.map((minute) => (
                <Fragment key={minute}>
                  <div
                    className="pointer-events-none absolute inset-x-0 border-t border-cal-line"
                    style={{ top: offsetOf(minute) }}
                    aria-hidden="true"
                  />
                  {minute + HALF_HOUR < range.end ? (
                    <div
                      className="pointer-events-none absolute inset-x-0 border-t border-dashed border-cal-line-soft"
                      style={{ top: offsetOf(minute + HALF_HOUR) }}
                      aria-hidden="true"
                    />
                  ) : null}
                </Fragment>
              ))}

              {isToday && showNowLine ? (
                <div
                  aria-hidden="true"
                  suppressHydrationWarning
                  className="pointer-events-none absolute inset-x-0 z-[1] h-px bg-primary/70"
                  style={{ top: `${nowTop}%` }}
                >
                  <span className="absolute -left-1 -top-[3px] size-1.5 rounded-full bg-primary" />
                </div>
              ) : null}

              {/* Ghost preview: where the dragged block would land. */}
              {onMoveEntry && dragPreview && dragPreview.day === day ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 z-30 rounded-lg border-2 border-dashed border-primary/70 bg-primary/10"
                  style={{
                    top: `${dragPreview.topPercent}%`,
                    height: `${dragPreview.heightPercent}%`,
                  }}
                >
                  <p className="truncate px-1.5 pt-1 text-[10.5px] font-semibold text-primary">
                    {dragPreview.subject} · {formatTime(dragPreview.startTime)}
                  </p>
                </div>
              ) : null}

              {layouts.map((layout) => (
                <ScheduleBlock
                  key={layout.entry.id}
                  layout={layout}
                  hasConflict={conflictedIds.has(layout.entry.id)}
                  onSelect={onSelectEntry}
                  draggable={Boolean(onMoveEntry) && !layout.entry.isOneOff}
                  isDragging={draggingId === layout.entry.id}
                  onDragStartEntry={(entry) => {
                    dragEntryRef.current = entry;
                    setDraggingId(entry.id);
                  }}
                  onDragEndEntry={clearDragState}
                />
              ))}

              {dayEntries.length === 0 ? (
                <div className="pointer-events-none absolute inset-x-0 top-8 flex flex-col items-center gap-1">
                  <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-cal-muted">
                    No classes
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
