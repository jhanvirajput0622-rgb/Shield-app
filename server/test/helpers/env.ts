/**
 * Test environment bootstrap.
 *
 * This module MUST be the first import in every test file. It is responsible for
 * two things, in this order:
 *
 *   1. Refuse to run unless we are pointed at a Firestore emulator. The real
 *      project (`shield-419e1`) holds live user data, and a test that escapes
 *      the emulator would delete it. `deleteMany` / `deleteWhere` are exercised
 *      by the suite, so this guard is the only thing standing between the tests
 *      and production. It throws rather than warns.
 *
 *   2. Seed deterministic secrets. Several modules read `process.env` at import
 *      time (see middleware/rateLimiter.middleware.ts), so these have to be set
 *      before any `src/` import is evaluated. Importing this module first
 *      guarantees that ordering, because TypeScript preserves import order
 *      when emitting CommonJS.
 *
 * Every value here is a throwaway. None of these secrets are used anywhere
 * outside the test process.
 */

import { randomBytes } from "node:crypto";

/** The only project id the suite is permitted to touch. */
const SAFE_PROJECT_ID = "demo-shield";

/** Deterministic secrets keep JWTs stable enough to assert on across runs. */
const DETERMINISTIC_HEX = (bytes: number): string => randomBytes(bytes).toString("hex").padEnd(bytes * 2, "0");

function assertEmulator(): void {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT;

  if (!host) {
    throw new Error(
      [
        "",
        "  FIRESTORE_EMULATOR_HOST is not set. Refusing to run.",
        "",
        "  The E2E suite issues deletes (deleteMany, deleteWhere, truncate helpers)",
        "  and MUST only ever run against the local Firestore emulator. Starting it",
        "  yourself and pointing this variable at it is the supported path:",
        "",
        "    npm run test:e2e            # boots the emulator for you",
        "",
        "  If you are deliberately running against a throwaway project instead, set:",
        `    FIRESTORE_EMULATOR_HOST=... FIREBASE_PROJECT_ID=${SAFE_PROJECT_ID}`,
        "",
      ].join("\n")
    );
  }

  if (projectId && projectId !== SAFE_PROJECT_ID) {
    throw new Error(
      [
        "",
        `  FIREBASE_PROJECT_ID is "${projectId}" but the suite only permits "${SAFE_PROJECT_ID}".`,
        "",
        "  A non-emulator project id alongside FIRESTORE_EMULATOR_HOST usually means",
        "  the emulator is NOT actually running and the Admin SDK would fall back to",
        "  the real backend. Refusing to run.",
        "",
      ].join("\n")
    );
  }
}

assertEmulator();

process.env.NODE_ENV = "test";
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST!;
process.env.FIREBASE_PROJECT_ID = SAFE_PROJECT_ID;
process.env.GOOGLE_CLOUD_PROJECT = SAFE_PROJECT_ID;

// The emulator needs a projectId but no credentials. config/firestore.ts falls
// back to "demo-shield" for exactly this case.
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

process.env.JWT_SECRET = DETERMINISTIC_HEX(64);
process.env.JWT_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "30d";

// user.service.ts requires OTP_HASH_SECRET to be at least 32 chars.
process.env.OTP_HASH_SECRET = DETERMINISTIC_HEX(32);

// audit.service.ts encrypts details with AES-256-GCM keyed by ENCRYPTION_KEY,
// which must be 64 hex chars.
process.env.ENCRYPTION_KEY = DETERMINISTIC_HEX(32);

process.env.CORS_ORIGINS = "*";

// Rate limiters capture their window at import time. The suite makes far more
// than AUTH_RATE_LIMIT_MAX (20) auth calls, so lift the ceiling; the limiter
// itself is covered by its own dedicated test which re-imports the module with
// a low limit.
process.env.RATE_LIMIT_WINDOW_MS = "60000";
process.env.RATE_LIMIT_MAX_REQUESTS = "1000000";
process.env.AUTH_RATE_LIMIT_MAX = "1000000";

// Keep expected-failure output readable.
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "error";

export const PROJECT_ID = SAFE_PROJECT_ID;
export const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
