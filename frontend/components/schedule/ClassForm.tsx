"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ENTRY_KINDS, KIND_FIELDS, KIND_META } from "@/lib/kind";
import { DAY_ORDER, dayLabel, dayOfWeekForDate, parseIsoDate, toMinutes, todayDayOfWeek } from "@/lib/time";
import { DAYS_OF_WEEK } from "@/types";
import type { DayOfWeek, EntryPayload, Schedule } from "@/types";
import { cn } from "cn";

const classSchema = z
  .object({
    scheduleId: z.string().min(1, "Choose a schedule."),
    /** What kind of event this is — class, work, personal or other. */
    kind: z.enum(ENTRY_KINDS),
    // Required, but the message depends on the kind ("subject" vs "title") —
    // checked in the superRefine below where values.kind is available.
    subject: z.string().trim(),
    day: z.enum(DAYS_OF_WEEK),
    /** "YYYY-MM-DD" — required when isOneOff is true. */
    date: z.string(),
    isOneOff: z.boolean(),
    startTime: z.string().min(1, "Choose a start time."),
    endTime: z.string().min(1, "Choose an end time."),
    instructor: z.string().trim(),
    room: z.string().trim(),
    notes: z.string().trim(),
    /**
     * Not rendered as a field: switching kind seeds this with the kind's
     * default color. Left empty otherwise so the backend keeps its own
     * palette choice. A real color picker (if one is ever added) writes the
     * same value last, so it wins.
     */
    color: z.string(),
  })
  .refine((values) => toMinutes(values.endTime) > toMinutes(values.startTime), {
    message: "End time must be after start time.",
    path: ["endTime"],
  })
  .refine((values) => !values.isOneOff || /^\d{4}-\d{2}-\d{2}$/.test(values.date), {
    message: "Pick the date for this one-time event.",
    path: ["date"],
  })
  .superRefine((values, ctx) => {
    if (!values.subject) {
      ctx.addIssue({
        code: "custom",
        path: ["subject"],
        message: `Enter a ${KIND_FIELDS[values.kind].subjectLabel.toLowerCase()}.`,
      });
    }
  });

export type ClassFormValues = z.infer<typeof classSchema>;

export type ClassFormDefaults = Partial<ClassFormValues>;

/**
 * Map validated form values to the backend entry payload. For one-off events
 * the weekday is derived from the picked date (the server does the same, so
 * the echoed entry always shows the right day).
 */
export function classFormToPayload(values: ClassFormValues): EntryPayload {
  const isOneOff = Boolean(values.isOneOff);
  const fields = KIND_FIELDS[values.kind];
  return {
    subject: values.subject,
    day: isOneOff ? dayOfWeekForDate(parseIsoDate(values.date)) : values.day,
    startTime: values.startTime,
    endTime: values.endTime,
    // Hidden fields are dropped so a Personal/Other entry never carries a
    // stale room/instructor picked earlier while the kind was different.
    instructor: fields.showInstructor ? values.instructor || undefined : undefined,
    room: fields.showRoom ? values.room || undefined : undefined,
    notes: values.notes || undefined,
    isOneOff,
    kind: values.kind,
    // Only set when the kind changed (or a color picker wrote it) — empty means
    // "leave the backend's palette choice alone".
    color: values.color?.trim() || undefined,
    ...(isOneOff ? { date: values.date } : {}),
  };
}

interface ClassFormProps {
  schedules: Schedule[];
  defaultValues?: ClassFormDefaults;
  submitLabel?: string;
  isPending?: boolean;
  /** Hidden in edit mode — the class can't move between schedules. */
  lockSchedule?: boolean;
  /**
   * When rendered inside a p-6 scrollable dialog, pin the action row to the
   * bottom of the scroll area so Cancel/Submit are always visible on phones.
   * (The -mx-6 bleed matches that p-6 wrapper — adjust if that changes.)
   */
  stickyActions?: boolean;
  onSubmit: (values: ClassFormValues) => void | Promise<void>;
  onCancel?: () => void;
}

const emptyValues: ClassFormDefaults = {
  scheduleId: "",
  kind: "class",
  subject: "",
  day: todayDayOfWeek(),
  date: "",
  isOneOff: false,
  startTime: "",
  endTime: "",
  instructor: "",
  room: "",
  notes: "",
  color: "",
};

