import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import { sendError } from "../utils/apiResponse.js";
import { isProduction } from "../config/env.js";

/**
 * validate: parse req.body with a Zod v4 schema. On failure return 400 with the
 * contract's errors map: { "<field>": ["msg", ...] }.
 */
export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.length > 0 ? issue.path.join(".") : "_";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      // In production never leak Zod internals — the messages above are our own
      // user-facing strings, but the fallback keeps the envelope safe regardless.
      const message = isProduction ? "Invalid request data." : "Please fix the highlighted fields.";
      sendError(res, { status: 400, message, errors: fieldErrors });
      return;
    }
    // Replace body with the parsed (and coerced/trimmed) value.
    req.body = result.data;
    next();
  };
}
