import type { Request, Response } from "express";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { param } from "../utils/params.js";
import * as scheduleService from "../services/schedule.service.js";
import { buildIcs, icsFilename } from "../utils/ics.js";
import type { CreateScheduleInput, UpdateScheduleInput } from "../validators/schedule.js";

// All handlers trust the id from params ONLY after schedule.service filters it
// together with req.user.id (foreign resources behave like missing ones → 404).

export const list = asyncHandler(async (req: Request, res: Response) => {
  const schedules = await scheduleService.listSchedules(req.user!.id);
  sendSuccess(res, { data: { schedules } });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateScheduleInput;
  const schedule = await scheduleService.createSchedule(req.user!.id, input);
  sendSuccess(res, { data: { schedule }, message: "Schedule created.", status: 201 });
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const schedule = await scheduleService.getSchedule(param(req, "id"), req.user!.id);
  sendSuccess(res, { data: { schedule } });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as UpdateScheduleInput;
  const schedule = await scheduleService.updateSchedule(param(req, "id"), req.user!.id, input);
  sendSuccess(res, { data: { schedule }, message: "Schedule updated." });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await scheduleService.deleteSchedule(param(req, "id"), req.user!.id);
  sendSuccess(res, { data: null, message: "Schedule deleted." });
});

// GET /api/schedules/:id/ics — RFC 5545 export. Raw body (no JSON envelope):
// calendars are consumed by external clients, not the SPA.
export const ics = asyncHandler(async (req: Request, res: Response) => {
  const scheduleId = param(req, "id");
  // getSchedule 404s for schedules owned by another user (no existence leak).
  const schedule = await scheduleService.getSchedule(scheduleId, req.user!.id);
  const { entries } = await scheduleService.listEntries(scheduleId, req.user!.id);

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${icsFilename(schedule.name)}.ics"`);
  res.status(200).send(buildIcs(schedule, entries));
});
