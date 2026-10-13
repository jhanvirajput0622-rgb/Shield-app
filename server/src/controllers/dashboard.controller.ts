import { Request, Response } from "express";
import { PhishingCheck } from "../models/PhishingCheck";
import { AppPermissionScan } from "../models/AppPermissionScan";
import { Device } from "../models/Device";
import { securityEventService } from "../services/securityEvent.service";
import { VpnSession } from "../models/VpnSession";

export const dashboardController = {
  async getProtectionStatus(req: Request, res: Response): Promise<void> {
    const userId = req.userId;

    const [
      threatsBlocked,
      linksScanned,
      latestScan,
      recentEvents,
      activeDevice,
      activeVpn,
    ] = await Promise.all([
      securityEventService.getBlockedThreatsCount(userId),
      PhishingCheck.countDocuments({ userId }),
      AppPermissionScan.findOne({ userId }).sort({ scannedAt: -1 }).lean(),
      securityEventService.getRecentEvents(userId, 5),
      Device.findOne({ userId }).sort({ lastSeenAt: -1 }).lean(),
      VpnSession.findOne({ userId, connectionStatus: "connected" }).lean(),
    ]);

    const appsScanned = latestScan?.totalApps ?? 0;
    const highRiskApps = latestScan?.highRiskCount ?? 0;
    const lastScanAt = latestScan?.scannedAt?.toISOString() ?? new Date().toISOString();

    // Derive module statuses
    const permissionsStatus =
      highRiskApps >= 3 ? "danger" :
      highRiskApps >= 1 ? "warning" : "safe";

    const networkStatus =
      !activeVpn && activeDevice ? "warning" : "safe";

    const phishingStatus =
      threatsBlocked >= 5 ? "danger" :
      threatsBlocked >= 1 ? "warning" : "safe";

    const antitheftStatus =
      activeDevice?.status === "lost" ? "danger" :
      !activeDevice ? "warning" : "safe";

    // Derive overall score (simple weighted formula)
    const moduleScores = [
      permissionsStatus === "safe" ? 25 : permissionsStatus === "warning" ? 15 : 5,
      networkStatus === "safe" ? 25 : 10,
      phishingStatus === "safe" ? 25 : phishingStatus === "warning" ? 15 : 5,
      antitheftStatus === "safe" ? 25 : antitheftStatus === "warning" ? 15 : 5,
    ];
    const score = moduleScores.reduce((a, b) => a + b, 0);

    const overall =
      score >= 80 ? "protected" :
      score >= 50 ? "action_needed" : "at_risk";

    res.json({
      overall,
      score,
      permissionsStatus,
      networkStatus,
      phishingStatus,
      antitheftStatus,
      lastScanAt,
      threatsBlocked,
      appsScanned,
      linksScanned,
      // recentEvents uses camelCase field names matching the SecurityEvent model
      // (eventType, severity, title, occurredAt, isBlocked)
      recentEvents: recentEvents.map((e) => ({
        _id: e._id.toString(),
        eventType: e.eventType,
        severity: e.severity,
        title: e.title,
        description: e.description,
        isBlocked: e.isBlocked,
        occurredAt: e.occurredAt instanceof Date
          ? e.occurredAt.toISOString()
          : e.occurredAt,
      })),
    });
  },
};
