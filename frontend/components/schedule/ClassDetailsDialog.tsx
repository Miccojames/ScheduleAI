"use client";

import { useState } from "react";
import { Clock, MapPin, NotebookPen, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EditClassDialog } from "@/components/schedule/EditClassDialog";
import { useDeleteEntry } from "@/hooks/useDeleteEntry";
import { dayLabel, formatTimeRange } from "@/lib/time";
import type { Entry } from "@/types";

interface ClassDetailsDialogProps {
  entry: Entry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-gray-400" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-zinc-900">{value}</p>
      </div>
    </div>
  );
}

/** Read-only class details with edit + delete actions. */
export function ClassDetailsDialog({ entry, open, onOpenChange }: ClassDetailsDialogProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteEntry = useDeleteEntry();

  if (!entry) return null;

  function handleDelete() {
    if (!entry) return;
    deleteEntry.mutate(
      { scheduleId: entry.scheduleId, entryId: entry.id },
      {
        onSuccess: () => {
          setConfirmingDelete(false);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <>
      <Dialog
        open={open && !editing}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) setEditing(false);
        }}
      >
        <DialogContent className="p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{entry.subject}</DialogTitle>
            <DialogDescription
              className="flex items-center gap-2"
              style={{ color: entry.color }}
            >
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {dayLabel(entry.day)} · {formatTimeRange(entry.startTime, entry.endTime)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-1">
            <DetailRow
              icon={Clock}
              label="Time"
              value={formatTimeRange(entry.startTime, entry.endTime)}
            />
            <DetailRow
              icon={MapPin}
              label="Room"
              value={entry.room?.trim() ? entry.room : "No room set"}
            />
            <DetailRow
              icon={User}
              label="Instructor"
              value={entry.instructor?.trim() ? entry.instructor : "No instructor set"}
            />
            <Separator />
            <DetailRow
              icon={NotebookPen}
              label="Notes"
              value={entry.notes?.trim() ? entry.notes : "No notes"}
            />
          </div>

          <div className="flex flex-wrap justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmingDelete(true)}
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setEditing(true);
                  onOpenChange(false);
                }}
              >
                Edit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EditClassDialog
        open={editing}
        onOpenChange={(next) => {
          setEditing(next);
          if (next) onOpenChange(false);
        }}
        entry={entry}
      />

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete ${entry.subject}?`}
        description="This will permanently remove this class from your schedule."
        confirmLabel="Delete"
        isPending={deleteEntry.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}