/** Shared add/edit form, driven by react-hook-form and zod. */
export function ClassForm({
  schedules,
  defaultValues,
  submitLabel = "Save Changes",
  isPending = false,
  lockSchedule = false,
  stickyActions = false,
  onSubmit,
  onCancel,
}: ClassFormProps) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: { ...emptyValues, ...defaultValues },
  });

  const isOneOff = useWatch({ control, name: "isOneOff", defaultValue: false });
  const kind = useWatch({ control, name: "kind", defaultValue: "class" });
  // Per-kind field matrix — labels, placeholders and which optional fields render.
  const kindFields = KIND_FIELDS[kind];

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
      id="class-form"
    >
      {/* Event type — segmented radiogroup; changing it suggests the kind color. */}
      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-sm font-medium text-foreground">
              Event type
            </legend>
            <div
              role="radiogroup"
              aria-label="Event type"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {ENTRY_KINDS.map((kind) => {
                const meta = KIND_META[kind];
                const selected = field.value === kind;
                const Icon = meta.icon;
                return (
                  <label
                    key={kind}
                    className={cn(
                      "flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium transition-colors",
                      "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-background",
                      selected
                        ? "shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                    style={
                      selected
                        ? {
                            backgroundColor: `${meta.defaultColor}1A`,
                            borderColor: meta.defaultColor,
                            color: `color-mix(in srgb, ${meta.defaultColor} 78%, var(--foreground))`,
                          }
                        : undefined
                    }
                  >
                    <input
                      type="radio"
                      name="event-kind"
                      className="sr-only"
                      value={kind}
                      checked={selected}
                      onChange={() => {
                        field.onChange(kind);
                        // Suggest the kind's palette color; an explicit color
                        // picker (if one exists later) overwrites this.
                        setValue("color", meta.defaultColor);
                      }}
                    />
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>{meta.label}</span>
                  </label>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {KIND_META[field.value ?? "class"].description}
            </p>
          </fieldset>
        )}
      />

      {!lockSchedule ? (
        <div className="space-y-1.5">
          <Label htmlFor="scheduleId">Schedule</Label>
          <Controller
            control={control}
            name="scheduleId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="scheduleId" className="w-full" aria-invalid={Boolean(errors.scheduleId)}>
                  <SelectValue placeholder="Choose a schedule" />
                </SelectTrigger>
                <SelectContent>
                  {schedules.map((schedule) => (
                    <SelectItem key={schedule.id} value={schedule.id}>
                      {schedule.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.scheduleId ? (
            <p className="text-xs text-destructive">{errors.scheduleId.message}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="subject">{kindFields.subjectLabel}</Label>
        <Input
          id="subject"
          placeholder={kindFields.subjectPlaceholder}
          aria-invalid={Boolean(errors.subject)}
          {...register("subject")}
        />
        {errors.subject ? (
          <p className="text-xs text-destructive">{errors.subject.message}</p>
        ) : null}
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/60 p-3">
        <input
          id="isOneOff"
          type="checkbox"
          aria-describedby="isOneOff-hint"
          className="mt-0.5 size-4 shrink-0 accent-indigo-600"
          {...register("isOneOff")}
        />
        <div className="min-w-0">
          <Label htmlFor="isOneOff" className="cursor-pointer">
            One-time event
          </Label>
          <p id="isOneOff-hint" className="mt-0.5 text-xs text-muted-foreground">
            Happens once on a specific date (exam, deadline) instead of every week.
          </p>
        </div>
      </div>

      {isOneOff ? (
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            aria-invalid={Boolean(errors.date)}
            {...register("date")}
          />
          {errors.date ? (
            <p className="text-xs text-destructive">{errors.date.message}</p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="day">Day</Label>
          <Controller
            control={control}
            name="day"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(value: DayOfWeek) => field.onChange(value)}>
                <SelectTrigger id="day" className="w-full">
                  <SelectValue placeholder="Choose a day" />
                </SelectTrigger>
                <SelectContent>
                  {DAY_ORDER.map((day) => (
                    <SelectItem key={day} value={day}>
                      {dayLabel(day)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.day ? <p className="text-xs text-destructive">{errors.day.message}</p> : null}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startTime">Start time</Label>
          <Input
            id="startTime"
            type="time"
            step={300}
            aria-invalid={Boolean(errors.startTime)}
            {...register("startTime")}
          />
          {errors.startTime ? (
            <p className="text-xs text-destructive">{errors.startTime.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endTime">End time</Label>
          <Input
            id="endTime"
            type="time"
            step={300}
            aria-invalid={Boolean(errors.endTime)}
            {...register("endTime")}
          />
          {errors.endTime ? (
            <p className="text-xs text-destructive">{errors.endTime.message}</p>
          ) : null}
        </div>
      </div>

      {kindFields.showRoom || kindFields.showInstructor ? (
        <div
          className={cn(
            "grid gap-4",
            kindFields.showRoom && kindFields.showInstructor && "sm:grid-cols-2",
          )}
        >
          {kindFields.showRoom ? (
            <div className="space-y-1.5">
              <Label htmlFor="room">{kindFields.roomLabel}</Label>
              <Input
                id="room"
                placeholder={kindFields.roomPlaceholder}
                {...register("room")}
              />
            </div>
          ) : null}
          {kindFields.showInstructor ? (
            <div className="space-y-1.5">
              <Label htmlFor="instructor">{kindFields.instructorLabel}</Label>
              <Input
                id="instructor"
                placeholder={kindFields.instructorPlaceholder}
                {...register("instructor")}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={3}
          placeholder="Bring a calculator…"
          className="resize-none"
          {...register("notes")}
        />
      </div>

      <div
        className={cn(
          "flex justify-end gap-2",
          stickyActions
            ? // Pinned inside the dialog's scroll area: full-bleed to the
              // p-6 wrapper edges, opaque so entries slide underneath.
              "sticky bottom-0 z-10 -mx-6 -mt-4 border-t bg-popover px-6 py-4"
            : "pt-1",
        )}
      >
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}