import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // ── Zod validation error ────────────────────────────────────────────────────
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));

    const body: ErrorResponse = {
      success: false,
      error: { message: "Validation failed", code: "VALIDATION_ERROR", details },
    };
    res.status(400).json(body);
    return;
  }

  // ── Operational API error ───────────────────────────────────────────────────
  if (err instanceof ApiError) {
    if (!err.isOperational) {
      logger.error(`Unhandled ApiError: ${err.message}`, { stack: err.stack });
    }

    const body: ErrorResponse = {
      success: false,
      error: {
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // ── Firestore conflict/error handling ───────────────────────────────────────
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === 11000
  ) {
    const body: ErrorResponse = {
      success: false,
      error: { message: "A record with that value already exists", code: "DUPLICATE_KEY" },
    };
    res.status(409).json(body);
    return;
  }

  // ── Unknown / programming error ─────────────────────────────────────────────
  const message =
    err instanceof Error ? err.message : "An unexpected error occurred";
  logger.error(`Unhandled error on ${req.method} ${req.path}: ${message}`, {
    stack: err instanceof Error ? err.stack : undefined,
  });

  const body: ErrorResponse = {
    success: false,
    error: { message: "Internal server error" },
  };
  res.status(500).json(body);
}
