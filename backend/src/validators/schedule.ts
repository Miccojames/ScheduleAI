import { z } from "zod";

// Academic-term window: "YYYY-MM-DD" (Zod v4's ISO calendar-date format —
// also rejects impossible dates like 2026-02-31). Stored as DateTime at
// midnight UTC; nullish means "clear" (null) / "leave unchanged" (absent).
const termDateSchema = z.iso.date({ error: "Date must be in YYYY-MM-DD format." }).nullish();

function checkTermOrder(
  value: { startDate?: string | null; endDate?: string | null },
  ctx: z.RefinementCtx
): void {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({
      code: "custom",
      message: "End date must be on or after the start date.",
      path: ["endDate"],
    });
  }
}

export const createScheduleSchema = z
  .object({
    name: z
      .string({ error: "Schedule name is required" })
      .trim()
      .min(1, "Schedule name is required")
      .max(80, "Schedule name must be at most 80 characters"),
    startDate: termDateSchema,
    endDate: termDateSchema,
  })
  .superRefine(checkTermOrder);

export const updateScheduleSchema = z
  .object({
    name: z
      .string({ error: "Schedule name is required" })
      .trim()
      .min(1, "Schedule name is required")
      .max(80, "Schedule name must be at most 80 characters"),
    startDate: termDateSchema,
    endDate: termDateSchema,
  })
  .superRefine(checkTermOrder);

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
