"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { ConflictWarning } from "@/components/schedule/ConflictWarning";
import {
  NEW_SCHEDULE_VALUE,
  ScheduleSelector,
} from "@/components/schedule/ScheduleSelector";
import {
  AddRowButton,
  emptyReviewRow,
  ReviewHint,
  ScheduleReviewTable,
  toReviewRow,
  type ReviewRow,
} from "@/components/schedule/ScheduleReviewTable";
import { expandDaysForConflicts, findConflicts } from "@/lib/conflicts";
import { colorForIndex } from "@/lib/time";
import { apiErrorMessage } from "@/services/api";
import { scheduleApi, scheduleKeys } from "@/services/schedule.api";
import { useCreateSchedule, useSchedules } from "@/hooks/useSchedules";
import { useReviewStore } from "@/stores/reviewStore";
import { useQueryClient } from "@tanstack/react-query";
import type { BulkEntry, Schedule } from "@/types";

const MOCK_BANNER =
  "Demo extraction — no AI key configured. Add GEMINI_API_KEY on the backend to enable real OCR.";

export default function UploadReviewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { detected, provider, clear } = useReviewStore();

  const { data: schedules = [], isLoading, isError, refetch } = useSchedules();
  const createSchedule = useCreateSchedule();

  // Selected schedule is derived; the stored choice wins once the user picks one.
  const [selectedOverride, setSelectedOverride] = useState<string | null>(null);
  const [newScheduleName, setNewScheduleName] = useState("");
  const [rows, setRows] = useState<ReviewRow[]>(() => detected.map(toReviewRow));
  const [saving, setSaving] = useState(false);

  const selectedId = selectedOverride ?? schedules[0]?.id ?? null;

  const conflicts = useMemo(() => {
    const usable = rows.filter((row) => row.startTime && row.endTime && row.days.length > 0);
    return findConflicts(expandDaysForConflicts(usable));
  }, [rows]);

  const invalidRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          !row.subject.trim() ||
          !row.startTime ||
          !row.endTime ||
          row.endTime <= row.startTime ||
          row.days.length === 0,
      ),
    [rows],
  );

  if (!isLoading && isError) {
    return <ErrorState message={apiErrorMessage(isError)} onRetry={() => refetch()} />;
  }

  if (isLoading) return <LoadingState rows={4} />;

  if (detected.length === 0) {
    return (
      <>
        <PageHeader title="Review Your Schedule" />
        <EmptyState
          icon={Info}
          title="No schedule to review."
          body="Upload a photo of your class schedule and we'll organize it for you."
          action={
            <Button onClick={() => router.push("/upload")}>Upload Schedule</Button>
          }
        />
      </>
    );
  }

  const targetSchedule: Schedule | undefined = schedules.find((s) => s.id === selectedId);

  async function handleSave() {
    if (invalidRows.length > 0) {
      toast.error("Fix the highlighted rows before saving.");
      return;
    }
    if (!selectedId) {
      toast.error("Choose a schedule to save into.");
      return;
    }

    setSaving(true);
    try {
      let scheduleId = selectedId;

      if (selectedId === NEW_SCHEDULE_VALUE) {
        if (!newScheduleName.trim()) {
          toast.error("Give your new schedule a name.");
          setSaving(false);
          return;
        }
        const created = await createSchedule.mutateAsync(newScheduleName.trim());
        scheduleId = created.schedule.id;
      }

      const entries: BulkEntry[] = rows.map((row, index) => ({
        subject: row.subject.trim(),
        days: row.days,
        startTime: row.startTime,
        endTime: row.endTime,
        instructor: row.instructor.trim() || undefined,
        room: row.room.trim() || undefined,
        notes: row.notes.trim() || undefined,
        color: colorForIndex(index),
      }));

      const result = await scheduleApi.bulkCreateEntries(scheduleId, entries);

      await queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      toast.success(
        `Saved ${result.saved} ${result.saved === 1 ? "class" : "classes"}${
          result.skipped > 0 ? ` (${result.skipped} duplicates skipped)` : ""
        }`,
      );
      clear();
      router.push("/schedule");
    } catch (error) {
      toast.error(apiErrorMessage(error, "We couldn't save your schedule."));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    clear();
    router.push("/upload");
  }

  return (
    <>
      <PageHeader
        title="Review Your Schedule"
        description="Check and correct the classes we detected before saving."
      />

      <div className="space-y-4">
        {provider === "mock" ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTitle className="text-amber-900">Demo mode</AlertTitle>
            <AlertDescription className="text-amber-900">{MOCK_BANNER}</AlertDescription>
          </Alert>
        ) : null}

        <ScheduleSelector
          schedules={schedules}
          value={selectedId}
          onChange={setSelectedOverride}
          onCreateNameChange={setNewScheduleName}
          isCreating={createSchedule.isPending}
        />

        {targetSchedule && targetSchedule.entryCount > 0 ? (
          <Alert className="border-gray-200 bg-gray-50 text-gray-700">
            <Info className="size-4" aria-hidden="true" />
            <AlertTitle className="text-gray-700">Heads up</AlertTitle>
            <AlertDescription className="text-gray-600">
              This schedule already has {targetSchedule.entryCount} classes — saving will add to it.
            </AlertDescription>
          </Alert>
        ) : null}

        <ConflictWarning conflicts={conflicts} />

        <ReviewHint />

        <ScheduleReviewTable rows={rows} onChange={setRows} />

        <AddRowButton onClick={() => setRows((current) => [...current, emptyReviewRow()])} />

        <div className="sticky bottom-20 z-10 flex flex-col-reverse gap-2 rounded-2xl border border-gray-200 bg-white/95 p-3 backdrop-blur sm:flex-row sm:justify-end md:bottom-4">
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            <X className="size-4" aria-hidden="true" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !selectedId}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              <>
                <Save className="size-4" aria-hidden="true" />
                Save Schedule
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}