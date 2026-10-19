import type { Request, Response, NextFunction } from "express";
import { env, isTest } from "../config/env.js";
import { sendError } from "../utils/apiResponse.js";

/**
 * CSRF defense layer #2 (on top of SameSite cookies): state-changing requests
 * (POST/PUT/DELETE) that carry an Origin header must match FRONTEND_URL exactly.
 * Requests without an Origin header (curl, same-origin navigations, some
 * non-browser clients) pass through — the cookie's SameSite policy is the
 * primary protection there.
 */
export function originCheck(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "OPTIONS") {
    next();
    return;
  }
  const stateChanging = req.method === "POST" || req.method === "PUT" || req.method === "DELETE";
  if (!stateChanging || isTest) {
    next();
    return;
  }
  const origin = req.headers.origin;
  if (origin && origin !== env.FRONTEND_URL) {
    sendError(res, { status: 403, message: "Cross-origin requests are not allowed." });
    return;
  }
  next();
}
