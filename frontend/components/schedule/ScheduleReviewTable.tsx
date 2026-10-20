"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DAY_ORDER, shortLabel } from "@/lib/time";
import { cn } from "cn";
import type { DayOfWeek, DetectedEntry, UncertainField } from "@/types";

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
  /** Legacy per-field flags from the extractor ("days", "subject", …). */
  uncertainFields?: UncertainField[];
  /** Per-field AI confidence 0..1 — keys: subject, day, startTime, endTime, instructor, room. */
  confidence?: Record<string, number>;
}

/** Fields the AI reports confidence for, mapped from ReviewRow field names. */
const CONFIDENCE_KEYS = {
  subject: "subject",
  days: "day",
  startTime: "startTime",
  endTime: "endTime",
  room: "room",
  instructor: "instructor",
} as const;

type ReviewField = keyof typeof CONFIDENCE_KEYS;

/** Below this confidence the AI is "unsure" and the field gets flagged. */
export const CONFIDENCE_THRESHOLD = 0.75;

/** Whether a single field should carry the "AI unsure" treatment. */
export function isFieldUncertain(row: ReviewRow, field: ReviewField): boolean {
  if (row.uncertainFields?.includes(field)) return true;
  const value = row.confidence?.[CONFIDENCE_KEYS[field]];
  return typeof value === "number" && value < CONFIDENCE_THRESHOLD;
}

const ALL_REVIEW_FIELDS: ReviewField[] = ["subject", "days", "startTime", "endTime", "room", "instructor"];

/** True when any field on the row is flagged as uncertain. */
export function rowHasUncertainFields(row: ReviewRow): boolean {
  return ALL_REVIEW_FIELDS.some((field) => isFieldUncertain(row, field));
}

