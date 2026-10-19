"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarX2, ImageUp, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { AddClassDialog } from "@/components/schedule/AddClassDialog";
import { ClassDetailsDialog } from "@/components/schedule/ClassDetailsDialog";
import { ConflictWarning } from "@/components/schedule/ConflictWarning";
import { DayView } from "@/components/schedule/DayView";
import {
  ScheduleToolbar,
  type DayFilter,
  type SortMode,
} from "@/components/schedule/ScheduleToolbar";
import { WeeklyCalendar } from "@/components/schedule/WeeklyCalendar";
import { useActiveSchedule } from "@/hooks/useSchedules";
import { useScheduleEntries } from "@/hooks/useEntries";
import { apiErrorMessage } from "@/services/api";
import type { DayOfWeek, Entry } from "@/types";

const VALID_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

function ScheduleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { schedules, active, isLoading: loadingSchedules, isError: schedulesError, refetch } =
    useActiveSchedule();
  const {
    entries,
    conflicts,
    isLoading: loadingEntries,
    isError: entriesError,
    refetch: refetchEntries,
  } = useScheduleEntries(active?.id);

  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addDay, setAddDay] = useState<DayOfWeek | undefined>(undefined);

  const search = searchParams.get("q") ?? "";
  const dayFilter = (searchParams.get("day") as DayFilter) || "ALL";
  const sort = (searchParams.get("sort") as SortMode) || "time";

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const searchTerm = search.trim().toLowerCase();
  const filtered = entries.filter((entry) => {
    const matchesDay = dayFilter === "ALL" || entry.day === dayFilter;
    if (!matchesDay) return false;
    if (!searchTerm) return true;
    return [entry.subject, entry.instructor, entry.room].some((field) =>
      field?.toLowerCase().includes(searchTerm),
    );
  });

  const sorted = [...filtered].sort((a, b) =>
    sort === "subject"
      ? a.subject.localeCompare(b.subject)
      : a.startTime.localeCompare(b.startTime),
  );

  function openDetails(entry: Entry) {
    setSelectedEntry(entry);
    setDetailsOpen(true);
  }

  if (loadingSchedules) return <LoadingState rows={4} />;

  if (schedulesError) {
    return (
      <ErrorState message={apiErrorMessage(schedulesError)} onRetry={() => refetch()} />
    );
  }

  if (schedules.length === 0 || !active) {
    return (
      <EmptyState
        icon={CalendarX2}
        title="No schedule yet."
        body="Upload a photo of your class schedule and we'll organize it for you."
        action={
          <Button onClick={() => router.push("/upload")}>
            <ImageUp className="size-4" aria-hidden="true" />
            Upload Schedule
          </Button>
        }
      />
    );
  }

  const isLoading = loadingEntries;

  return (
    <>
      <PageHeader
        title="My Schedule"
        description={active.name}
        actions={
          <Button
            onClick={() => {
              setAddDay(undefined);
              setAddOpen(true);
            }}
          >
            <PlusCircle className="size-4" aria-hidden="true" />
            Add Class
          </Button>
        }
      />

      <ScheduleToolbar
        search={search}
        onSearchChange={(value) => updateParam("q", value)}
        dayFilter={VALID_DAYS.includes(dayFilter) ? dayFilter : "ALL"}
        onDayFilterChange={(value) => updateParam("day", value === "ALL" ? null : value)}
        sort={sort === "subject" ? "subject" : "time"}
        onSortChange={(value) => updateParam("sort", value === "time" ? null : value)}
        resultCount={sorted.length}
      />

      <div className="mt-4 space-y-4">
        {conflicts.length > 0 ? <ConflictWarning conflicts={conflicts} /> : null}

        {isLoading ? (
          <LoadingState rows={3} />
        ) : entriesError ? (
          <ErrorState message={apiErrorMessage(entriesError)} onRetry={() => refetchEntries()} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="No classes yet."
            body="Add your first class manually, or let the AI read a photo of your schedule."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  onClick={() => {
                    setAddDay(undefined);
                    setAddOpen(true);
                  }}
                >
                  <PlusCircle className="size-4" aria-hidden="true" />
                  Add Class
                </Button>
                <Button variant="outline" onClick={() => router.push("/upload")}>
                  <ImageUp className="size-4" aria-hidden="true" />
                  Upload Schedule
                </Button>
              </div>
            }
          />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="No classes match your filters."
            body="Try a different search term, or switch the day filter back to all days."
            action={
              <Button
                variant="outline"
                onClick={() => router.replace("/schedule", { scroll: false })}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop week grid */}
            <div className="hidden md:block">
              <WeeklyCalendar
                entries={sorted}
                conflicts={conflicts}
                onSelectEntry={openDetails}
                onAddClass={(day) => {
                  setAddDay(day);
                  setAddOpen(true);
                }}
              />
            </div>

            {/* Phone day view */}
            <div className="md:hidden">
              <DayView
                entries={sorted}
                conflicts={conflicts}
                onSelectEntry={openDetails}
              />
            </div>
          </>
        )}
      </div>

      <ClassDetailsDialog
        entry={selectedEntry}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <AddClassDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultDay={addDay}
        defaultScheduleId={active.id}
      />
    </>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<LoadingState rows={4} />}>
      <ScheduleContent />
    </Suspense>
  );
}