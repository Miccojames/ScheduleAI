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
    color: z
      .string()
      .trim()
      .regex(HEX_COLOR_RE, "Color must be a hex color like #6366F1")
      .optional(),
  })
  .refine((v) => v.startTime < v.endTime, {
    // Contract-specified message.
    message: "End time must be after start time.",
    path: ["endTime"],
  });

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
          color: z
            .string()
            .trim()
            .regex(HEX_COLOR_RE, "Color must be a hex color like #6366F1")
            .optional(),
        })
        .refine((v) => v.startTime < v.endTime, {
          message: "End time must be after start time.",
          path: ["endTime"],
        })
    )
    .min(1, "Provide at least one entry")
    .max(200, "A maximum of 200 entries can be saved at once"),
});

export type EntryBody = z.infer<typeof entryBodySchema>;
export type BulkEntryBody = z.infer<typeof bulkEntrySchema>;
