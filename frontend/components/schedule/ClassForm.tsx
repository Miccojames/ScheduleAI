"use client";

import { Controller, useForm } from "react-hook-form";
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
import { DAY_ORDER, dayLabel, toMinutes, todayDayOfWeek } from "@/lib/time";
import { DAYS_OF_WEEK } from "@/types";
import type { DayOfWeek, Schedule } from "@/types";

const classSchema = z
  .object({
    scheduleId: z.string().min(1, "Choose a schedule."),
    subject: z.string().trim().min(1, "Enter a subject."),
    day: z.enum(DAYS_OF_WEEK),
    startTime: z.string().min(1, "Choose a start time."),
    endTime: z.string().min(1, "Choose an end time."),
    instructor: z.string().trim(),
    room: z.string().trim(),
    notes: z.string().trim(),
  })
  .refine((values) => toMinutes(values.endTime) > toMinutes(values.startTime), {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

export type ClassFormValues = z.infer<typeof classSchema>;

export type ClassFormDefaults = Partial<ClassFormValues>;

interface ClassFormProps {
  schedules: Schedule[];
  defaultValues?: ClassFormDefaults;
  submitLabel?: string;
  isPending?: boolean;
  /** Hidden in edit mode — the class can't move between schedules. */
  lockSchedule?: boolean;
  onSubmit: (values: ClassFormValues) => void | Promise<void>;
  onCancel?: () => void;
}

const emptyValues: ClassFormDefaults = {
  scheduleId: "",
  subject: "",
  day: todayDayOfWeek(),
  startTime: "",
  endTime: "",
  instructor: "",
  room: "",
  notes: "",
};

/** Shared add/edit form, driven by react-hook-form and zod. */
export function ClassForm({
  schedules,
  defaultValues,
  submitLabel = "Save Changes",
  isPending = false,
  lockSchedule = false,
  onSubmit,
  onCancel,
}: ClassFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: { ...emptyValues, ...defaultValues },
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
      id="class-form"
    >
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
            <p className="text-xs text-rose-600">{errors.scheduleId.message}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          placeholder="Database Systems"
          aria-invalid={Boolean(errors.subject)}
          {...register("subject")}
        />
        {errors.subject ? (
          <p className="text-xs text-rose-600">{errors.subject.message}</p>
        ) : null}
      </div>

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
        {errors.day ? <p className="text-xs text-rose-600">{errors.day.message}</p> : null}
      </div>

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
            <p className="text-xs text-rose-600">{errors.startTime.message}</p>
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
            <p className="text-xs text-rose-600">{errors.endTime.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="room">Room</Label>
          <Input id="room" placeholder="Room 402" {...register("room")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="instructor">Instructor</Label>
          <Input id="instructor" placeholder="Prof. Santos" {...register("instructor")} />
        </div>
      </div>

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

      <div className="flex justify-end gap-2 pt-1">
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