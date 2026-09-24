/**
 * Audit logging service.
 *
 * Rules:
 *   - Audit logs are APPEND-ONLY. No update/delete operations here.
 *   - The detailsEncrypted field is encrypted with the server's ENCRYPTION_KEY.
 *   - Normal users never see detailsEncrypted through API responses.
 *   - The public `summary` field is safe to show in audit trail UIs.
 */

import crypto from "crypto";
import mongoose from "mongoose";
import { AuditLog, AuditAction, IAuditLog } from "../models/AuditLog";
import { logger } from "../utils/logger";

// ─── Encryption helpers ───────────────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "";
  if (!raw) {
    // Fall back to a deterministic dev key — NOT secure for production
    logger.warn("ENCRYPTION_KEY not set — using dev fallback (NOT for production)");
    return Buffer.alloc(32, "shield_dev_key_00000000000000000");
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }
  return key;
}

function encryptDetails(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Layout: [iv (12)] [tag (16)] [ciphertext]
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

// ─── Service ──────────────────────────────────────────────────────────────────

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: mongoose.Types.ObjectId | null;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  async log(
    userId: mongoose.Types.ObjectId,
    action: AuditAction,
    summary: string,
    context: AuditContext = {}
  ): Promise<IAuditLog> {
    // Build encrypted details payload
    const details = JSON.stringify({
      action,
      summary,
      userId: userId.toString(),
      deviceId: context.deviceId?.toString() ?? null,
      ipAddress: context.ipAddress ?? "",
      userAgent: context.userAgent ?? "",
      metadata: context.metadata ?? {},
      timestamp: new Date().toISOString(),
    });

    let detailsEncrypted = "";
    try {
      detailsEncrypted = encryptDetails(details);
    } catch (err) {
      // Never let encryption failure crash the main request flow
      logger.error(`Audit encryption failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return AuditLog.create({
      userId,
      deviceId: context.deviceId ?? null,
      action,
      summary,
      detailsEncrypted,
      ipAddress: context.ipAddress ?? "",
      userAgent: context.userAgent ?? "",
    });
  }

  async getRecentLogs(
    userId: mongoose.Types.ObjectId,
    limit = 50
  ): Promise<IAuditLog[]> {
    return AuditLog.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("-detailsEncrypted") as unknown as Promise<IAuditLog[]>;
  }

  async getLogsForDevice(
    deviceId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    limit = 50
  ): Promise<IAuditLog[]> {
    return AuditLog.find({ deviceId, userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("-detailsEncrypted") as unknown as Promise<IAuditLog[]>;
  }
}

export const auditService = new AuditService();
