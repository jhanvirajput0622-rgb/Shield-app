import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Network from "expo-network";
import { apiFetch, ShieldApiError } from "../lib/apiClient";

export type VpnSession = {
  id?: string;
  connection_status?: "connecting" | "connected" | "disconnected" | "failed";
  local_ip?: string;
  vpn_protocol?: string;
  server_region?: string;
  encryption?: string;
  bytes_uploaded?: number;
  bytes_downloaded?: number;
};

/** Tunnel protocols the server can provision (fallback handshake options). */
export const VPN_PROTOCOLS = ["WireGuard", "OpenVPN", "IPSec"] as const;
export type VpnProtocol = (typeof VPN_PROTOCOLS)[number];

type NetworkStatusResponse = {
  ssid: string;
  isSecured: boolean;
  signalStrength: number;
  speedMbps: number;
  riskLevel: "safe" | "warning" | "danger";
  vpnConnected: boolean;
  vpnSession?: {
    connected: boolean;
    localIp: string;
    protocol: string;
    serverLocation: string;
    encryption: string;
    connectedAt?: string;
  };
};

type VpnConnectResponse = {
  connected: boolean;
  localIp: string;
  protocol: string;
  serverLocation: string;
  encryption: string;
  connectedAt?: string;
};

/**
 * Map a failed connect/disconnect to a human-readable message so the Network
 * Security screen can show a specific, actionable error instead of a generic
 * "Couldn't establish a secure connection".
 */
export function vpnErrorMessage(err: unknown): string {
  if (err instanceof ShieldApiError) {
    if (err.status === 0) {
      return "Can't reach the Shield server. Check your connection and that the API is running.";
    }
    // Server-provided message (e.g. validation failure).
    return err.message || "Connection failed. Please try again.";
  }
  return "Couldn't establish a secure connection. Please try again.";
}

export function useNetwork() {
  const queryClient = useQueryClient();

  // Requested tunnel protocol — the server falls back to WireGuard by default.
  const [protocol, setProtocol] = useState<VpnProtocol>("WireGuard");

  // On-device network info (SSID / type from expo-network)
  const [currentNetwork, setCurrentNetwork] = useState<{
    ssid: string;
    isSecured: boolean;
  }>({ ssid: "Scanning...", isSecured: true });

  // Server-side VPN session state
  const {
    data: networkStatus,
    isLoading,
    refetch,
  } = useQuery<NetworkStatusResponse>({
    queryKey: ["active-vpn-session"],
    queryFn: () => apiFetch<NetworkStatusResponse>("/api/shield/network"),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  // Derive the shape that network.tsx already expects
  const session: VpnSession | null = networkStatus?.vpnConnected
    ? {
        connection_status: "connected",
        local_ip: networkStatus.vpnSession?.localIp,
        vpn_protocol: networkStatus.vpnSession?.protocol,
        server_region: networkStatus.vpnSession?.serverLocation,
        encryption: networkStatus.vpnSession?.encryption,
      }
    : null;

  // Read on-device SSID / connection type
  useEffect(() => {
    let mounted = true;
    const checkNet = async () => {
      try {
        const netState = await Network.getNetworkStateAsync();
        if (mounted) {
          setCurrentNetwork({
            ssid:
              netState.type === Network.NetworkStateType.WIFI
                ? "Home_WiFi_5G"
                : "Cellular Data",
            isSecured: true,
          });
        }
      } catch {
        // ignore — expo-network may be unavailable in simulators
      }
    };
    checkNet();
    return () => {
      mounted = false;
    };
  }, []);

  const connectMutation = useMutation({
    mutationFn: () =>
      apiFetch<VpnConnectResponse>("/api/shield/network/vpn/connect", {
        method: "POST",
        body: {
          protocol,
          ssid: currentNetwork.ssid,
          isSecured: currentNetwork.isSecured,
        },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["active-vpn-session"] }),
  });

  const disconnectMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>("/api/shield/network/vpn/disconnect", {
        method: "POST",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["active-vpn-session"] }),
  });

  const simulateOpenNetworkDetected = useCallback(() => {
    setCurrentNetwork({ ssid: "Free_Airport_WiFi", isSecured: false });
  }, []);

  return {
    currentNetwork,
    session,
    isLoading,
    refetch,
    connect: () => connectMutation.mutateAsync(),
    disconnect: () => disconnectMutation.mutateAsync(),
    isConnecting: connectMutation.isPending,
    protocol,
    setProtocol,
    simulateOpenNetworkDetected,
  };
}