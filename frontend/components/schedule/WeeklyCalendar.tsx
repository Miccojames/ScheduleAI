"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScheduleBlock } from "@/components/schedule/ScheduleBlock";
import { calendarRange, hourMarks, layoutDay } from "@/lib/calendar";
import { DAY_ORDER, formatTime, fromMinutes, shortLabel, todayDayOfWeek } from "@/lib/time";
import type { Conflict, DayOfWeek, Entry } from "@/types";

interface WeeklyCalendarProps {
  entries: Entry[];
  conflicts: Conflict[];
  onSelectEntry: (entry: Entry) => void;
  onAddClass?: (day: DayOfWeek) => void;
}

const HOUR_HEIGHT_PX = 56;

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
}: WeeklyCalendarProps) {
  const today = todayDayOfWeek();
  const hasWeekend = entries.some(
    (entry) => entry.day === "SATURDAY" || entry.day === "SUNDAY",
  );
  const days: DayOfWeek[] = hasWeekend ? DAY_ORDER : DAY_ORDER.slice(0, 5);

  const range = calendarRange(entries);
  const marks = hourMarks(range);
  const conflictedIds = new Set(conflicts.flatMap((conflict) => [conflict.a.id, conflict.b.id]));
  const gridHeight = (range.span / 60) * HOUR_HEIGHT_PX;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="flex border-b border-gray-200 bg-white">
        <div className="w-14 shrink-0 sm:w-16" aria-hidden="true" />
        {days.map((day) => {
          const isToday = day === today;
          return (
            <div key={day} className="flex-1 border-l border-gray-100 px-1 py-2 text-center">
              <p
                className={`text-xs font-semibold ${isToday ? "text-indigo-600" : "text-gray-500"}`}
              >
                {shortLabel(day)}
                {isToday ? <span className="sr-only"> (today)</span> : null}
              </p>
              {onAddClass ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="mt-0.5 text-gray-400 hover:text-indigo-600"
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
        <div className="w-14 shrink-0 border-r border-gray-100 sm:w-16" style={{ height: gridHeight }}>
          {marks.map((minute) => (
            <div
              key={minute}
              className="relative -mt-2 pr-2 text-right text-[11px] text-gray-400 first:mt-0"
              style={{ height: HOUR_HEIGHT_PX }}
            >
              {formatTime(fromMinutes(minute)).replace(":00", "")}
            </div>
          ))}
        </div>

        {days.map((day) => {
          const dayEntries = entries.filter((entry) => entry.day === day);
          const layouts = layoutDay(dayEntries, range);

          return (
            <div
              key={day}
              className={`relative flex-1 border-l border-gray-100 ${day === today ? "bg-indigo-50/30" : ""}`}
              style={{ height: gridHeight }}
            >
              {marks.map((minute) => (
                <div
                  key={minute}
                  className="pointer-events-none absolute inset-x-0 border-t border-gray-100"
                  style={{ top: `${((minute - range.start) / range.span) * 100}%` }}
                  aria-hidden="true"
                />
              ))}

              {layouts.map((layout) => (
                <ScheduleBlock
                  key={layout.entry.id}
                  layout={layout}
                  hasConflict={conflictedIds.has(layout.entry.id)}
                  onSelect={onSelectEntry}
                />
              ))}

              {dayEntries.length === 0 ? (
                <div className="flex h-full items-start justify-center pt-4">
                  <span className="text-[11px] text-gray-300">No classes</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}