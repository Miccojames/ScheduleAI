"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, Loader2, RefreshCw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { ConflictWarning } from "@/components/schedule/ConflictWarning";
import { ReviewPreviewGrid } from "@/components/schedule/ReviewPreviewGrid";
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
import { useReprocessUpload } from "@/hooks/useUploads";
import { useReviewStore } from "@/stores/reviewStore";
import { useActiveScheduleStore } from "@/stores/activeScheduleStore";
import { useQueryClient } from "@tanstack/react-query";
import type { BulkEntry, Schedule } from "@/types";

export default function UploadReviewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { detected, provider, uploadId, imageUrl, setReview, clear } = useReviewStore();

  // Mock fallback (AI quota/503/timeout) → the review shows placeholder demo
  // data; saving requires an explicit acknowledgement and a real-AI retry is
  // offered so fake entries can never slip into a real schedule unnoticed.
  const isMock = provider === "mock";
  const reprocess = useReprocessUpload();
  const [demoAcknowledged, setDemoAcknowledged] = useState(false);

  const { data: schedules = [], isLoading, isError, refetch } = useSchedules();
  const createSchedule = useCreateSchedule();
  const activeScheduleId = useActiveScheduleStore((state) => state.activeScheduleId);
  const setActiveScheduleId = useActiveScheduleStore((state) => state.setActiveScheduleId);

  // Selected schedule is derived; the stored choice wins once the user picks one.
  const [selectedOverride, setSelectedOverride] = useState<string | null>(null);
  const [newScheduleName, setNewScheduleName] = useState("");
  // Stable suggestion for the auto-named schedule (computed once, client-side).
  const [suggestedName] = useState(
    () =>
      `Scanned schedule — ${new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })}`,
  );
  const [rows, setRows] = useState<ReviewRow[]>(() => detected.map(toReviewRow));
  const [saving, setSaving] = useState(false);

  // With zero schedules (loaded, not loading) default to "＋ New schedule" so
  // Save is usable without any clicks; otherwise prefer the active schedule.
  const selectedId =
    selectedOverride ??
    (!isLoading && schedules.length === 0
      ? NEW_SCHEDULE_VALUE
      : (schedules.find((schedule) => schedule.id === activeScheduleId)?.id ??
        schedules[0]?.id ??
        null));

  const conflicts = useMemo(() => {
    const usable = rows.filter((row) => row.startTime && row.endTime && row.days.length > 0);
    return findConflicts(expandDaysForConflicts(usable));
  }, [rows]);

  const previewRows = useMemo(
    () =>
      rows.map((row, index) => ({
        subject: row.subject,
        days: row.days,
        startTime: row.startTime,
        endTime: row.endTime,
        color: colorForIndex(index),
      })),
    [rows],
  );

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
    if (isMock && !demoAcknowledged) {
      toast.error("Acknowledge that these are demo entries before saving.");
      return;
    }
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
      let scheduleName: string;

      if (selectedId === NEW_SCHEDULE_VALUE) {
        // The selector's name input starts empty; fall back to the suggested
        // name so a zero-schedule user can save in one click.
        const name = newScheduleName.trim() || suggestedName;
        const created = await createSchedule.mutateAsync({ name });
        scheduleId = created.schedule.id;
        scheduleName = created.schedule.name;
      } else {
        scheduleName = targetSchedule?.name ?? "your schedule";
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

      // Show the freshly saved schedule right away — active pointer + caches.
      setActiveScheduleId(scheduleId);
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      clear();
      toast.success(
        `Saved ${result.saved} ${result.saved === 1 ? "event" : "events"} to “${scheduleName}”${
          result.skipped > 0 ? ` (${result.skipped} duplicates skipped)` : ""
        }`,
        {
          action: {
            label: "View schedule",
            onClick: () => router.push("/schedules"),
          },
        },
      );
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

  // One-click "give me real data" for the demo fallback: re-runs Gemini on the
  // same upload and swaps the review contents for the real extraction.
  async function handleRetryRealAi() {
    if (!uploadId || reprocess.isPending) return;
    try {
      const result = await reprocess.mutateAsync(uploadId);
      if (result.entries.length === 0) {
        // Keep the current rows/review usable — the user can retry or edit.
        toast.warning(
          "The AI found no classes in this image — check the photo and retry.",
        );
        return;
      }
      setReview({
        detected: result.entries,
        uploadId,
        provider: result.provider,
        imageUrl: result.upload.imageUrl ?? imageUrl,
      });
      setRows(result.entries.map(toReviewRow));
      setDemoAcknowledged(false);
      if (result.provider === "mock") {
        toast.warning("The AI is still unavailable — you are still reviewing demo data.");
      } else {
        toast.success("Real AI extraction complete.");
      }
    } catch {
      // useReprocessUpload already toasted the error; isPending resets itself
      // so the buttons re-enable.
    }
  }

  return (
    <>
      <PageHeader
        title="Review Your Schedule"
        description="Check and correct the events we detected before saving."
      />

      <div className="space-y-4">
        {isMock ? (
          <Alert className="w-full border-rose-300 bg-rose-50 text-rose-950">
            <AlertTriangle className="size-4 text-rose-600" aria-hidden="true" />
            <AlertTitle className="text-base font-bold text-rose-950">
              ⚠ You are reviewing DEMO data — not your photo
            </AlertTitle>
            <AlertDescription className="text-rose-900">
              <p>
                The AI service was unavailable, so these are placeholder entries.
                Do not save them as your real schedule.
              </p>
              <div className="mt-3">
                <Button
                  onClick={handleRetryRealAi}
                  disabled={reprocess.isPending || saving}
                  className="border border-rose-300 bg-white text-rose-800 hover:bg-rose-100"
                  variant="outline"
                >
                  {reprocess.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Re-running AI (up to ~2 min)…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-4" aria-hidden="true" />
                      Retry with real AI
                    </>
                  )}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        <ScheduleSelector
          schedules={schedules}
          value={selectedId}
          onChange={setSelectedOverride}
          onCreateNameChange={setNewScheduleName}
          isCreating={createSchedule.isPending}
        />

        {selectedId === NEW_SCHEDULE_VALUE ? (
          <p className="text-xs text-gray-500">
            Saving into a new schedule — you can rename it later in Schedules.
            {newScheduleName.trim()
              ? null
              : <> It will be named “<span className="font-medium">{suggestedName}</span>”.</>}
          </p>
        ) : null}

        {targetSchedule && targetSchedule.entryCount > 0 ? (
          <Alert className="border-gray-200 bg-gray-50 text-gray-700">
            <Info className="size-4" aria-hidden="true" />
            <AlertTitle className="text-gray-700">Heads up</AlertTitle>
            <AlertDescription className="text-gray-600">
              This schedule already has {targetSchedule.entryCount}{" "}
              {targetSchedule.entryCount === 1 ? "event" : "events"} — saving will add to it.
            </AlertDescription>
          </Alert>
        ) : null}

        <ConflictWarning conflicts={conflicts} />

        <ReviewHint />

        <ReviewPreviewGrid rows={previewRows} />

        <ScheduleReviewTable rows={rows} onChange={setRows} demoMode={isMock} />

        <AddRowButton onClick={() => setRows((current) => [...current, emptyReviewRow()])} />

        <div className="sticky bottom-20 z-10 rounded-2xl border border-gray-200 bg-white/95 p-3 backdrop-blur md:bottom-4">
          {isMock ? (
            <div className="mb-2 space-y-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-950">
              <p className="text-sm font-semibold">
                ⚠ Demo data — these entries are placeholders, not your schedule.
              </p>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-rose-900">
                <Checkbox
                  checked={demoAcknowledged}
                  onCheckedChange={(checked) => setDemoAcknowledged(checked === true)}
                  disabled={saving || reprocess.isPending}
                  className="mt-0.5 border-rose-400"
                />
                <span
                  className="cursor-pointer select-none"
                  onClick={() => setDemoAcknowledged((checked) => !checked)}
                >
                  I understand these are demo entries, not my real schedule
                </span>
              </label>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              <X className="size-4" aria-hidden="true" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !selectedId || reprocess.isPending || (isMock && !demoAcknowledged)}
            >
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
      </div>
    </>
  );
}