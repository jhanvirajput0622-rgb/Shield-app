/**
 * wifiService — Wi-Fi network security checks and trust management.
 *
 * PRIVACY: Raw SSIDs are NEVER sent to the server.
 * The caller must hash the SSID (SHA-256) before calling checkNetwork().
 */
import { apiFetch } from "./api";

export type WifiSecurityType = "WPA3" | "WPA2" | "WPA" | "WEP" | "OPEN" | "UNKNOWN";

export interface WifiNetworkRecord {
  id: string;
  networkHash: string;
  securityType: WifiSecurityType;
  isTrusted: boolean;
  isUnsecured: boolean;
  riskLevel: "safe" | "danger";
  signalStrength: number | null;
  firstDetectedAt: string;
  lastDetectedAt: string;
}

interface CheckResponse { success: boolean; data: WifiNetworkRecord }
interface ListResponse  { success: boolean; data: WifiNetworkRecord[] }

/**
 * POST /api/wifi/check
 * @param networkHash SHA-256 of the SSID — NOT the raw SSID
 */
export async function checkNetwork(
  networkHash: string,
  securityType: WifiSecurityType = "UNKNOWN",
  signalStrength?: number | null
): Promise<WifiNetworkRecord> {
  const res = await apiFetch<CheckResponse>("/api/wifi/check", {
    method: "POST",
    body: { networkHash, securityType, signalStrength: signalStrength ?? null },
  });
  return res.data;
}

/** GET /api/wifi/networks */
export async function getNetworks(): Promise<WifiNetworkRecord[]> {
  const res = await apiFetch<ListResponse>("/api/wifi/networks");
  return res.data;
}

/** PATCH /api/wifi/:id/trust */
export async function trustNetwork(id: string): Promise<WifiNetworkRecord> {
  const res = await apiFetch<CheckResponse>(`/api/wifi/${id}/trust`, {
    method: "PATCH",
  });
  return res.data;
}
