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

/** Vertical timeline of today's events. */
export function TodaySchedule({ entries, now }: TodayScheduleProps) {
  const sorted = [...entries].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <Card className="rounded-2xl border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{"Today's Plan"}</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="No events scheduled today."
            body="Use the free time to catch up — or add an event if something is missing."
            className="border-0 bg-muted/40 py-10"
          />
        ) : (
          <ol className="relative space-y-3 border-l border-border/70 pl-5">
            {sorted.map((entry) => {
              const untilStart = minutesUntil(now, entry.startTime);
              const duration = toMinutes(entry.endTime) - toMinutes(entry.startTime);
              const isNext = untilStart > 0 && untilStart <= 60;
              const inProgress = untilStart <= 0 && untilStart > -duration;

              return (
                <li key={entry.id} className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute top-3 -left-[1.4rem] size-2.5 rounded-full ring-4 ring-card"
                    style={{ backgroundColor: entry.color }}
                  />
                  <div
                    className="rounded-xl border border-l-[3px] border-border p-3"
                    style={{ borderLeftColor: entry.color }}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{entry.subject}</p>
                      <p className="text-xs font-medium text-foreground/80">
                        {entry.startTime} – {entry.endTime}
                      </p>
                    </div>
                    {entry.room || entry.instructor ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[entry.room, entry.instructor].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                    {isNext ? (
                      <span className="mt-1.5 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        Next up
                      </span>
                    ) : null}
                    {inProgress ? (
                      <span className="mt-1.5 inline-flex rounded-full bg-chart-5/15 px-2 py-0.5 text-[11px] font-medium text-chart-5">
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