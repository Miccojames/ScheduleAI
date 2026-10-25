"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClassForm,
  classFormToPayload,
  type ClassFormDefaults,
  type ClassFormValues,
} from "@/components/schedule/ClassForm";
import { ConflictWarning } from "@/components/schedule/ConflictWarning";
import { useCreateEntry } from "@/hooks/useCreateEntry";
import { useSchedules } from "@/hooks/useSchedules";
import { useActiveScheduleStore } from "@/stores/activeScheduleStore";
import type { Conflict, DayOfWeek } from "@/types";

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

  async function handleSubmit(values: ClassFormValues) {
    const payload = classFormToPayload(values);

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
      <DialogContent className="sm:max-w-lg">
        {/* Full-height scroll area: header + form scroll inside while the ✕
            (rendered by DialogContent) and the sticky action row stay put.
            -m-4 bleeds past the dialog padding so the footer can go edge-to-edge. */}
        <div className="-m-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Add Event</DialogTitle>
            <DialogDescription>
              Add a single event to your schedule. You can repeat it on other days later.
            </DialogDescription>
          </DialogHeader>

          <ConflictWarning conflicts={conflicts} className="mt-1" />

          <ClassForm
            schedules={schedules}
            defaultValues={defaults}
            submitLabel="Add Event"
            isPending={createEntry.isPending}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            stickyActions
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}