import type { Request, Response, NextFunction, RequestHandler } from "express";

// Wraps an async route handler so rejected promises reach the error middleware
// instead of hanging the request (Express 5 does this natively, but the wrapper
// keeps types tight and works identically if the framework changes).
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
