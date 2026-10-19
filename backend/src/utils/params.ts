import type { Request } from "express";

/**
 * Express 5 types route params as `string | string[]` (a path segment can
 * match a wildcard). Our routes never define array params, so a non-empty
 * string is guaranteed at runtime; this helper narrows the type safely.
 */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing route parameter: ${name}`);
  }
  return value;
}
