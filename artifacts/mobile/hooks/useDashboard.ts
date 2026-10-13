import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient";

export type DashboardStats = {
  score: number;
  overall: "protected" | "action_needed" | "at_risk";
  lastScanAt: string;
  threatsBlocked: number;
  appsScanned: number;
  linksScanned: number;
  permissionsStatus: "safe" | "warning" | "danger" | "critical";
  networkStatus: "safe" | "warning" | "danger" | "critical";
  phishingStatus: "safe" | "warning" | "danger" | "critical";
  antitheftStatus: "safe" | "warning" | "danger" | "critical";
  /** SecurityEvent documents serialized with camelCase fields */
  recentEvents: Array<{
    _id: string;
    eventType: string;
    severity: string;
    title: string;
    description: string;
    isBlocked: boolean;
    occurredAt: string;
  }>;
};

export const useDashboard = () => {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiFetch<DashboardStats>("/api/shield/status"),
    retry: 1,
    staleTime: 30_000,
  });
};
