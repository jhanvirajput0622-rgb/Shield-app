/**
 * dashboardService — protection score, threats, recent events, module statuses.
 * Maps the backend /api/shield/status response to the shape the UI expects.
 */
import { apiFetch } from "./api";

export type OverallStatus = "protected" | "action_needed" | "at_risk";
export type ModuleStatus = "safe" | "warning" | "danger" | "critical";

export interface SecurityEvent {
  id: string;
  eventType: string;
  severity: string;
  title: string;
  description: string;
  isBlocked: boolean;
  occurredAt: string;
}

export interface DashboardData {
  overall: OverallStatus;
  score: number;
  permissionsStatus: ModuleStatus;
  networkStatus: ModuleStatus;
  phishingStatus: ModuleStatus;
  antitheftStatus: ModuleStatus;
  lastScanAt: string;
  threatsBlocked: number;
  appsScanned: number;
  linksScanned: number;
  recentEvents: SecurityEvent[];
}

/** GET /api/shield/status */
export async function getDashboard(): Promise<DashboardData> {
  return apiFetch<DashboardData>("/api/shield/status");
}

/** GET /api/health — useful for connection diagnostics */
export async function getHealth(): Promise<{
  success: boolean;
  service: string;
  database: string;
  databaseStatus: string;
  timestamp: string;
}> {
  return apiFetch("/api/health", { skipAuth: true });
}
