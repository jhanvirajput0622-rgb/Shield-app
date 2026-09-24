/**
 * Polls GET /api/health every 30 seconds.
 * Returns whether the backend + MongoDB are reachable.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";

interface HealthResponse {
  success: boolean;
  service: string;
  database: string;
  databaseStatus: "connected" | "disconnected" | "connecting" | "error";
  databaseError?: string;
  timestamp: string;
  version: string;
}

export function useDbHealth() {
  return useQuery<HealthResponse>({
    queryKey: ["db-health"],
    queryFn: () =>
      apiFetch<HealthResponse>("/api/health", { skipAuth: true }),
    refetchInterval: 30_000, // poll every 30 s
    refetchIntervalInBackground: false,
    // Tolerate transient connection blips (server restarting, network switch)
    // with an exponential backoff before marking the DB offline.
    retry: 2,
    retryDelay: (attempt) => 1000 * 2 ** attempt,
    staleTime: 20_000,
  });
}
