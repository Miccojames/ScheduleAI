"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClassForm, type ClassFormDefaults } from "@/components/schedule/ClassForm";
import { ConflictWarning } from "@/components/schedule/ConflictWarning";
import { useCreateEntry } from "@/hooks/useCreateEntry";
import { useSchedules } from "@/hooks/useSchedules";
import { useActiveScheduleStore } from "@/stores/activeScheduleStore";
import type { Conflict, DayOfWeek, EntryPayload } from "@/types";

interface AddClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional day pre-selected when opened from the calendar header. */
  defaultDay?: DayOfWeek;
  defaultScheduleId?: string | null;
  /** Called after a successful save — the page uses it to close + redirect. */
  onSaved?: (conflicts: Conflict[]) => void;
}

/** Dialog wrapper around <ClassForm> used from the weekly calendar. */
export function AddClassDialog({
  open,
  onOpenChange,
  defaultDay,
  defaultScheduleId,
  onSaved,
}: AddClassDialogProps) {
  const { data: schedules = [] } = useSchedules();
  const activeScheduleId = useActiveScheduleStore((state) => state.activeScheduleId);
  const createEntry = useCreateEntry();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const defaults: ClassFormDefaults = {
    scheduleId: defaultScheduleId ?? activeScheduleId ?? schedules[0]?.id ?? "",
    day: defaultDay,
  };

  async function handleSubmit(values: {
    scheduleId: string;
    subject: string;
    day: DayOfWeek;
    startTime: string;
    endTime: string;
    instructor: string;
    room: string;
    notes: string;
  }) {
    const payload: EntryPayload = {
      subject: values.subject,
      day: values.day,
      startTime: values.startTime,
      endTime: values.endTime,
      instructor: values.instructor || undefined,
      room: values.room || undefined,
      notes: values.notes || undefined,
    };

    try {
      const result = await createEntry.mutateAsync({
        scheduleId: values.scheduleId,
        payload,
      });
      setConflicts(result.conflicts);
      onOpenChange(false);
      onSaved?.(result.conflicts);
    } catch {
      // Toast already shown by the mutation hook; keep the dialog open.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Add Class</DialogTitle>
          <DialogDescription>
            Add a single class to your schedule. You can repeat it on other days later.
          </DialogDescription>
        </DialogHeader>

        <ConflictWarning conflicts={conflicts} className="mt-1" />

        <ClassForm
          schedules={schedules}
          defaultValues={defaults}
          submitLabel="Add Class"
          isPending={createEntry.isPending}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}