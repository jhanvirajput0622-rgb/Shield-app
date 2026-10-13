import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient";

export type DeviceStatus =
  | "online"
  | "offline"
  | "lost"
  | "locked"
  | "wiped";

export type DeviceInfo = {
  id?: string;
  deviceName: string;
  status: DeviceStatus | string;
  batteryPercent: number;
  latitude: number | null;
  longitude: number | null;
  locationLabel?: string;
  lastSeenAt: string;
  simStatus: string;
  networkEncryption: string;
  gpsPrecision: string;
  pendingAction?: string;
  actionStatus?: string;
  device_status?: string;
};

export type CommandStatus = {
  status: string;
  error_message?: string;
};

type ActionResult = {
  success: boolean;
  status: "queued" | "failed";
  message: string;
  /** Sentinel id used client-side to enable command-status polling */
  commandRef: string;
};

export function useAntiTheft() {
  const queryClient = useQueryClient();
  // Keep a local command id for the polling hook
  const [_deviceId] = useState<string | null>(null);

  const {
    data: device,
    isLoading,
    refetch,
    isError,
  } = useQuery<DeviceInfo | null>({
    queryKey: ["anti-theft-device"],
    queryFn: async (): Promise<DeviceInfo | null> => {
      const data = await apiFetch<DeviceInfo>("/api/shield/device");
      return data;
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  // ── Locate ──────────────────────────────────────────────────────────────────
  const locateMutation = useMutation({
    mutationFn: async ({
      lat,
      lng,
      acc,
    }: {
      lat: number;
      lng: number;
      acc: number | null;
    }) => {
      await apiFetch("/api/shield/device/locate", {
        method: "POST",
        body: { latitude: lat, longitude: lng, accuracy: acc },
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["anti-theft-device"] }),
  });

  // ── Lock ────────────────────────────────────────────────────────────────────
  const lockMutation = useMutation({
    mutationFn: async (message: string): Promise<ActionResult> => {
      const raw = await apiFetch<{ success: boolean; status: string; message: string }>(
        "/api/shield/device/lock",
        { method: "POST", body: { message } }
      );
      return {
        ...raw,
        status: (raw.status as "queued" | "failed") ?? "queued",
        // Generate a client-side sentinel so polling can start immediately
        commandRef: `lock-${Date.now()}`,
      };
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["anti-theft-device"] }),
  });

  // ── Wipe ────────────────────────────────────────────────────────────────────
  const wipeMutation = useMutation({
    mutationFn: async (confirmationPhrase: string): Promise<ActionResult> => {
      const raw = await apiFetch<{ success: boolean; status: string; message: string }>(
        "/api/shield/device/wipe",
        { method: "POST", body: { confirmationPhrase } }
      );
      return {
        ...raw,
        status: (raw.status as "queued" | "failed") ?? "queued",
        commandRef: `wipe-${Date.now()}`,
      };
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["anti-theft-device"] }),
  });

  // ── Command-status polling ───────────────────────────────────────────────────
  // The server updates device.pendingAction / device.actionStatus in-place.
  // We poll the device endpoint rather than a separate command-status endpoint.
  const useCommandStatus = (commandId: string | null) => {
    return useQuery<CommandStatus | null>({
      queryKey: ["command-status", commandId],
      queryFn: async (): Promise<CommandStatus | null> => {
        if (!commandId) return null;
        const d = await apiFetch<DeviceInfo>("/api/shield/device");
        return {
          status: d.actionStatus ?? "pending",
          error_message: undefined,
        };
      },
      enabled: !!commandId,
      refetchInterval: (query) => {
        const s = query.state.data?.status;
        if (
          s === "completed" ||
          s === "failed" ||
          s === "expired" ||
          s === "rejected"
        )
          return false;
        return 3000;
      },
    });
  };

  return {
    device,
    isLoading,
    isError,
    refetch,
    locateDevice: (coords: { lat: number; lng: number; acc: number | null }) =>
      locateMutation.mutateAsync(coords),
    lockDevice: (msg: string) => lockMutation.mutateAsync(msg),
    wipeDevice: (auth: string) => wipeMutation.mutateAsync(auth),
    useCommandStatus,
    isLocating: locateMutation.isPending,
  };
}
