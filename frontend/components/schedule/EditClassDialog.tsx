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
import { useUpdateEntry } from "@/hooks/useUpdateEntry";
import type { Conflict, Entry, EntryPayload } from "@/types";

interface EditClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: Entry | null;
  onSaved?: (conflicts: Conflict[]) => void;
}

/** Prefilled edit form for a single class. */
export function EditClassDialog({ open, onOpenChange, entry, onSaved }: EditClassDialogProps) {
  const updateEntry = useUpdateEntry();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  if (!entry) return null;

  const defaults: ClassFormDefaults = {
    scheduleId: entry.scheduleId,
    subject: entry.subject,
    day: entry.day,
    startTime: entry.startTime,
    endTime: entry.endTime,
    instructor: entry.instructor ?? "",
    room: entry.room ?? "",
    notes: entry.notes ?? "",
  };

  async function handleSubmit(values: {
    subject: string;
    day: Entry["day"];
    startTime: string;
    endTime: string;
    instructor: string;
    room: string;
    notes: string;
  }) {
    if (!entry) return;
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
          <DialogTitle className="text-lg font-semibold">Edit Class</DialogTitle>
          <DialogDescription>Update the details of this class.</DialogDescription>
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