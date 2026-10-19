import type { Request, Response } from "express";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { param } from "../utils/params.js";
import * as scheduleService from "../services/schedule.service.js";
import type { BulkEntryBody, EntryBody } from "../validators/entry.js";

// Entry routes live under /api/schedules/:id/entries — the schedule id always
// comes from the parent path and is scoped to req.user.id inside the service.

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { entries, conflicts } = await scheduleService.listEntries(param(req, "id"), req.user!.id);
  sendSuccess(res, { data: { entries, conflicts } });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as EntryBody;
  const result = await scheduleService.createEntry(param(req, "id"), req.user!.id, body);
  sendSuccess(res, { data: result, message: "Entry added.", status: 201 });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as EntryBody;
  const result = await scheduleService.updateEntry(
    param(req, "id"),
    param(req, "entryId"),
    req.user!.id,
    body
  );
  sendSuccess(res, { data: result, message: "Entry updated." });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await scheduleService.deleteEntry(param(req, "id"), param(req, "entryId"), req.user!.id);
  sendSuccess(res, { data: null, message: "Entry deleted." });
});

export const bulk = asyncHandler(async (req: Request, res: Response) => {
  const { entries } = req.body as BulkEntryBody;
  const result = await scheduleService.bulkCreateEntries(param(req, "id"), req.user!.id, entries);
  sendSuccess(res, {
    data: result,
    message: `${result.saved} entries saved${result.skipped > 0 ? `, ${result.skipped} duplicates skipped` : ""}.`,
  });
});
