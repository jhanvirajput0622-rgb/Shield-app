import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError";

// ─── Augment Express Request ──────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      userId: mongoose.Types.ObjectId;
      userEmail: string;
    }
  }
}

interface JwtPayload {
  sub: string;   // MongoDB ObjectId as string
  email: string;
  iat: number;
  exp: number;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Missing or malformed Authorization header"));
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    // Programming error — should never happen in a running server
    return next(ApiError.internal("JWT_SECRET is not configured"));
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.userId = new mongoose.Types.ObjectId(payload.sub);
    req.userEmail = payload.email;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(ApiError.unauthorized("Token has expired"));
    }
    return next(ApiError.unauthorized("Invalid token"));
  }
}

// ─── Token generation helpers ─────────────────────────────────────────────────

export function signAccessToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.sign({ sub: userId, email }, secret, {
    expiresIn: (process.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]) ?? "7d",
  });
}

/**
 * @deprecated  Use signAccessToken instead.
 * Kept as an alias so any legacy call-sites still compile.
 */
export const signToken = signAccessToken;
