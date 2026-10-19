"use client";

import { useState } from "react";
import { CalendarX2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { ScheduleCard } from "@/components/schedule/ScheduleCard";
import { DAY_ORDER, dayLabel, shortLabel, todayDayOfWeek } from "@/lib/time";
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

/** Phone-friendly replacement for the week grid: day chips + a stacked list. */
export function DayView({ entries, conflicts, onSelectEntry }: DayViewProps) {
  const today = todayDayOfWeek();
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(today);

  const conflictedIds = new Set(conflicts.flatMap((conflict) => [conflict.a.id, conflict.b.id]));
  const dayEntries = entries
    .filter((entry) => entry.day === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

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
          {DAY_ORDER.map((day) => (
            <button
              key={day}
              type="button"
              role="tab"
              aria-selected={selectedDay === day}
              onClick={() => setSelectedDay(day)}
              className={cn(
                "min-h-11 min-w-0 flex-1 rounded-xl border px-1 py-1.5 text-xs font-medium transition-colors",
                selectedDay === day
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
              )}
            >
              {shortLabel(day)}
              {day === today ? (
                <span
                  className={cn(
                    "block text-[10px]",
                    selectedDay === day ? "text-indigo-100" : "text-indigo-600",
                  )}
                >
                  Today
                </span>
              ) : null}
            </button>
          ))}
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

      <p className="mt-4 mb-2 text-sm font-semibold text-zinc-900">{dayLabel(selectedDay)}</p>

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