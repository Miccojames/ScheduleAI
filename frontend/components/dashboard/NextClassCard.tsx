"use client";

import Link from "next/link";
import { ArrowRight, Clock, MapPin, Sparkles, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCountdown, formatTimeRange, minutesUntil } from "@/lib/time";
import type { Entry } from "@/types";

interface NextClassCardProps {
  entry: Entry | null;
  now: Date;
  isLoading?: boolean;
}

/** The most prominent card on the dashboard: the next class with a live countdown. */
export function NextClassCard({ entry, now, isLoading = false }: NextClassCardProps) {
  if (isLoading) {
    return (
      <Card className="rounded-2xl border-gray-200 shadow-sm">
        <CardContent className="p-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-7 w-2/3" />
          <Skeleton className="mt-3 h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!entry) return null;

  const minutes = minutesUntil(now, entry.startTime);

  return (
    <Card className="rounded-2xl border-gray-200 border-l-[3px] shadow-sm" style={{ borderLeftColor: entry.color }}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-indigo-600">
              <Sparkles className="size-4" aria-hidden="true" />
              Your next class
            </p>
            <h2 className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-zinc-900">
              {entry.subject}
            </h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden="true" />
                {formatTimeRange(entry.startTime, entry.endTime)}
              </span>
              {entry.room ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden="true" />
                  {entry.room}
                </span>
              ) : null}
              {entry.instructor ? (
                <span className="inline-flex items-center gap-1.5">
                  <User className="size-4" aria-hidden="true" />
                  {entry.instructor}
                </span>
              ) : null}
            </p>
          </div>

          <div className="shrink-0 rounded-2xl bg-indigo-50 px-4 py-2.5 text-center">
            <p className="text-xs text-indigo-700">Starts</p>
            <p className="text-lg font-semibold tracking-tight text-indigo-700">
              {formatCountdown(minutes)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-500">
            {minutes > 0 ? "See you in class." : "This class is starting now."}
          </p>
          <Link
            href="/schedule"
            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            View full schedule
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}