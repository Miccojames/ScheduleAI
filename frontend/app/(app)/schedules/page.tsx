"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarX2,
  CalendarRange,
  Clock,
  Download,
  Layers,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ScheduleThumb } from "@/components/schedule/ScheduleThumb";
import {
  useCreateSchedule,
  useDeleteSchedule,
  useRenameSchedule,
  useSchedules,
} from "@/hooks/useSchedules";
import { apiErrorMessage } from "@/services/api";
import { scheduleApi, scheduleKeys } from "@/services/schedule.api";
import { formatDate, formatDateRange } from "@/lib/time";
import {
  backupFilename,
  buildBackup,
  downloadJson,
  parseBackup,
  serializeBackup,
} from "@/lib/backup";
import { useActiveScheduleStore } from "@/stores/activeScheduleStore";
import type { Schedule } from "@/types";

/** Name + optional academic-term window, shared by create and edit dialogs. */
const scheduleDetailsSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name."),
    startDate: z.union([z.iso.date(), z.literal("")]),
    endDate: z.union([z.iso.date(), z.literal("")]),
  })
  .refine((values) => !values.startDate || !values.endDate || values.endDate >= values.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  initialName,
  initialStartDate,
  initialEndDate,
  confirmLabel,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initialName?: string;
  initialStartDate?: string | null;
  initialEndDate?: string | null;
  confirmLabel: string;
  isPending: boolean;
  onConfirm: (values: { name: string; startDate: string | null; endDate: string | null }) => void;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [startDate, setStartDate] = useState(initialStartDate ?? "");
  const [endDate, setEndDate] = useState(initialEndDate ?? "");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; endDate?: string }>({});

  function handleConfirm() {
    const parsed = scheduleDetailsSchema.safeParse({ name, startDate, endDate });
    if (!parsed.success) {
      const issues = parsed.error.issues;
      setFieldErrors({
        name: issues.find((issue) => issue.path[0] === "name")?.message,
        endDate: issues.find((issue) => issue.path[0] === "endDate")?.message,
      });
      return;
    }
    setFieldErrors({});
    onConfirm({
      name: parsed.data.name,
      startDate: parsed.data.startDate || null,
      endDate: parsed.data.endDate || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="schedule-name">Schedule name</Label>
          <Input
            id="schedule-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="BSIT 3A - 1st Semester"
            aria-invalid={Boolean(fieldErrors.name)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleConfirm();
            }}
          />
          {fieldErrors.name ? (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="schedule-start-date" className="text-xs text-muted-foreground">
              Term start <span className="font-normal">(optional)</span>
            </Label>
            <Input
              id="schedule-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="schedule-end-date" className="text-xs text-muted-foreground">
              Term end <span className="font-normal">(optional)</span>
            </Label>
            <Input
              id="schedule-end-date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              aria-invalid={Boolean(fieldErrors.endDate)}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
        </div>
        {fieldErrors.endDate ? (
          <p className="text-xs text-destructive">{fieldErrors.endDate}</p>
        ) : null}
        <DialogFooter className="-mx-6 -mb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || !name.trim()}>
            {isPending ? "Saving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SchedulesPage() {
  const queryClient = useQueryClient();
  const { data: schedules = [], isLoading, isError, refetch } = useSchedules();
  const createSchedule = useCreateSchedule();
  const renameSchedule = useRenameSchedule();
  const deleteSchedule = useDeleteSchedule();

  const activeScheduleId = useActiveScheduleStore((state) => state.activeScheduleId);
  const setActiveScheduleId = useActiveScheduleStore((state) => state.setActiveScheduleId);

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Schedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const entriesByScheduleId: Record<string, Awaited<ReturnType<typeof scheduleApi.entries>>["entries"]> = {};
      for (const schedule of schedules) {
        const result = await scheduleApi.entries(schedule.id);
        entriesByScheduleId[schedule.id] = result.entries;
      }
      const backup = buildBackup(schedules, entriesByScheduleId);
      const totalEntries = backup.schedules.reduce((sum, schedule) => sum + schedule.entries.length, 0);
      downloadJson(backupFilename(), serializeBackup(backup));
      toast.success(
        `Backup exported — ${backup.schedules.length} ${
          backup.schedules.length === 1 ? "schedule" : "schedules"
        }, ${totalEntries} ${totalEntries === 1 ? "event" : "events"}.`,
      );
    } catch (error) {
      toast.error(apiErrorMessage(error, "We couldn't export your backup."));
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    let importedSchedules = 0;
    let importedClasses = 0;
    let failedItems = 0;
    let skippedDuplicates = 0;
    try {
      const text = await file.text();
      const backup = parseBackup(text);

      for (const schedule of backup.schedules) {
        let scheduleId: string;
        try {
          const created = await scheduleApi.create(schedule.name, {
            startDate: schedule.startDate ?? null,
            endDate: schedule.endDate ?? null,
          });
          scheduleId = created.schedule.id;
          importedSchedules += 1;
        } catch {
          failedItems += 1;
          continue; // A schedule that can't be created takes its entries with it.
        }

        if (schedule.entries.length === 0) continue;
        try {
          // The backend caps bulk creates at 200 entries per call.
          const CHUNK_SIZE = 200;
          for (let i = 0; i < schedule.entries.length; i += CHUNK_SIZE) {
            const chunk = schedule.entries.slice(i, i + CHUNK_SIZE);
            const result = await scheduleApi.bulkCreateEntries(
              scheduleId,
              chunk.map((entry) => ({
                subject: entry.subject,
                days: [entry.day],
                startTime: entry.startTime,
                endTime: entry.endTime,
                instructor: entry.instructor ?? undefined,
                room: entry.room ?? undefined,
                notes: entry.notes ?? undefined,
                color: entry.color,
                exceptionDates: entry.exceptionDates,
                kind: entry.kind,
                isOneOff: entry.isOneOff,
                date: entry.date ?? undefined,
              })),
            );
            importedClasses += result.saved;
            skippedDuplicates += result.skipped;
          }
        } catch {
          failedItems += schedule.entries.length;
        }
      }

      await queryClient.invalidateQueries({ queryKey: scheduleKeys.all });

      const skipNote =
        skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicate${skippedDuplicates === 1 ? "" : "s"} skipped)` : "";
      if (importedSchedules === 0 && importedClasses === 0) {
        toast.error(`Import failed — nothing was saved (${failedItems} failed item${failedItems === 1 ? "" : "s"}).`);
      } else if (failedItems > 0) {
        toast.warning(
          `Imported ${importedSchedules} ${importedSchedules === 1 ? "schedule" : "schedules"}, ${importedClasses} ${
            importedClasses === 1 ? "event" : "events"
          }${skipNote} — ${failedItems} item${failedItems === 1 ? "" : "s"} failed.`,
        );
      } else {
        toast.success(
          `Imported ${importedSchedules} ${importedSchedules === 1 ? "schedule" : "schedules"}, ${importedClasses} ${
            importedClasses === 1 ? "event" : "events"
          }${skipNote}.`,
        );
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, "We couldn't import this backup file."));
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  if (isLoading) return <LoadingState rows={3} />;
  if (isError) return <ErrorState message={apiErrorMessage(isError)} onRetry={() => refetch()} />;

  return (
    <>
      <PageHeader
        title="Schedules"
        description="Keep each term or program in its own schedule."
        actions={
          <>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImportFile(file);
              }}
            />
            <Button variant="outline" onClick={handleExport} disabled={exporting || importing || schedules.length === 0}>
              {exporting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              Export backup
            </Button>
            <Button variant="outline" onClick={() => importInputRef.current?.click()} disabled={importing || exporting}>
              {importing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="size-4" aria-hidden="true" />
              )}
              Import backup
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Layers className="size-4" aria-hidden="true" />
              New Schedule
            </Button>
          </>
        }
      />

      {schedules.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="No schedules yet."
          body="Create one, upload a timetable, or add events manually."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Layers className="size-4" aria-hidden="true" />
              New Schedule
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {schedules.map((schedule) => {
            const isActive = schedule.id === activeScheduleId;
            const termRange = formatDateRange(schedule.startDate, schedule.endDate);
            return (
              <li key={schedule.id}>
                <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="h-32 shrink-0 overflow-hidden rounded-t-2xl border-b border-border bg-card">
                    <ScheduleThumb scheduleId={schedule.id} />
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                            <CalendarRange className="size-4.5" aria-hidden="true" />
                          </span>
                          <h2 className="text-base font-semibold text-foreground">
                            {schedule.name}
                          </h2>
                        </div>
                        {isActive ? (
                          <Badge className="border-primary/30 bg-accent text-primary hover:bg-accent">
                            Active
                          </Badge>
                        ) : null}
                      </div>

                      {termRange ? (
                        <p className="mt-2 text-xs font-medium text-muted-foreground">{termRange}</p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="size-4" aria-hidden="true" />
                          {schedule.entryCount} {schedule.entryCount === 1 ? "event" : "events"}
                        </span>
                        <span>Created {formatDate(new Date(schedule.createdAt))}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                      <Button
                        variant={isActive ? "secondary" : "default"}
                        size="sm"
                        disabled={isActive}
                        onClick={() => {
                          setActiveScheduleId(schedule.id);
                          toast.success(`Switched to “${schedule.name}”.`);
                        }}
                      >
                        Switch
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRenameTarget(schedule)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTarget(schedule)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <NameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New Schedule"
        description="Group your events by term or program."
        confirmLabel="Create Schedule"
        isPending={createSchedule.isPending}
        onConfirm={(values) => {
          createSchedule.mutate(values, {
            onSuccess: () => setCreateOpen(false),
          });
        }}
      />

      <NameDialog
        key={renameTarget?.id ?? "rename"}
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        title="Edit Schedule"
        description="Update the name or set the term dates for this schedule."
        initialName={renameTarget?.name ?? ""}
        initialStartDate={renameTarget?.startDate ?? ""}
        initialEndDate={renameTarget?.endDate ?? ""}
        confirmLabel="Save Changes"
        isPending={renameSchedule.isPending}
        onConfirm={(values) => {
          if (!renameTarget) return;
          renameSchedule.mutate(
            { id: renameTarget.id, ...values },
            { onSuccess: () => setRenameTarget(null) },
          );
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete “${deleteTarget?.name ?? ""}”?`}
        description={`This will permanently delete this schedule and its ${deleteTarget?.entryCount ?? 0} ${deleteTarget?.entryCount === 1 ? "event" : "events"}.`}
        isPending={deleteSchedule.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          const deletingId = deleteTarget.id;
          deleteSchedule.mutate(deletingId, {
            onSuccess: () => {
              if (activeScheduleId === deletingId) {
                const remaining = schedules.filter((s) => s.id !== deletingId);
                setActiveScheduleId(remaining[0]?.id ?? null);
              }
              setDeleteTarget(null);
            },
          });
        }}
      />
    </>
  );
}
