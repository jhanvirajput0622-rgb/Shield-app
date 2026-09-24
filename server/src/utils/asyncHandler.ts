import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async Express handler so any rejected promise is forwarded to
 * next(err) — no need for try/catch in every controller.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
