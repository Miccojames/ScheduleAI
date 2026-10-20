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
import { useUpdateEntry } from "@/hooks/useUpdateEntry";
import { kindOf } from "@/lib/kind";
import type { Conflict, Entry } from "@/types";

interface EditClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: Entry | null;
  onSaved?: (conflicts: Conflict[]) => void;
}

/** Prefilled edit form for a single event. */
export function EditClassDialog({ open, onOpenChange, entry, onSaved }: EditClassDialogProps) {
  const updateEntry = useUpdateEntry();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  if (!entry) return null;

  const defaults: ClassFormDefaults = {
    scheduleId: entry.scheduleId,
    // kindOf() defaults missing/legacy values to "class" so the picker is
    // always pre-filled with a real value.
    kind: kindOf(entry),
    subject: entry.subject,
    day: entry.day,
    isOneOff: entry.isOneOff,
    date: entry.date ?? "",
    startTime: entry.startTime,
    endTime: entry.endTime,
    instructor: entry.instructor ?? "",
    room: entry.room ?? "",
    notes: entry.notes ?? "",
    color: `color-mix(in srgb, ${entry.color} 78%, var(--foreground))`,
  };

  async function handleSubmit(values: ClassFormValues) {
    if (!entry) return;
    const payload = classFormToPayload(values);

    // Keep the exception list when editing — the form doesn't manage it.
    if (entry.exceptionDates.length > 0) {
      payload.exceptionDates = entry.exceptionDates;
    }

    try {
      const result = await updateEntry.mutateAsync({
        scheduleId: entry.scheduleId,
        entryId: entry.id,
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
          <DialogTitle className="text-lg font-semibold">Edit Event</DialogTitle>
          <DialogDescription>Update the details of this event.</DialogDescription>
        </DialogHeader>

        <ConflictWarning conflicts={conflicts} className="mt-1" />

        <ClassForm
          key={entry.id}
          schedules={[]}
          defaultValues={defaults}
          submitLabel="Save Changes"
          lockSchedule
          isPending={updateEntry.isPending}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}