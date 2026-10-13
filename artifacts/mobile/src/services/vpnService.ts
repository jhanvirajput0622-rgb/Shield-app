/**
 * vpnService — VPN session management via /api/vpn/*.
 * The server tracks VPN state; on-device tunnel implementation (WireGuard etc.)
 * is handled by the native module / platform VPN APIs, not this service.
 */
import { apiFetch } from "./api";

export type VpnConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";

export interface VpnSessionRecord {
  id: string;
  connectionStatus: VpnConnectionStatus;
  localIp: string;
  protocol: string;
  serverLocation: string;
  encryption: string;
  bytesUploaded: number;
  bytesDownloaded: number;
  connectedAt: string | null;
  disconnectedAt: string | null;
  createdAt: string;
}

interface SingleResponse { success: boolean; data: VpnSessionRecord }
interface ListResponse  { success: boolean; data: VpnSessionRecord[] }

/** POST /api/vpn/session — connect */
export async function connectVpn(): Promise<VpnSessionRecord> {
  const res = await apiFetch<SingleResponse>("/api/vpn/session", {
    method: "POST",
  });
  return res.data;
}

/** GET /api/vpn/sessions — history */
export async function getVpnSessions(): Promise<VpnSessionRecord[]> {
  const res = await apiFetch<ListResponse>("/api/vpn/sessions");
  return res.data;
}

/** PATCH /api/vpn/session/:id — disconnect or update bytes */
export async function updateVpnSession(
  id: string,
  patch: {
    connectionStatus?: "disconnected";
    bytesUploaded?: number;
    bytesDownloaded?: number;
  }
): Promise<VpnSessionRecord> {
  const res = await apiFetch<SingleResponse>(`/api/vpn/session/${id}`, {
    method: "PATCH",
    body: patch,
  });
  return res.data;
}

/** Convenience: disconnect the active session by ID */
export async function disconnectVpnSession(id: string): Promise<VpnSessionRecord> {
  return updateVpnSession(id, { connectionStatus: "disconnected" });
}
