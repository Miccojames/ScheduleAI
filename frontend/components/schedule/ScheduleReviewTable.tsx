"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DAY_ORDER, shortLabel } from "@/lib/time";
import { cn } from "cn";
import type { DayOfWeek, DetectedEntry } from "@/types";

export interface ReviewRow {
  id: string;
  subject: string;
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
  room: string;
  instructor: string;
  notes: string;
  needsReview: boolean;
}

let rowCounter = 0;
function nextRowId() {
  rowCounter += 1;
  return `row-${rowCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Turns a detected entry into an editable row. */
export function toReviewRow(entry: DetectedEntry): ReviewRow {
  return {
    id: nextRowId(),
    subject: entry.subject ?? "",
    days: [...entry.days],
    startTime: entry.startTime ?? "",
    endTime: entry.endTime ?? "",
    room: entry.room ?? "",
    instructor: entry.instructor ?? "",
    notes: entry.notes ?? "",
    needsReview: entry.uncertainFields.length > 0,
  };
}

export function emptyReviewRow(): ReviewRow {
  return {
    id: nextRowId(),
    subject: "",
    days: ["MONDAY"],
    startTime: "",
    endTime: "",
    room: "",
    instructor: "",
    notes: "",
    needsReview: true,
  };
}

interface ScheduleReviewTableProps {
  rows: ReviewRow[];
  onChange: (rows: ReviewRow[]) => void;
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-rose-600">{children}</p>;
}

/** Stacked cards on phones, a compact grid on desktop — one row per class. */
export function ScheduleReviewTable({ rows, onChange }: ScheduleReviewTableProps) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const errors = useMemo(() => {
    const map = new Map<string, { subject?: string; endTime?: string }>();
    for (const row of rows) {
      const rowErrors: { subject?: string; endTime?: string } = {};
      if (!row.subject.trim()) rowErrors.subject = "Subject is required.";
      if (!row.startTime || !row.endTime) rowErrors.endTime = "Both times are required.";
      else if (row.endTime <= row.startTime) rowErrors.endTime = "End time must be after start time.";
      if (Object.keys(rowErrors).length > 0) map.set(row.id, rowErrors);
    }
    return map;
  }, [rows]);

  function update(id: string, patch: Partial<ReviewRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function toggleDay(id: string, day: DayOfWeek) {
    onChange(
      rows.map((row) => {
        if (row.id !== id) return row;
        const days = row.days.includes(day)
          ? row.days.filter((value) => value !== day)
          : [...row.days, day].sort(
              (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b),
            );
        return { ...row, days };
      }),
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const rowErrors = errors.get(row.id);

        return (
          <div
            key={row.id}
            className={cn(
              "rounded-2xl border bg-white p-4",
              row.needsReview ? "border-amber-200" : "border-gray-200",
            )}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">Class</span>
                {row.needsReview ? (
                  <Badge className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    Needs review
                  </Badge>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove class ${row.subject || "entry"}`}
                className="text-gray-400 hover:text-rose-600"
                onClick={() => setPendingDelete(row.id)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-12">
              <div className="md:col-span-4">
                <Label htmlFor={`${row.id}-subject`} className="text-xs text-gray-500">
                  Subject
                </Label>
                <Input
                  id={`${row.id}-subject`}
                  value={row.subject}
                  placeholder="Not detected"
                  aria-invalid={Boolean(rowErrors?.subject)}
                  onChange={(event) => update(row.id, { subject: event.target.value })}
                  className="mt-1"
                />
                <FieldError>{rowErrors?.subject}</FieldError>
              </div>

              <div className="md:col-span-4">
                <Label htmlFor={`${row.id}-start`} className="text-xs text-gray-500">
                  Start time
                </Label>
                <Input
                  id={`${row.id}-start`}
                  type="time"
                  step={300}
                  value={row.startTime}
                  onChange={(event) => update(row.id, { startTime: event.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="md:col-span-4">
                <Label htmlFor={`${row.id}-end`} className="text-xs text-gray-500">
                  End time
                </Label>
                <Input
                  id={`${row.id}-end`}
                  type="time"
                  step={300}
                  value={row.endTime}
                  aria-invalid={Boolean(rowErrors?.endTime)}
                  onChange={(event) => update(row.id, { endTime: event.target.value })}
                  className="mt-1"
                />
                <FieldError>{rowErrors?.endTime}</FieldError>
              </div>

              <div className="md:col-span-12">
                <span className="text-xs text-gray-500">Days</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Days for this class">
                  {DAY_ORDER.map((day) => {
                    const selected = row.days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleDay(row.id, day)}
                        className={cn(
                          "min-h-9 rounded-lg border px-2.5 text-xs font-medium transition-colors",
                          selected
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50",
                        )}
                      >
                        {shortLabel(day)}
                        <span className="sr-only">
                          {selected ? " selected" : " not selected"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-6">
                <Label htmlFor={`${row.id}-room`} className="text-xs text-gray-500">
                  Room
                </Label>
                <Input
                  id={`${row.id}-room`}
                  value={row.room}
                  placeholder="Not detected"
                  onChange={(event) => update(row.id, { room: event.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="md:col-span-6">
                <Label htmlFor={`${row.id}-instructor`} className="text-xs text-gray-500">
                  Instructor
                </Label>
                <Input
                  id={`${row.id}-instructor`}
                  value={row.instructor}
                  placeholder="Not detected"
                  onChange={(event) => update(row.id, { instructor: event.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="md:col-span-12">
                <Label htmlFor={`${row.id}-notes`} className="text-xs text-gray-500">
                  Notes
                </Label>
                <Textarea
                  id={`${row.id}-notes`}
                  value={row.notes}
                  rows={2}
                  placeholder="Not detected"
                  onChange={(event) => update(row.id, { notes: event.target.value })}
                  className="mt-1 resize-none"
                />
              </div>
            </div>
          </div>
        );
      })}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Remove this class?"
        description="It will be left out of the schedule when you save."
        confirmLabel="Remove"
        onConfirm={() => {
          if (pendingDelete) onChange(rows.filter((row) => row.id !== pendingDelete));
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

export function ReviewHint() {
  return (
    <p className="flex items-start gap-2 text-xs text-gray-500">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      Fields the AI could not read are marked “Needs review” and left blank for you to fill in.
    </p>
  );
}

export function AddRowButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="w-full">
      <Plus className="size-4" aria-hidden="true" />
      Add entry
    </Button>
  );
}