import type { Response } from "express";

interface SuccessOptions {
  data: unknown;
  message?: string;
  status?: number;
}

interface ErrorOptions {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
}

// The contract's response shapes — keep these in ONE place so every
// controller emits exactly the same envelope.
export function sendSuccess(res: Response, { data, message, status = 200 }: SuccessOptions): void {
  res.status(status).json({
    success: true,
    data,
    ...(message ? { message } : {}),
  });
}

export function sendError(res: Response, { status, message, errors }: ErrorOptions): void {
  res.status(status).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });
}
