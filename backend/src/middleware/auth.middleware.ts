import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { sendError } from "../utils/apiResponse.js";

export const AUTH_COOKIE = "scheduleai_token";

export interface JwtPayload {
  sub: string;
}

export function signToken(userId: string): string {
  // 7-day expiry, minimal payload ({ sub }) — no personal data in the token.
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "7d" });
}

/**
 * requireAuth: the ONLY credential source is the httpOnly cookie.
 * We never accept tokens from Authorization headers or the query string.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) {
    sendError(res, { status: 401, message: "You must be logged in to do that." });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (!decoded?.sub) throw new Error("missing sub");

    // Verify the user still exists (cheap primary-key lookup) — covers
    // accounts deleted after the token was issued.
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true },
    });
    if (!user) throw new Error("user not found");

    req.user = { id: user.id };
    next();
  } catch {
    sendError(res, { status: 401, message: "Your session has expired. Please log in again." });
  }
}
