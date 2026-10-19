import { z } from "zod";

export const createScheduleSchema = z.object({
  name: z
    .string({ error: "Schedule name is required" })
    .trim()
    .min(1, "Schedule name is required")
    .max(80, "Schedule name must be at most 80 characters"),
});

export const updateScheduleSchema = z.object({
  name: z
    .string({ error: "Schedule name is required" })
    .trim()
    .min(1, "Schedule name is required")
    .max(80, "Schedule name must be at most 80 characters"),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
