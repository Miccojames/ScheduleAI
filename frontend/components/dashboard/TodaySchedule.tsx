"use client";

import { CalendarX2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { minutesUntil, toMinutes } from "@/lib/time";
import type { Entry } from "@/types";

interface TodayScheduleProps {
  entries: Entry[];
  now: Date;
}

/** Vertical timeline of today's classes. */
export function TodaySchedule({ entries, now }: TodayScheduleProps) {
  const sorted = [...entries].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <Card className="rounded-2xl border-gray-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{"Today's Schedule"}</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="No classes scheduled for today."
            body="Use the free time to catch up — or add a class if something is missing."
            className="border-0 bg-gray-50 py-10"
          />
        ) : (
          <ol className="relative space-y-3 border-l border-gray-100 pl-5">
            {sorted.map((entry) => {
              const untilStart = minutesUntil(now, entry.startTime);
              const duration = toMinutes(entry.endTime) - toMinutes(entry.startTime);
              const isNext = untilStart > 0 && untilStart <= 60;
              const inProgress = untilStart <= 0 && untilStart > -duration;

              return (
                <li key={entry.id} className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute top-3 -left-[1.4rem] size-2.5 rounded-full ring-4 ring-white"
                    style={{ backgroundColor: entry.color }}
                  />
                  <div
                    className="rounded-xl border border-l-[3px] border-gray-100 p-3"
                    style={{ borderLeftColor: entry.color }}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-zinc-900">{entry.subject}</p>
                      <p className="text-xs font-medium text-gray-700">
                        {entry.startTime} – {entry.endTime}
                      </p>
                    </div>
                    {entry.room || entry.instructor ? (
                      <p className="mt-0.5 text-xs text-gray-500">
                        {[entry.room, entry.instructor].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                    {isNext ? (
                      <span className="mt-1.5 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                        Next up
                      </span>
                    ) : null}
                    {inProgress ? (
                      <span className="mt-1.5 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        In progress
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}