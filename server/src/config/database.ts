import mongoose from "mongoose";
import { logger } from "../utils/logger";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5_000;
const RESCHEDULE_DELAY_MS = 15_000;

// ─── Connection state emitter ─────────────────────────────────────────────────
// Other parts of the app (health endpoint, etc.) can read this without
// importing mongoose directly.

export type DbStatus = "connected" | "disconnected" | "connecting" | "error";

let _dbStatus: DbStatus = "disconnected";
let _dbError: string | null = null;
let _listenersRegistered = false;

export function getDbStatus(): DbStatus {
  return _dbStatus;
}

export function getDbError(): string | null {
  return _dbError;
}

// ── Event listeners (registered once) ────────────────────────────────────────

function registerConnectionListeners(): void {
  if (_listenersRegistered) return;
  _listenersRegistered = true;

  mongoose.connection.on("connected", () => {
    _dbStatus = "connected";
    _dbError = null;
    logger.info(`✅ MongoDB connected — database: "${mongoose.connection.name}"`);
  });

  mongoose.connection.on("connecting", () => {
    _dbStatus = "connecting";
    logger.info("MongoDB connecting…");
  });

  mongoose.connection.on("disconnected", () => {
    _dbStatus = "disconnected";
    logger.warn("⚠️  MongoDB disconnected — will attempt to reconnect");
    // Mongoose's built-in reconnect handles Atlas; log it so the operator sees it
  });

  mongoose.connection.on("reconnected", () => {
    _dbStatus = "connected";
    _dbError = null;
    logger.info("✅ MongoDB reconnected");
  });

  mongoose.connection.on("error", (err: Error) => {
    _dbStatus = "error";
    // Log only the message — never the full URI (contains credentials)
    _dbError = err.message;
    logger.error(`❌ MongoDB error: ${err.message}`);
  });
}

// ─── Connect ──────────────────────────────────────────────────────────────────

export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    const msg = "MONGODB_URI is not set. Check your .env file.";
    logger.error(msg);
    throw new Error(msg);
  }

  mongoose.set("strictQuery", true);
  registerConnectionListeners();

  // ── Retry loop (initial connection only) ─────────────────────────────────

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      _dbStatus = "connecting";
      logger.info(`MongoDB connection attempt ${attempt}/${MAX_RETRIES}…`);

      await mongoose.connect(uri, {
        dbName: process.env.MONGODB_DATABASE_NAME ?? "shield",
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
        connectTimeoutMS: 10_000,
        maxPoolSize: 10,
        minPoolSize: 2,
        // Mongoose 8 handles reconnect automatically
        heartbeatFrequencyMS: 10_000,
      });

      return; // ✅ connected
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      _dbStatus = "error";
      _dbError = message;
      logger.warn(`MongoDB attempt ${attempt}/${MAX_RETRIES} failed: ${message}`);

      if (attempt < MAX_RETRIES) {
        logger.info(`Retrying in ${RETRY_DELAY_MS / 1000}s…`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  const finalMsg = `❌ Failed to connect to MongoDB after ${MAX_RETRIES} attempts. Check MONGODB_URI and network access rules on Atlas.`;
  logger.error(finalMsg);
  throw new Error(finalMsg);
}

/**
 * Non-blocking reconnect used when the initial connection fails.
 * Keeps retrying in the background so the API recovers the moment MongoDB
 * becomes reachable again, without ever taking the HTTP listener down.
 */
export function reconnectInBackground(): void {
  const tryConnect = async (): Promise<void> => {
    try {
      await connectDatabase();
      logger.info("✅ MongoDB connection established (background reconnect)");
    } catch {
      logger.warn(
        `⏳ MongoDB still unreachable — retrying in ${RESCHEDULE_DELAY_MS / 1000}s…`
      );
      setTimeout(tryConnect, RESCHEDULE_DELAY_MS);
    }
  };

  void tryConnect();
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  _dbStatus = "disconnected";
  logger.info("MongoDB disconnected cleanly");
}
