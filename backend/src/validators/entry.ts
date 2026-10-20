import { z } from "zod";

export const dayOfWeekSchema = z.enum(
  ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
  { error: "Day must be a valid weekday (MONDAY..SUNDAY)" }
);

// "HH:MM" 24-hour
export const timeSchema = z
  .string({ error: "Time is required" })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:MM 24-hour format (e.g. 08:30)");

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

// Event kind — a schedule is not class-only: entries may be classes as well
// as personal/work events. Missing → "class" (matches the DB default).
export const kindSchema = z.enum(["class", "work", "personal", "other"]).default("class");

// Recurring-class exceptions: ISO calendar dates on which the class does NOT
// meet (holidays, cancelled sessions). Max 100 keeps the column bounded.
export const exceptionDatesSchema = z
  .array(z.iso.date({ error: "Exception dates must be in YYYY-MM-DD format." }))
  .max(100, "At most 100 exception dates are allowed")
  .optional();

// One-off events (exams/deadlines): `date` carries the single calendar day and
// is REQUIRED when isOneOff is true; ignored (stored null) otherwise.
const oneOffSchema = z.object({
  isOneOff: z.boolean().optional(),
  date: z.iso.date({ error: "Date must be in YYYY-MM-DD format." }).optional().nullable(),
});

function requireDateForOneOff(
  value: { isOneOff?: boolean; date?: string | null },
  ctx: z.RefinementCtx
): void {
  if (value.isOneOff === true && !value.date) {
    ctx.addIssue({
      code: "custom",
      message: "Date is required when isOneOff is true.",
      path: ["date"],
    });
  }
}

export const entryBodySchema = z
  .object({
    subject: z
      .string({ error: "Subject is required" })
      .trim()
      .min(1, "Subject is required")
      .max(120, "Subject must be at most 120 characters"),
    day: dayOfWeekSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    instructor: z.string().trim().max(120).optional().nullable(),
    room: z.string().trim().max(80).optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
    kind: kindSchema,
    color: z
      .string()
      .trim()
      .regex(HEX_COLOR_RE, "Color must be a hex color like #6366F1")
      .optional(),
    exceptionDates: exceptionDatesSchema,
    isOneOff: oneOffSchema.shape.isOneOff,
    date: oneOffSchema.shape.date,
  })
  .refine((v) => v.startTime < v.endTime, {
    // Contract-specified message.
    message: "End time must be after start time.",
    path: ["endTime"],
  })
  .superRefine(requireDateForOneOff);

export const bulkEntrySchema = z.object({
  entries: z
    .array(
      z
        .object({
          subject: z
            .string({ error: "Subject is required" })
            .trim()
            .min(1, "Subject is required")
            .max(120, "Subject must be at most 120 characters"),
          days: z
            .array(dayOfWeekSchema)
            .min(1, "At least one day is required")
            .max(7, "At most 7 days allowed"),
          startTime: timeSchema,
          endTime: timeSchema,
          instructor: z.string().trim().max(120).optional().nullable(),
          room: z.string().trim().max(80).optional().nullable(),
          notes: z.string().trim().max(500).optional().nullable(),
          kind: kindSchema,
          color: z
            .string()
            .trim()
            .regex(HEX_COLOR_RE, "Color must be a hex color like #6366F1")
            .optional(),
          exceptionDates: exceptionDatesSchema,
          isOneOff: oneOffSchema.shape.isOneOff,
          date: oneOffSchema.shape.date,
        })
        .refine((v) => v.startTime < v.endTime, {
          message: "End time must be after start time.",
          path: ["endTime"],
        })
        .superRefine(requireDateForOneOff)
    )
    .min(1, "Provide at least one entry")
    .max(200, "A maximum of 200 entries can be saved at once"),
});

export type EntryBody = z.infer<typeof entryBodySchema>;
export type BulkEntryBody = z.infer<typeof bulkEntrySchema>;
