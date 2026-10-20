"use client";

import { Suspense, useRef, useState } from "react";
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
import { useMoveEntry } from "@/hooks/useMoveEntry";
import { ENTRY_KINDS, KIND_META, kindOf } from "@/lib/kind";
import type { EntryKind } from "@/lib/kind";
import { apiErrorMessage } from "@/services/api";
import type { DayOfWeek, Entry } from "@/types";
import { cn } from "cn";

const VALID_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

type KindFilter = EntryKind | "ALL";

/** Chip styling shared by the "All types" and per-kind filter buttons. */
function kindChipClass(active: boolean): string {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
    active
      ? "shadow-sm"
      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900",
  );
}

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
  /** Drag-to-reschedule on the desktop week grid. */
  const moveEntry = useMoveEntry();
  /** Local event-type filter — chips above the toolbar drive this. */
  const [kindFilter, setKindFilter] = useState<KindFilter>("ALL");
  /** Desktop weekly grid — captured by "Save image" in the toolbar. */
  const calendarExportRef = useRef<HTMLDivElement | null>(null);

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
    if (kindFilter !== "ALL" && kindOf(entry) !== kindFilter) return false;
    if (!searchTerm) return true;
    const kindMeta = KIND_META[kindOf(entry)];
    return [entry.subject, entry.instructor, entry.room, kindMeta.label, kindMeta.plural].some(
      (field) => field?.toLowerCase().includes(searchTerm),
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
            Add Event
          </Button>
        }
      />

      {/* Event-type filter chips (local state — the toolbar owns day/sort/search). */}
      <div
        className="mb-3 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filter by event type"
      >
        <button
          type="button"
          aria-pressed={kindFilter === "ALL"}
          onClick={() => setKindFilter("ALL")}
          className={kindChipClass(kindFilter === "ALL")}
        >
          All types
        </button>
        {ENTRY_KINDS.map((kind) => {
          const meta = KIND_META[kind];
          const Icon = meta.icon;
          const active = kindFilter === kind;
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={active}
              onClick={() => setKindFilter(active ? "ALL" : kind)}
              className={kindChipClass(active)}
              style={
                active
                  ? {
                      backgroundColor: `${meta.defaultColor}1A`,
                      borderColor: meta.defaultColor,
                      color: meta.defaultColor,
                    }
                  : undefined
              }
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {meta.label}
            </button>
          );
        })}
      </div>

      <ScheduleToolbar
        search={search}
        onSearchChange={(value) => updateParam("q", value)}
        dayFilter={VALID_DAYS.includes(dayFilter) ? dayFilter : "ALL"}
        onDayFilterChange={(value) => updateParam("day", value === "ALL" ? null : value)}
        sort={sort === "subject" ? "subject" : "time"}
        onSortChange={(value) => updateParam("sort", value === "time" ? null : value)}
        resultCount={sorted.length}
        schedule={active}
        exportTargetRef={calendarExportRef}
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
            title="No events yet."
            body="Add your first event manually, or upload a class timetable for the AI to scan."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  onClick={() => {
                    setAddDay(undefined);
                    setAddOpen(true);
                  }}
                >
                  <PlusCircle className="size-4" aria-hidden="true" />
                  Add Event
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
            title="No events match your filters."
            body="Try a different search term, or switch the day filter back to all days."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setKindFilter("ALL");
                  router.replace("/schedule", { scroll: false });
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop week grid */}
            <div className="hidden md:block" ref={calendarExportRef}>
              <WeeklyCalendar
                entries={sorted}
                conflicts={conflicts}
                onSelectEntry={openDetails}
                onAddClass={(day) => {
                  setAddDay(day);
                  setAddOpen(true);
                }}
                onMoveEntry={(entry, target) => moveEntry.mutate({ entry, target })}
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