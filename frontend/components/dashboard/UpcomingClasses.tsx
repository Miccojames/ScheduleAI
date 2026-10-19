"use client";

import { CalendarX2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { ScheduleCard } from "@/components/schedule/ScheduleCard";
import { DAY_ORDER, dayOrder, formatDayHeading } from "@/lib/time";
import type { Entry } from "@/types";

interface UpcomingClassesProps {
  entries: Entry[];
  now: Date;
  /** How many days ahead to look (the dashboard shows three). */
  days?: number;
}

interface DayGroup {
  day: Entry["day"];
  entries: Entry[];
}

/** Classes for the next few days, grouped by day. */
export function UpcomingClasses({ entries, now, days = 3 }: UpcomingClassesProps) {
  const todayIndex = now.getDay();
  const todayName = DAY_ORDER[(todayIndex + 6) % 7];

  const horizon = new Set(
    Array.from({ length: days }, (_, offset) => DAY_ORDER[(dayOrder(todayName) + offset) % 7]),
  );

  const groups: DayGroup[] = DAY_ORDER.filter((day) => horizon.has(day))
    .map((day) => ({
      day,
      entries: entries
        .filter((entry) => entry.day === day)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }))
    .filter((group) => group.entries.length > 0);

  return (
    <Card className="rounded-2xl border-gray-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Upcoming Classes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="Nothing coming up."
            body="No classes scheduled in the next few days."
            className="border-0 bg-gray-50 py-10"
          />
        ) : (
          groups.map((group) => (
            <section key={group.day} aria-labelledby={`upcoming-${group.day}`}>
              <h3 id={`upcoming-${group.day}`} className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                {formatDayHeading(group.day, now)}
              </h3>
              <ul className="space-y-2">
                {group.entries.map((entry) => (
                  <li key={entry.id}>
                    <ScheduleCard entry={entry} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}