/**
 * ERD entity 3 -- Device.
 *
 * `deviceIdHash` is a client-derived pseudonymous fingerprint, not a raw
 * hardware identifier. Use expo-application's androidId / iosIdForVendorAsync
 * and hash it — a raw IMEID or ANDROID_ID written here would be a persistent
 * hardware identifier readable by any code that can read the user's devices.
 *
 * Enumeration: the list is scoped by `userId == auth.uid` in the rules, so one
 * user cannot read another's devices even though the query is a flat
 * collection scan.
 */

import { crud, now } from "../crud";
import type { DeviceDoc, WithId } from "../schema";
import { requireUserId } from "./context";

const devicesCrud = crud("devices");

export interface RegisterDeviceInput {
  deviceName: string;
  osType: DeviceDoc["osType"];
  deviceModel: string;
  deviceIdHash: string;
}

export async function registerDevice(input: RegisterDeviceInput): Promise<string> {
  const userId = requireUserId();
  const data: DeviceDoc = {
    userId,
    deviceName: input.deviceName,
    osType: input.osType,
    deviceModel: input.deviceModel,
    deviceIdHash: input.deviceIdHash,
    lastSeen: now(),
    isActive: true,
    createdAt: now(),
  };
  return devicesCrud.create(data);
}

export function getDevice(deviceId: string): Promise<WithId<DeviceDoc> | null> {
  return devicesCrud.get(deviceId);
}

/** ERD: "One User has many Devices". */
export function listDevices(options: { includeInactive?: boolean } = {}): Promise<WithId<DeviceDoc>[]> {
  return devicesCrud.list({
    filters: {
      userId: requireUserId(),
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ field: "lastSeen", direction: "desc" }],
  });
}

export function listDevicesPaginated(pageSize = 25, startAfterId?: string) {
  return devicesCrud.paginate({
    filters: { userId: requireUserId() },
    orderBy: [{ field: "lastSeen", direction: "desc" }],
    pageSize,
    startAfterId,
  });
}

/** Heartbeat. `lastSeen` is the primary sort key for every device list. */
export function touchDevice(deviceId: string): Promise<void> {
  return devicesCrud.update(deviceId, { lastSeen: now() });
}

export function setDeviceActive(deviceId: string, isActive: boolean): Promise<void> {
  return devicesCrud.update(deviceId, { isActive });
}

export function renameDevice(deviceId: string, deviceName: string): Promise<void> {
  return devicesCrud.update(deviceId, { deviceName });
}

export async function removeDevice(deviceId: string): Promise<void> {
  await devicesCrud.remove(deviceId);
}

/** Devices whose `deviceIdHash` matches, for recognising a reinstalled app. */
export function findDeviceByHash(deviceIdHash: string): Promise<WithId<DeviceDoc>[]> {
  return devicesCrud.list({
    filters: { userId: requireUserId(), deviceIdHash },
  });
}

export function countActiveDevices(): Promise<number> {
  return devicesCrud.count({ userId: requireUserId(), isActive: true });
}

export function subscribeToDevices(
  onNext: (devices: WithId<DeviceDoc>[]) => void,
  onError?: (error: Error) => void
): () => void {
  return devicesCrud.subscribe(
    {
      filters: { userId: requireUserId() },
      orderBy: [{ field: "lastSeen", direction: "desc" }],
    },
    onNext,
    onError
  );
}
