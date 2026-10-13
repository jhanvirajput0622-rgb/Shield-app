import morgan from "morgan";
import { logger } from "../utils/logger";
import { Request } from "express";

// Stream morgan output into Winston
const stream = {
  write: (message: string) => {
    // Strip trailing newline
    logger.http(message.trim());
  },
};

// Skip health-check noise
const skip = (req: Request): boolean =>
  req.path === "/healthz" || req.path === "/health";

// In prod: log method + url + status + response-time only (no bodies)
// In dev: same but colourised through winston
const format =
  process.env.NODE_ENV === "production"
    ? ':remote-addr ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms'
    : ":method :url :status :response-time ms";

export const requestLogger = morgan(format, { stream, skip });
