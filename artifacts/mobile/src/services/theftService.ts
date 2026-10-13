/**
 * theftService — anti-theft command lifecycle: locate, lock, wipe.
 *
 * SECURITY:
 *   - All commands require a valid JWT (enforced server-side).
 *   - Wipe requires a confirmationPhrase that matches the device name exactly.
 *   - Biometric gate is handled on-device before calling wipe().
 *   - Server does NOT directly erase device data; it queues a command that
 *     the mobile client's background task picks up and executes via
 *     platform-supported MDM/device-management APIs.
 */
import { apiFetch } from "./api";

export type TheftCommandStatus =
  | "pending"
  | "sent"
  | "acknowledged"
  | "completed"
  | "failed"
  | "expired";

export interface TheftCommandResult {
  success: boolean;
  commandId: string;
  status: TheftCommandStatus;
  message: string;
  location?: { latitude: number; longitude: number; accuracy: number | null };
}

export interface TheftCommandRecord {
  id: string;
  command: "locate" | "lock" | "wipe";
  message: string;
  status: TheftCommandStatus;
  issuedAt: string;
  acknowledgedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
}

export interface DeviceLocation {
  deviceId: string;
  deviceName: string;
  locationAvailable: boolean;
  current: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    recordedAt: string | null;
  } | null;
  history: Array<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    recordedAt: string;
  }>;
}

/** POST /api/theft/locate */
export async function locate(coords?: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}): Promise<TheftCommandResult> {
  return apiFetch<TheftCommandResult>("/api/theft/locate", {
    method: "POST",
    body: coords ?? {},
  });
}

/** POST /api/theft/lock */
export async function lock(message: string): Promise<TheftCommandResult> {
  return apiFetch<TheftCommandResult>("/api/theft/lock", {
    method: "POST",
    body: { message },
  });
}

/**
 * POST /api/theft/wipe
 * @param confirmationPhrase Must match the device name exactly (server enforces).
 * Biometric auth must be passed on-device before calling this.
 */
export async function wipe(confirmationPhrase: string): Promise<TheftCommandResult> {
  return apiFetch<TheftCommandResult>("/api/theft/wipe", {
    method: "POST",
    body: { confirmationPhrase },
  });
}

/** GET /api/theft/commands */
export async function getCommands(): Promise<TheftCommandRecord[]> {
  const res = await apiFetch<{ success: boolean; data: TheftCommandRecord[] }>(
    "/api/theft/commands"
  );
  return res.data;
}

/** GET /api/theft/location/:deviceId */
export async function getDeviceLocation(deviceId: string): Promise<DeviceLocation> {
  const res = await apiFetch<{ success: boolean; data: DeviceLocation }>(
    `/api/theft/location/${deviceId}`
  );
  return res.data;
}
