import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";

import { logger } from "./utils/logger";
import { requestLogger } from "./middleware/requestLogger.middleware";
import { generalLimiter } from "./middleware/rateLimiter.middleware";
import { errorHandler } from "./middleware/errorHandler.middleware";
import { ApiError } from "./utils/ApiError";
import { connectFirestore, getFirestoreStatus } from "./config/firestore";

// ── Route imports ─────────────────────────────────────────────────────────────
import authRoutes from "./routes/auth.routes";
import devicesRoutes from "./routes/devices.routes";
import usersRoutes from "./routes/users.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import permissionsRoutes from "./routes/permissions.routes";
import networkRoutes from "./routes/network.routes";
import phishingRoutes from "./routes/phishing.routes";
import antitheftRoutes from "./routes/antitheft.routes";
import settingsRoutes from "./routes/settings.routes";
import securityRoutes from "./routes/security.routes";
import vpnRoutes from "./routes/vpn.routes";
import wifiRoutes from "./routes/wifi.routes";
import theftRoutes from "./routes/theft.routes";
// ── New spec-required routes ──────────────────────────────────────────────────
import userKeysRoutes from "./routes/userKeys.routes";
import threatsRoutes from "./routes/threats.routes";
import notificationsRoutes from "./routes/notifications.routes";
import auditLogsRoutes from "./routes/auditLogs.routes";
import companionAccountsRoutes from "./routes/companionAccounts.routes";
import userSettingsRoutes from "./routes/userSettings.routes";
import vpnSessionsRoutes from "./routes/vpnSessions.routes";
import webChecksRoutes from "./routes/webChecks.routes";
import installedAppsRoutes from "./routes/installedApps.routes";
import appPermissionsRoutes from "./routes/appPermissions.routes";

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exported so the E2E suite can mount the real application on an ephemeral port
 * (see test/helpers/app.ts) instead of testing a re-assembled copy of these
 * routes. Nothing about the middleware order below changes based on who imports
 * it -- `app` is fully configured by the time this module finishes evaluating.
 */
export const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (native mobile, Postman, curl)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.length === 0 ||
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Body parsing & compression ────────────────────────────────────────────────
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));
app.use(compression() as express.RequestHandler);

// ── Request logging ───────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Rate limiting (general) ───────────────────────────────────────────────────
app.use("/api", generalLimiter);

// ── Health checks (unauthenticated) ──────────────────────────────────────────

// Lightweight liveness probe
app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Full health check including Firestore connectivity — spec: GET /api/health
app.get("/api/health", (_req: Request, res: Response) => {
  const firestoreStatus = getFirestoreStatus();
  const firestoreConnected = firestoreStatus === "connected";

  res.status(firestoreConnected ? 200 : 503).json({
    success: firestoreConnected,
    service: "Shield API",
    database: "Firestore",
    databaseStatus: firestoreStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "1.0.0",
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Auth  (public endpoints + their own rate limiter)
app.use("/api/auth", authRoutes);

// Users profile + account management
app.use("/api/users", usersRoutes);

// Devices CRUD
app.use("/api/devices", devicesRoutes);

// Shield modules (all protected inside each router)
app.use("/api/shield", dashboardRoutes);
app.use("/api/shield/permissions", permissionsRoutes);
app.use("/api/shield/network", networkRoutes);
app.use("/api/shield/phishing", phishingRoutes);
app.use("/api/shield/device", antitheftRoutes);
app.use("/api/shield/settings", settingsRoutes);

// Spec-required top-level routes
app.use("/api/security", securityRoutes);
app.use("/api/vpn", vpnRoutes);
app.use("/api/wifi", wifiRoutes);
app.use("/api/theft", theftRoutes);

// /api/permissions/* — spec-required, shares the same controller as shield/permissions
app.use("/api/permissions", permissionsRoutes);

// ── Spec-required new routes ──────────────────────────────────────────────────
app.use("/api/user-keys", userKeysRoutes);
app.use("/api/threats", threatsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/audit-logs", auditLogsRoutes);
app.use("/api/companion-accounts", companionAccountsRoutes);
app.use("/api/user-settings", userSettingsRoutes);
app.use("/api/vpn-sessions", vpnSessionsRoutes);
app.use("/api/web-checks", webChecksRoutes);
app.use("/api/installed-apps", installedAppsRoutes);
app.use("/api/app-permissions", appPermissionsRoutes);

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(ApiError.notFound("Route"));
});

// ── Central error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
//  Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3001);

async function start(): Promise<void> {
  // Start listening FIRST so liveness/health endpoints are always reachable,
  // even while Firestore is warming up or temporarily unreachable. This is what
  // lets the mobile app degrade gracefully ("Database unavailable — showing
  // cached data") instead of failing with "Unable to connect to Shield API".
  const server = app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Shield API listening on http://0.0.0.0:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV ?? "development"}`);
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal} — shutting down gracefully`);
    server.close(async () => {
      logger.info("Server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason: unknown) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    logger.error(`Unhandled rejection: ${msg}`);
  });

  process.on("uncaughtException", (err: Error) => {
    logger.error(`Uncaught exception: ${err.message}`, { stack: err.stack });
    process.exit(1);
  });

  void connectFirestore().catch((err: Error) => {
    logger.warn(`Firestore connection failed: ${err.message}`);
  });
}

/**
 * Only bind a port when executed directly (`node dist/server.js`). When the
 * module is imported -- as the E2E suite does -- the caller owns the lifecycle
 * and binds its own ephemeral port via `test/helpers/app.ts`.
 *
 * `require.main === module` is false under `ts-node-dev`/`nodemon` re-exec in
 * some setups, so the module-path comparison is kept as a fallback.
 */
const isEntryPoint =
  require.main === module ||
  process.argv[1] === __filename ||
  (process.argv[1] ?? "").replace(/\\/g, "/").endsWith("/server.js");

if (isEntryPoint) {
  void start();
}

export { start };
