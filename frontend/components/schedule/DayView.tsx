"use client";

import { useState } from "react";
import { CalendarX2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { ScheduleCard } from "@/components/schedule/ScheduleCard";
import { DAY_ORDER, dayLabel, formatDate, shortLabel, todayDayOfWeek } from "@/lib/time";
import { cn } from "cn";
import type { Conflict, DayOfWeek, Entry } from "@/types";

interface DayViewProps {
  entries: Entry[];
  conflicts: Conflict[];
  onSelectEntry: (entry: Entry) => void;
}

function shiftDay(day: DayOfWeek, delta: number): DayOfWeek {
  const index = DAY_ORDER.indexOf(day);
  return DAY_ORDER[(index + delta + DAY_ORDER.length) % DAY_ORDER.length];
}

/** Date of the week containing `now`, keyed by weekday. */
function weekDates(now: Date): Record<DayOfWeek, Date> {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

  const dates = {} as Record<DayOfWeek, Date>;
  DAY_ORDER.forEach((day, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    dates[day] = date;
  });
  return dates;
}

/** Phone-friendly replacement for the week grid: day chips + a stacked list. */
export function DayView({ entries, conflicts, onSelectEntry }: DayViewProps) {
  const now = new Date();
  const today = todayDayOfWeek(now);
  const dates = weekDates(now);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(today);

  const conflictedIds = new Set(conflicts.flatMap((conflict) => [conflict.a.id, conflict.b.id]));
  const dayEntries = entries
    .filter((entry) => entry.day === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const selectedDate = dates[selectedDay];

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous day"
          onClick={() => setSelectedDay((day) => shiftDay(day, -1))}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>

        <div className="flex flex-1 gap-1" role="tablist" aria-label="Days">
          {DAY_ORDER.map((day) => {
            const isSelected = selectedDay === day;
            const isToday = day === today;
            return (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`${dayLabel(day)} ${dates[day].getDate()}${isToday ? ", today" : ""}`}
                onClick={() => setSelectedDay(day)}
                suppressHydrationWarning
                className={cn(
                  "min-h-12 min-w-0 flex-1 rounded-xl border px-1 py-1 text-xs font-medium",
                  "transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-accent-foreground",
                  !isSelected && isToday && "text-primary",
                )}
              >
                <span className="block truncate">{shortLabel(day)}</span>
                <span
                  suppressHydrationWarning
                  className={cn(
                    "mt-0.5 block text-[10px] font-semibold tabular-nums",
                    isSelected
                      ? "text-primary-foreground"
                      : isToday
                        ? "text-primary"
                        : "text-muted-foreground",
                  )}
                >
                  {dates[day].getDate()}
                </span>
              </button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="icon"
          aria-label="Next day"
          onClick={() => setSelectedDay((day) => shiftDay(day, 1))}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-4 mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
          <span>{dayLabel(selectedDay)}</span>
          <span className="font-normal text-muted-foreground">{formatDate(selectedDate)}</span>
        </p>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {selectedDay === today ? (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
              Today
            </span>
          ) : null}
          {dayEntries.length === 0
            ? "Nothing scheduled"
            : `${dayEntries.length} ${dayEntries.length === 1 ? "class" : "classes"}`}
        </span>
      </div>

      {dayEntries.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="No classes scheduled for this day."
          body="Enjoy the free day, or add a class to fill it in."
        />
      ) : (
        <div className="space-y-2.5">
          {dayEntries.map((entry) => (
            <ScheduleCard
              key={entry.id}
              entry={entry}
              hasConflict={conflictedIds.has(entry.id)}
              onClick={() => onSelectEntry(entry)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
