"use client";

import { BellRing } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { minutesUntil } from "@/lib/time";
import type { Entry } from "@/types";

interface ReminderBannerProps {
  entry: Entry;
  now: Date;
}

/** Amber banner shown when the next event is about to start. */
export function ReminderBanner({ entry, now }: ReminderBannerProps) {
  const minutes = minutesUntil(now, entry.startTime);

  return (
    <Card role="status" aria-live="polite" className="rounded-2xl border-amber-200 bg-amber-50 shadow-none">
      <CardContent className="flex items-start gap-3 p-4">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <BellRing className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-amber-950">🔔 Upcoming event</p>
          <p className="mt-0.5 text-sm text-amber-900">
            {entry.subject} {minutes > 0 ? `starts in ${minutes} minutes.` : "starts now."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}