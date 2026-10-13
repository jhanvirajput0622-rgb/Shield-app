export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Unauthorized"): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = "Forbidden"): ApiError {
    return new ApiError(403, message);
  }

  static notFound(resource: string): ApiError {
    return new ApiError(404, `${resource} not found`);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, message);
  }

  static tooManyRequests(message = "Too many requests"): ApiError {
    return new ApiError(429, message);
  }

  /**
   * 501 — the server is up but the capability is switched off or not enabled on
   * the backing service. Distinct from `internal` (500) because it is a
   * configuration state the caller can act on, not a fault: clients use it to
   * decide whether to fall back. See `services/firebaseAuth.service.ts`.
   */
  static notImplemented(message = "Not implemented"): ApiError {
    return new ApiError(501, message);
  }

  static internal(message = "Internal server error"): ApiError {
    return new ApiError(500, message, undefined, false);
  }
}
