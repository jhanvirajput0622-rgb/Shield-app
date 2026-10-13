import winston from "winston";

const { combine, timestamp, colorize, printf, json, errors } = winston.format;

const isProd = process.env.NODE_ENV === "production";

// ── Human-readable format for development ────────────────────────────────────
const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack }) => {
    return stack
      ? `${ts} [${level}] ${message}\n${stack}`
      : `${ts} [${level}] ${message}`;
  })
);

// ── Structured JSON for production (never includes req body or auth tokens) ──
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
  format: isProd ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
});
