/**
 * deviceService — device registration and CRUD against /api/devices.
 * The mobile app NEVER connects to Firestore directly.
 */
import { apiFetch } from "./api";

export interface DeviceRecord {
  id: string;
  deviceName: string;
  platform: string;
  osVersion: string;
  appVersion: string;
  deviceModel: string;
  /** SHA-256 fingerprint of the device public key — the raw key never leaves the device */
  deviceKeyFingerprint: string;
  status: "online" | "offline" | "lost" | "locked" | "wiped";
  isOnline: boolean;
  batteryPercent: number;
  lastSeenAt: string;
  vpnEnabled: boolean;
  theftProtectionEnabled: boolean;
  locationAvailable: boolean;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string;
  simStatus: string;
  gpsPrecision: string;
  networkEncryption: string;
  pendingAction: "none" | "locate" | "lock" | "wipe";
  actionStatus: "idle" | "queued" | "delivered" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
}

interface ListResponse { success: boolean; data: DeviceRecord[] }
interface SingleResponse { success: boolean; data: DeviceRecord }

export interface RegisterDeviceInput {
  deviceName: string;
  platform?: "iOS" | "Android";
  osVersion?: string;
  appVersion?: string;
  deviceModel?: string;
  /** SHA-256 of device public key — never the raw key */
  deviceKeyFingerprint?: string;
}

/** GET /api/devices */
export async function listDevices(): Promise<DeviceRecord[]> {
  const res = await apiFetch<ListResponse>("/api/devices");
  return res.data;
}

/** POST /api/devices */
export async function registerDevice(input: RegisterDeviceInput): Promise<DeviceRecord> {
  const res = await apiFetch<SingleResponse>("/api/devices", {
    method: "POST",
    body: input,
  });
  return res.data;
}

/** GET /api/devices/:id */
export async function getDevice(id: string): Promise<DeviceRecord> {
  const res = await apiFetch<SingleResponse>(`/api/devices/${id}`);
  return res.data;
}

/** DELETE /api/devices/:id */
export async function deleteDevice(id: string): Promise<void> {
  await apiFetch(`/api/devices/${id}`, { method: "DELETE" });
}