let rowCounter = 0;
function nextRowId() {
  rowCounter += 1;
  return `row-${rowCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Turns a detected entry into an editable row. */
export function toReviewRow(entry: DetectedEntry): ReviewRow {
  const row: ReviewRow = {
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
  if (entry.uncertainFields.length > 0) row.uncertainFields = entry.uncertainFields;
  if (entry.confidence) row.confidence = entry.confidence;
  if (row.needsReview || rowHasUncertainFields(row)) row.needsReview = true;
  return row;
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
  /** When true, every row is badged as demo data (mock provider fallback). */
  demoMode?: boolean;
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-destructive">{children}</p>;
}

const UNCERTAIN_TOOLTIP = "AI unsure — please verify";

/** Amber ring + warning icon around a single flagged field. */
function UncertainFieldWrapper({
  uncertain,
  children,
}: {
  uncertain: boolean;
  children: ReactNode;
}) {
  if (!uncertain) return <>{children}</>;
  return (
    <div className="relative">
      {children}
      <span
        title={UNCERTAIN_TOOLTIP}
        className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-amber-500"
      >
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        <span className="sr-only">{UNCERTAIN_TOOLTIP}</span>
      </span>
    </div>
  );
}

const uncertainInputClass =
  "border-amber-500/40 bg-amber-500/10 focus-visible:ring-amber-300 aria-invalid:border-rose-400";

/** Stacked cards on phones, a compact grid on desktop — one row per class. */
export function ScheduleReviewTable({ rows, onChange, demoMode = false }: ScheduleReviewTableProps) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const hasUncertainRows = useMemo(() => rows.some(rowHasUncertainFields), [rows]);

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
      {hasUncertainRows ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <p>Some fields look uncertain — review the highlighted ones before saving.</p>
        </div>
      ) : null}

      {rows.map((row) => {
        const rowErrors = errors.get(row.id);
        const subjectUncertain = isFieldUncertain(row, "subject");
        const startUncertain = isFieldUncertain(row, "startTime");
        const endUncertain = isFieldUncertain(row, "endTime");
        const roomUncertain = isFieldUncertain(row, "room");
        const instructorUncertain = isFieldUncertain(row, "instructor");
        const daysUncertain = isFieldUncertain(row, "days");

        return (
          <div
            key={row.id}
            className={cn(
              "rounded-2xl border bg-card p-4",
              row.needsReview ? "border-amber-500/30" : "border-border",
            )}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Class</span>
                {demoMode ? (
                  <span className="inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                    ⚠ Demo data
                  </span>
                ) : null}
                {row.needsReview ? (
                  <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-500/10">
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    Needs review
                  </Badge>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove class ${row.subject || "entry"}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setPendingDelete(row.id)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-12">
              <div className="md:col-span-4">
                <Label htmlFor={`${row.id}-subject`} className="text-xs text-muted-foreground">
                  Subject
                </Label>
                <UncertainFieldWrapper uncertain={subjectUncertain}>
                  <Input
                    id={`${row.id}-subject`}
                    value={row.subject}
                    placeholder="Not detected"
                    title={subjectUncertain ? UNCERTAIN_TOOLTIP : undefined}
                    aria-invalid={Boolean(rowErrors?.subject)}
                    onChange={(event) => update(row.id, { subject: event.target.value })}
                    className={cn("mt-1", subjectUncertain && uncertainInputClass)}
                  />
                </UncertainFieldWrapper>
                <FieldError>{rowErrors?.subject}</FieldError>
              </div>

              <div className="md:col-span-4">
                <Label htmlFor={`${row.id}-start`} className="text-xs text-muted-foreground">
                  Start time
                </Label>
                <UncertainFieldWrapper uncertain={startUncertain}>
                  <Input
                    id={`${row.id}-start`}
                    type="time"
                    step={300}
                    value={row.startTime}
                    title={startUncertain ? UNCERTAIN_TOOLTIP : undefined}
                    onChange={(event) => update(row.id, { startTime: event.target.value })}
                    className={cn("mt-1", startUncertain && uncertainInputClass)}
                  />
                </UncertainFieldWrapper>
              </div>

              <div className="md:col-span-4">
                <Label htmlFor={`${row.id}-end`} className="text-xs text-muted-foreground">
                  End time
                </Label>
                <UncertainFieldWrapper uncertain={endUncertain}>
                  <Input
                    id={`${row.id}-end`}
                    type="time"
                    step={300}
                    value={row.endTime}
                    title={endUncertain ? UNCERTAIN_TOOLTIP : undefined}
                    aria-invalid={Boolean(rowErrors?.endTime)}
                    onChange={(event) => update(row.id, { endTime: event.target.value })}
                    className={cn("mt-1", endUncertain && uncertainInputClass)}
                  />
                </UncertainFieldWrapper>
                <FieldError>{rowErrors?.endTime}</FieldError>
              </div>

              <div className="md:col-span-12">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Days
                  {daysUncertain ? (
                    <span
                      title={UNCERTAIN_TOOLTIP}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[11px] font-medium text-amber-800 dark:text-amber-200"
                    >
                      <AlertTriangle className="size-3" aria-hidden="true" />
                      AI unsure — please verify
                    </span>
                  ) : null}
                </span>
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
                            ? "border-indigo-600 bg-accent text-primary"
                            : "border-border bg-card text-muted-foreground hover:bg-muted",
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
                <Label htmlFor={`${row.id}-room`} className="text-xs text-muted-foreground">
                  Room
                </Label>
                <UncertainFieldWrapper uncertain={roomUncertain}>
                  <Input
                    id={`${row.id}-room`}
                    value={row.room}
                    placeholder="Not detected"
                    title={roomUncertain ? UNCERTAIN_TOOLTIP : undefined}
                    onChange={(event) => update(row.id, { room: event.target.value })}
                    className={cn("mt-1", roomUncertain && uncertainInputClass)}
                  />
                </UncertainFieldWrapper>
              </div>

              <div className="md:col-span-6">
                <Label htmlFor={`${row.id}-instructor`} className="text-xs text-muted-foreground">
                  Instructor
                </Label>
                <UncertainFieldWrapper uncertain={instructorUncertain}>
                  <Input
                    id={`${row.id}-instructor`}
                    value={row.instructor}
                    placeholder="Not detected"
                    title={instructorUncertain ? UNCERTAIN_TOOLTIP : undefined}
                    onChange={(event) => update(row.id, { instructor: event.target.value })}
                    className={cn("mt-1", instructorUncertain && uncertainInputClass)}
                  />
                </UncertainFieldWrapper>
              </div>

              <div className="md:col-span-12">
                <Label htmlFor={`${row.id}-notes`} className="text-xs text-muted-foreground">
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
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
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