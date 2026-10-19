"use client";

import { useState } from "react";
import { CalendarX2, CalendarRange, Clock, Layers } from "lucide-react";
import { toast } from "sonner";
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
import {
  useCreateSchedule,
  useDeleteSchedule,
  useRenameSchedule,
  useSchedules,
} from "@/hooks/useSchedules";
import { apiErrorMessage } from "@/services/api";
import { formatDate } from "@/lib/time";
import { useActiveScheduleStore } from "@/stores/activeScheduleStore";
import type { Schedule } from "@/types";

function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  initialValue,
  confirmLabel,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initialValue?: string;
  confirmLabel: string;
  isPending: boolean;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState(initialValue ?? "");

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
            onKeyDown={(event) => {
              if (event.key === "Enter" && name.trim()) onConfirm(name.trim());
            }}
          />
        </div>
        <DialogFooter className="-mx-6 -mb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(name.trim())} disabled={isPending || !name.trim()}>
            {isPending ? "Saving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SchedulesPage() {
  const { data: schedules = [], isLoading, isError, refetch } = useSchedules();
  const createSchedule = useCreateSchedule();
  const renameSchedule = useRenameSchedule();
  const deleteSchedule = useDeleteSchedule();

  const activeScheduleId = useActiveScheduleStore((state) => state.activeScheduleId);
  const setActiveScheduleId = useActiveScheduleStore((state) => state.setActiveScheduleId);

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Schedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);

  if (isLoading) return <LoadingState rows={3} />;
  if (isError) return <ErrorState message={apiErrorMessage(isError)} onRetry={() => refetch()} />;

  return (
    <>
      <PageHeader
        title="Schedules"
        description="Keep each term or program in its own schedule."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Layers className="size-4" aria-hidden="true" />
            New Schedule
          </Button>
        }
      />

      {schedules.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="No schedule yet."
          body="Upload a photo of your class schedule and we'll organize it for you."
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
            return (
              <li key={schedule.id}>
                <div className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                          <CalendarRange className="size-4.5" aria-hidden="true" />
                        </span>
                        <h2 className="text-base font-semibold text-zinc-900">{schedule.name}</h2>
                      </div>
                      {isActive ? (
                        <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-50">
                          Active
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-4" aria-hidden="true" />
                        {schedule.entryCount} {schedule.entryCount === 1 ? "class" : "classes"}
                      </span>
                      <span>Created {formatDate(new Date(schedule.createdAt))}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
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
                      Rename
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => setDeleteTarget(schedule)}
                    >
                      Delete
                    </Button>
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
        description="Group your classes by term or program."
        confirmLabel="Create Schedule"
        isPending={createSchedule.isPending}
        onConfirm={(name) => {
          createSchedule.mutate(name, {
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
        title="Rename Schedule"
        description="Pick a name you'll recognise later."
        initialValue={renameTarget?.name ?? ""}
        confirmLabel="Save Changes"
        isPending={renameSchedule.isPending}
        onConfirm={(name) => {
          if (!renameTarget) return;
          renameSchedule.mutate(
            { id: renameTarget.id, name },
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
        description={`This will permanently delete this schedule and its ${deleteTarget?.entryCount ?? 0} ${deleteTarget?.entryCount === 1 ? "class" : "classes"}.`}
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