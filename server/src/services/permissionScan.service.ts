import mongoose from "mongoose";
import { AppPermissionScan, IAppPermissionScan, IAppFinding } from "../models/AppPermissionScan";
import { SecurityEvent } from "../models/SecurityEvent";
import { Device } from "../models/Device";

// ─── Heuristic permission analyser ───────────────────────────────────────────
// In production this should integrate with a real threat intelligence feed.
// The logic here mirrors the existing mock data in the mobile app.

const HIGH_RISK_COMBOS: Array<{ permissions: string[]; reason: string }> = [
  {
    permissions: ["SMS", "CONTACTS"],
    reason: "SMS + Contacts access can be used to harvest personal data",
  },
  {
    permissions: ["CAMERA", "MICROPHONE"],
    reason: "Combined camera and mic access enables covert surveillance",
  },
  {
    permissions: ["CALL_LOG", "SMS"],
    reason: "Call log + SMS access exposes full communications history",
  },
];

function assessApp(app: Omit<IAppFinding, "riskScore" | "riskLevel" | "riskReasons">): IAppFinding {
  const perms = app.requestedPermissions.map((p) => p.toUpperCase());
  const reasons: string[] = [];
  let score = 0;

  // Unusual permission for category
  if (app.category === "utility" && perms.includes("SMS")) {
    reasons.push(`${app.appName} (utility) requesting SMS — highly unusual`);
    score += 40;
  }
  if (app.category === "utility" && perms.includes("CONTACTS")) {
    reasons.push("Contacts access not expected for utility apps");
    score += 20;
  }

  // High-risk combos
  for (const combo of HIGH_RISK_COMBOS) {
    if (combo.permissions.every((p) => perms.includes(p))) {
      reasons.push(combo.reason);
      score += 30;
    }
  }

  // Individual permissions that are inherently risky
  if (perms.includes("MICROPHONE") && app.category !== "communication") {
    reasons.push("Microphone access warrants review for a non-communication app");
    score += 15;
  }
  if (perms.includes("LOCATION") && perms.includes("CAMERA") && app.category !== "maps") {
    reasons.push("Location + Camera combination warrants review");
    score += 10;
  }

  score = Math.min(score, 100);

  let riskLevel: IAppFinding["riskLevel"] = "safe";
  if (score >= 80) riskLevel = "critical";
  else if (score >= 55) riskLevel = "high";
  else if (score >= 30) riskLevel = "medium";
  else if (score >= 10) riskLevel = "low";

  return { ...app, riskScore: score, riskLevel, riskReasons: reasons };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class PermissionScanService {
  /**
   * Run a scan.  The raw app list is submitted by the mobile client (the
   * device knows its own installed apps). The server applies risk scoring,
   * persists the result, and returns it.
   */
  async runScan(
    userId: mongoose.Types.ObjectId,
    rawApps: Array<{
      appName: string;
      packageName: string;
      category?: string;
      requestedPermissions: string[];
    }>
  ): Promise<IAppPermissionScan> {
    const device = await Device.findOne({ userId }).sort({ lastSeenAt: -1 });
    const deviceId = device?._id ?? new mongoose.Types.ObjectId();

    const scoredApps = rawApps.map((a) =>
      assessApp({
        appName: a.appName,
        packageName: a.packageName,
        category: a.category ?? "unknown",
        requestedPermissions: a.requestedPermissions,
      })
    );

    const highRiskCount = scoredApps.filter((a) =>
      ["critical", "high"].includes(a.riskLevel)
    ).length;

    const scan = await AppPermissionScan.create({
      userId,
      deviceId,
      apps: scoredApps,
      totalApps: scoredApps.length,
      highRiskCount,
      scannedAt: new Date(),
    });

    if (highRiskCount > 0) {
      await SecurityEvent.create({
        userId,
        deviceId,
        eventType: "permission_scan_flagged",
        severity: "medium",
        title: `${highRiskCount} high-risk app${highRiskCount > 1 ? "s" : ""} detected`,
        description: `Permission scan found ${highRiskCount} app(s) with suspicious permissions`,
        isBlocked: false,
        occurredAt: new Date(),
      });
    }

    return scan;
  }

  /** Return the most recent scan result for a user */
  async getLatestScan(
    userId: mongoose.Types.ObjectId
  ): Promise<IAppPermissionScan | null> {
    return AppPermissionScan.findOne({ userId })
      .sort({ scannedAt: -1 }) as unknown as Promise<IAppPermissionScan | null>;
  }
}

export const permissionScanService = new PermissionScanService();
