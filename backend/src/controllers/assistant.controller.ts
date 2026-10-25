import type { Request, Response } from "express";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as assistantService from "../services/assistant.service.js";
import type { ChatBody } from "../validators/assistant.js";

// All routes sit behind requireAuth (see the router) — every handler is
// scoped to the SESSION user, never to anything the model sends.

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const { message } = req.body as ChatBody;
  const outcome = await assistantService.chat(req.user!.id, message);
  sendSuccess(res, { data: outcome });
});

export const messages = asyncHandler(async (req: Request, res: Response) => {
  const list = await assistantService.listMessages(req.user!.id);
  sendSuccess(res, { data: { messages: list } });
});

export const clear = asyncHandler(async (req: Request, res: Response) => {
  await assistantService.clearMessages(req.user!.id);
  sendSuccess(res, { data: null, message: "Chat cleared." });
});
