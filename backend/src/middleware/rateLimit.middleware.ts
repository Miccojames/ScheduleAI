import rateLimit from "express-rate-limit";
import { isTest } from "../config/env.js";

// Standard headers everywhere; skip entirely under NODE_ENV=test so the smoke
// suite can hammer endpoints without tripping 429s.
const options = (max: number, windowMs: number) => ({
  windowMs,
  max: isTest ? Number.MAX_SAFE_INTEGER : max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});

export const globalLimiter = rateLimit(options(300, 15 * 60 * 1000));
export const authLimiter = rateLimit(options(30, 15 * 60 * 1000));
// Email-code verification: its own budget (the 5-guess code wipe does the
// heavy lifting; this just stops one IP from hammering the endpoint), kept
// off the shared auth pool so verifying never blocks someone's sign-ins.
export const verifyLimiter = rateLimit(options(60, 15 * 60 * 1000));
export const uploadLimiter = rateLimit(options(20, 60 * 60 * 1000));
// Assistant chat: its own small per-IP budget. Each message can burn several
// upstream Gemini calls (bounded tool loop), and the free tier only allows
// ~20 generateContent requests per 15 minutes — this keeps one user from
// eating the whole quota, and stays off every other limiter pool.
export const assistantLimiter = rateLimit(options(20, 15 * 60 * 1000));
