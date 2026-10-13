import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/ApiError";

const windowMs =
  Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 min

/** General API rate limiter — applies to all routes */
export const generalLimiter = rateLimit({
  windowMs,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler(_req, _res, next) {
    next(ApiError.tooManyRequests("Too many requests, please slow down"));
  },
});

/** Tighter limiter for auth endpoints (login / register) */
export const authLimiter = rateLimit({
  windowMs,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler(_req, _res, next) {
    next(
      ApiError.tooManyRequests(
        "Too many authentication attempts, please try again later"
      )
    );
  },
});

/** Extra-tight limiter for destructive actions (wipe, lock) */
export const destructiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler(_req, _res, next) {
    next(
      ApiError.tooManyRequests(
        "Too many destructive command attempts. Try again in 1 hour."
      )
    );
  },
});
