/**
 * permissionService — app permission scanning and history.
 * The mobile app submits its own installed app list; the server applies
 * risk scoring and persists the result.
 */
import { apiFetch } from "./api";

export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export interface AppFinding {
  id: string;
  name: string;
  packageName: string;
  category: string;
  requestedPermissions: string[];
  riskScore: number;
  riskLevel: RiskLevel;
  riskReasons: string[];
  lastScannedAt: string;
}

export interface PermissionScanResult {
  apps: AppFinding[];
  totalApps: number;
  highRiskCount: number;
  lastScannedAt: string;
}

export interface RawAppInput {
  appName: string;
  packageName: string;
  category?: string;
  requestedPermissions: string[];
}

/** GET /api/permissions — latest scan result */
export async function getPermissions(): Promise<PermissionScanResult> {
  return apiFetch<PermissionScanResult>("/api/permissions");
}

/**
 * POST /api/permissions/scan
 * Submit the device's installed app list; server scores and stores it.
 * Pass an empty array to trigger a re-score of the last known list.
 */
export async function runScan(apps: RawAppInput[] = []): Promise<PermissionScanResult> {
  return apiFetch<PermissionScanResult>("/api/permissions/scan", {
    method: "POST",
    body: { apps },
  });
}

/** GET /api/permissions — alias with explicit "history" semantics */
export const getScanHistory = getPermissions;
