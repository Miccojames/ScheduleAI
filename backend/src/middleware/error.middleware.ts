import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { sendError } from "../utils/apiResponse.js";
import { isProduction } from "../config/env.js";

// Fallback 404 for unknown API routes (mounted after all routers).
export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, { status: 404, message: `Route not found: ${req.method} ${req.path}` });
}

/**
 * Central error handler. Everything thrown/rejected in a handler lands here:
 *  - AppError subclasses carry their own status + client-safe message
 *  - Multer errors are mapped (LIMIT_FILE_SIZE → 413, unsupported → 415)
 *  - Prisma known errors are mapped (P2002 unique → 409, P2025 missing → 404)
 *  - Everything else → 500 generic; full details logged server-side only.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  // Never leak stacks to clients in production.
  if (!isProduction) {
    // eslint-disable-next-line no-console
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  } else {
    // eslint-disable-next-line no-console
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err instanceof Error ? err.message : err);
  }

  if (err instanceof AppError) {
    sendError(res, {
      status: err.status,
      message: err.message,
      errors: err.errors,
      code: err.code,
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      sendError(res, { status: 413, message: "File is too large. The maximum size is 4MB." });
      return;
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      sendError(res, { status: 400, message: 'Send the image in a form field named "image".' });
      return;
    }
    sendError(res, { status: 400, message: "Invalid upload." });
    return;
  }

  // Multer fileFilter rejection (we attach code UNSUPPORTED_MEDIA_TYPE).
  if (
    err instanceof Error &&
    "code" in err &&
    (err as Error & { code?: string }).code === "UNSUPPORTED_MEDIA_TYPE"
  ) {
    sendError(res, {
      status: 415,
      message: "Unsupported file type. Please upload a JPEG, PNG, or WebP image.",
    });
    return;
  }

  // Body-parser JSON syntax error (malformed request body) → 400, not 500.
  if (
    err instanceof SyntaxError &&
    "type" in err &&
    (err as SyntaxError & { type?: string }).type === "entity.parse.failed"
  ) {
    sendError(res, { status: 400, message: "Request body is not valid JSON." });
    return;
  }

  // Body-parser payload-too-large (non-file JSON body). body-parser throws a
  // http-errors PayloadTooLargeError (not a SyntaxError), so match on .type.
  if (
    err instanceof Error &&
    "type" in err &&
    (err as Error & { type?: string }).type === "entity.too.large"
  ) {
    sendError(res, { status: 413, message: "Request body is too large." });
    return;
  }

  if (err instanceof ZodError) {
    // Should be handled by validate.middleware, but keep a safe fallback.
    sendError(res, { status: 400, message: "Invalid request data." });
    return;
  }

  // Prisma known error codes (duck-typed to avoid importing the whole client).
  const prismaCode = (err as { code?: string } | null)?.code;
  if (prismaCode === "P2002") {
    sendError(res, { status: 409, message: "That value is already taken." });
    return;
  }
  if (prismaCode === "P2025") {
    sendError(res, { status: 404, message: "Resource not found." });
    return;
  }

  sendError(res, { status: 500, message: "Something went wrong. Please try again." });
}
