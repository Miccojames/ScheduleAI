import type { Request, Response } from "express";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { param } from "../utils/params.js";
import * as scheduleService from "../services/schedule.service.js";
import type { CreateScheduleInput, UpdateScheduleInput } from "../validators/schedule.js";

// All handlers trust the id from params ONLY after schedule.service filters it
// together with req.user.id (foreign resources behave like missing ones → 404).

export const list = asyncHandler(async (req: Request, res: Response) => {
  const schedules = await scheduleService.listSchedules(req.user!.id);
  sendSuccess(res, { data: { schedules } });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body as CreateScheduleInput;
  const schedule = await scheduleService.createSchedule(req.user!.id, name);
  sendSuccess(res, { data: { schedule }, message: "Schedule created.", status: 201 });
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const schedule = await scheduleService.getSchedule(param(req, "id"), req.user!.id);
  sendSuccess(res, { data: { schedule } });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body as UpdateScheduleInput;
  const schedule = await scheduleService.updateSchedule(param(req, "id"), req.user!.id, name);
  sendSuccess(res, { data: { schedule }, message: "Schedule updated." });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await scheduleService.deleteSchedule(param(req, "id"), req.user!.id);
  sendSuccess(res, { data: null, message: "Schedule deleted." });
});
