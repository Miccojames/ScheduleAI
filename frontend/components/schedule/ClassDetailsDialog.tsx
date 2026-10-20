"use client";

import { useState } from "react";
import { CalendarOff, CalendarPlus, Clock, MapPin, NotebookPen, Plus, Trash2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useUpdateEntry } from "@/hooks/useUpdateEntry";
import { KIND_META, kindOf } from "@/lib/kind";
import { googleCalendarUrl } from "@/lib/googleCalendar";
import { dayLabel, formatIsoDateLabel, formatTimeRange } from "@/lib/time";
import type { Entry, EntryPayload } from "@/types";

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
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

/** Read-only class details with edit + delete actions. */
export function ClassDetailsDialog({ entry, open, onOpenChange }: ClassDetailsDialogProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteEntry = useDeleteEntry();
  const updateEntry = useUpdateEntry();

  // Exception dates are edited here. The entry prop is a snapshot from the
  // page, so keep a local override that is keyed by entry id — opening a
  // different class automatically falls back to that entry's own dates.
  const [exceptionsOverride, setExceptionsOverride] = useState<{
    entryId: string;
    dates: string[];
  } | null>(null);
  const [newExceptionDate, setNewExceptionDate] = useState("");
  const [savingException, setSavingException] = useState(false);

  if (!entry) return null;

  const kind = kindOf(entry);
  const kindMeta = KIND_META[kind];

  const exceptions =
    exceptionsOverride && exceptionsOverride.entryId === entry.id
      ? exceptionsOverride.dates
      : entry.exceptionDates;

  /** The update endpoint replaces the whole entry — send everything back. */
  function buildPayload(nextExceptions: string[]): EntryPayload {
    if (!entry) throw new Error("entry missing");
    return {
      subject: entry.subject,
      day: entry.day,
      startTime: entry.startTime,
      endTime: entry.endTime,
      instructor: entry.instructor ?? undefined,
      room: entry.room ?? undefined,
      notes: entry.notes ?? undefined,
      color: `color-mix(in srgb, ${entry.color} 78%, var(--foreground))`,
      exceptionDates: nextExceptions,
      isOneOff: entry.isOneOff,
      kind,
      ...(entry.isOneOff && entry.date ? { date: entry.date } : {}),
    };
  }

  async function saveExceptions(nextExceptions: string[]) {
    if (!entry) return;
    setSavingException(true);
    try {
      const result = await updateEntry.mutateAsync({
        scheduleId: entry.scheduleId,
        entryId: entry.id,
        payload: buildPayload(nextExceptions),
      });
      setExceptionsOverride({ entryId: entry.id, dates: result.entry.exceptionDates });
      setNewExceptionDate("");
    } catch {
      // Toast already shown by the mutation hook.
    } finally {
      setSavingException(false);
    }
  }

  function addException() {
    const date = newExceptionDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (exceptions.includes(date)) {
      setNewExceptionDate("");
      return;
    }
    void saveExceptions([...exceptions, date].sort());
  }

  function removeException(date: string) {
    void saveExceptions(exceptions.filter((value) => value !== date));
  }

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
            <span
              className="mb-1.5 inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: `${entry.color}1A`,
                borderColor: `${entry.color}59`,
                color: `color-mix(in srgb, ${entry.color} 78%, var(--foreground))`,
              }}
            >
              <kindMeta.icon className="size-3.5" aria-hidden="true" />
              {kindMeta.label}
            </span>
            <DialogTitle className="text-lg font-semibold">{entry.subject}</DialogTitle>
            <DialogDescription
              className="flex items-center gap-2"
              style={{ color: `color-mix(in srgb, ${entry.color} 78%, var(--foreground))` }}
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
              label={kind === "class" ? "Room" : "Location"}
              value={entry.room?.trim() ? entry.room : "No room set"}
            />
            <DetailRow
              icon={User}
              label={kind === "class" ? "Instructor" : "Host"}
              value={entry.instructor?.trim() ? entry.instructor : "No instructor set"}
            />
            <Separator />
            {entry.isOneOff ? (
              <DetailRow
                icon={CalendarOff}
                label="One-time event"
                value={entry.date ? formatIsoDateLabel(entry.date) : "Date not set"}
              />
            ) : (
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <CalendarOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">No class on</p>
                    {exceptions.length > 0 ? (
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {exceptions.map((date) => (
                          <li key={date}>
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 py-0.5 pr-1 pl-2.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                              No class: {formatIsoDateLabel(date)}
                              <button
                                type="button"
                                aria-label={`Remove exception ${formatIsoDateLabel(date)}`}
                                disabled={savingException}
                                onClick={() => removeException(date)}
                                className="flex size-5 items-center justify-center rounded-full text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 hover:text-amber-900 dark:text-amber-200 disabled:opacity-50"
                              >
                                <X className="size-3" aria-hidden="true" />
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-0.5 text-sm text-foreground">This class meets every week.</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="date"
                        aria-label="Add a date this class does not meet"
                        value={newExceptionDate}
                        onChange={(event) => setNewExceptionDate(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addException();
                          }
                        }}
                        className="h-9 w-auto text-xs"
                        disabled={savingException}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addException}
                        disabled={savingException || !newExceptionDate}
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                        Add date
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <Separator />
            <DetailRow
              icon={NotebookPen}
              label="Notes"
              value={entry.notes?.trim() ? entry.notes : "No notes"}
            />
          </div>

          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmingDelete(true)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={googleCalendarUrl(entry)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open this event in Google Calendar"
                >
                  <CalendarPlus className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Google Calendar</span>
                  <span className="sm:hidden">Google</span>
                </a>
              </Button>
            </div>
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
        description="This will permanently remove this event from your schedule."
        confirmLabel="Delete"
        isPending={deleteEntry.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}