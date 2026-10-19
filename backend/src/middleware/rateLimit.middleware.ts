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
export const uploadLimiter = rateLimit(options(20, 60 * 60 * 1000));
