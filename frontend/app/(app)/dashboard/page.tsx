"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarX2, Clock, ImageUp, Layers, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { NextClassCard } from "@/components/dashboard/NextClassCard";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { ReminderBanner } from "@/components/dashboard/ReminderBanner";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { UpcomingClasses } from "@/components/dashboard/UpcomingClasses";
import { WeekGrid } from "@/components/schedule/WeekGrid";
import { useCountdown } from "@/hooks/useCountdown";
import { useScheduleEntries } from "@/hooks/useEntries";
import { useActiveSchedule } from "@/hooks/useSchedules";
import { useMe } from "@/hooks/useAuth";
import { apiErrorMessage } from "@/services/api";
import {
  formatCountdown,
  greeting,
  minutesUntil,
  nextOccurrence,
  todayDayOfWeek,
} from "@/lib/time";
import { useReminderStore } from "@/stores/reminderStore";
import type { Entry } from "@/types";

/** The next event from now on, across the whole week. */
function findNextEntry(entries: Entry[], now: Date): Entry | null {
  const candidates = entries
    .map((entry) => ({ entry, at: nextOccurrence(entry.day, entry.startTime, now) }))
    .filter(({ at }) => at.getTime() >= now.getTime() - 1000)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  return candidates[0]?.entry ?? null;
}

export default function DashboardPage() {
  const router = useRouter();
  const now = useCountdown();
  const { data: user } = useMe();
  const reminderLeadMinutes = useReminderStore((state) => state.reminderLeadMinutes);

  const { schedules, active, isLoading, isError, refetch } = useActiveSchedule();
  const {
    entries,
    isLoading: loadingEntries,
    isError: entriesError,
    refetch: refetchEntries,
  } = useScheduleEntries(active?.id);

  const today = todayDayOfWeek(now);
  const todayEntries = entries.filter((entry) => entry.day === today);
  const nextEntry = findNextEntry(entries, now);
  const nextMinutes = nextEntry ? minutesUntil(now, nextEntry.startTime) : Infinity;
  const showReminder = Boolean(nextEntry) && nextMinutes >= 0 && nextMinutes <= reminderLeadMinutes;

  const thisWeekEntries = entries.filter((entry) => entry.day !== "SATURDAY" && entry.day !== "SUNDAY");

  if (isError) {
    return <ErrorState message={apiErrorMessage(isError)} onRetry={() => refetch()} />;
  }

  if (!isLoading && schedules.length === 0) {
    return (
      <>
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {greeting(user?.firstName ?? "there", now)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            No schedule yet — upload a photo or add an event to get started.
          </p>
        </header>
        <div className="space-y-4">
          {/* Decorative hero: the same week grid the landing page shows off. */}
          <WeekGrid variant="skeleton" />
          <OnboardingChecklist />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push("/upload")}>
              <ImageUp className="size-4" aria-hidden="true" />
              Upload Schedule
            </Button>
            <Button variant="outline" onClick={() => router.push("/add-class")}>
              <PlusCircle className="size-4" aria-hidden="true" />
              Add Event
            </Button>
          </div>
        </div>
      </>
    );
  }

  const showError = entriesError && !loadingEntries;

  return (
    <>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {greeting(user?.firstName ?? "there", now)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {active ? `${active.name} · ${thisWeekEntries.length} events this week` : null}
          </p>
        </div>
        <Link
          href="/schedule"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
        >
          View full schedule
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </header>

      <div className="space-y-4">
        {/* First-run checklist: only while the active schedule is still empty. */}
        {!isLoading && !loadingEntries && !entriesError && active && entries.length === 0 ? (
          <OnboardingChecklist />
        ) : null}

        <StatsCards
          isLoading={isLoading || loadingEntries}
          stats={[
            {
              label: "Events today",
              value: String(todayEntries.length),
              hint: todayEntries.length === 1 ? "1 event" : `${todayEntries.length} events`,
              icon: CalendarX2,
              tone: "bg-primary/10 text-primary",
            },
            {
              label: "Next up",
              value: nextEntry ? formatCountdown(nextMinutes) : "—",
              hint: nextEntry ? nextEntry.subject : "Nothing scheduled",
              icon: Clock,
              tone: "bg-chart-4/15 text-chart-4",
            },
            {
              label: "This week",
              value: String(thisWeekEntries.length),
              hint: "Monday – Friday",
              icon: Layers,
              tone: "bg-chart-2/15 text-chart-2",
            },
          ]}
        />

        {showReminder && nextEntry ? (
          <ReminderBanner entry={nextEntry} now={now} />
        ) : null}

        {isLoading || loadingEntries ? (
          <LoadingState rows={3} />
        ) : showError ? (
          <ErrorState message={apiErrorMessage(entriesError)} onRetry={() => refetchEntries()} />
        ) : (
          <>
            <WeekGrid
              variant="live"
              entries={entries}
              headerAction={
                <Link
                  href="/schedule"
                  className="inline-flex items-center gap-1 text-[11px] font-medium whitespace-nowrap text-primary hover:text-primary/80"
                >
                  Open full schedule
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              }
            />

            <NextClassCard entry={nextEntry} now={now} />

            <div className="grid gap-4 lg:grid-cols-2">
              <TodaySchedule entries={todayEntries} now={now} />
              <UpcomingClasses entries={entries} now={now} days={3} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => router.push("/upload")}>
                <ImageUp className="size-4" aria-hidden="true" />
                Upload Schedule
              </Button>
              <Button variant="outline" onClick={() => router.push("/add-class")}>
                <PlusCircle className="size-4" aria-hidden="true" />
                Add Event
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}