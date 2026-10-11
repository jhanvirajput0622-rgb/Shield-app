/**
 * Audit logging service.
 *
 * Rules:
 *   - Audit logs are APPEND-ONLY. No update/delete operations here.
 *   - The detailsEncrypted field is encrypted with the server's ENCRYPTION_KEY.
 *   - Normal users never see detailsEncrypted through API responses.
 *   - The public `summary` field is safe to show in audit trail UIs.
 */

import { AuditLog, AuditAction, IAuditLog } from "../models/AuditLog";
import { logger } from "../utils/logger";
import { encryptDetails } from "./encryption.service";

// ─── Service ──────────────────────────────────────────────────────────────────

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string | null;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  async log(
    userId: string,
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
    userId: string,
    limit = 50
  ): Promise<IAuditLog[]> {
    return AuditLog.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("-detailsEncrypted") as unknown as Promise<IAuditLog[]>;
  }

  async getLogsForDevice(
    deviceId: string,
    userId: string,
    limit = 50
  ): Promise<IAuditLog[]> {
    return AuditLog.find({ deviceId, userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("-detailsEncrypted") as unknown as Promise<IAuditLog[]>;
  }
}

export const auditService = new AuditService();
