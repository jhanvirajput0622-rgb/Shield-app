/**
 * ERD entity 4 -- AntiTheft.
 *
 * A record here is a theft *event*, not a device's armed state: `status` moves
 * armed -> triggered -> locked/wiped as the incident progresses, and
 * `actionTaken` records which remote command was issued. The current armed
 * state of a device lives on the device document.
 */

import { crud, now } from "../crud";
import type { AntiTheftAction, AntiTheftDoc, AntiTheftStatus, GeoPoint, WithId } from "../schema";
import { requireUserId } from "./context";

const antiTheftCrud = crud("antiThefts");

export interface CreateAntiTheftInput {
  deviceId?: string | null;
  location?: GeoPoint | null;
  status?: AntiTheftStatus;
  actionTaken?: AntiTheftAction;
  lockedAt?: Date | null;
}

export async function createAntiTheftEvent(input: CreateAntiTheftInput = {}): Promise<string> {
  const data: AntiTheftDoc = {
    userId: requireUserId(),
    deviceId: input.deviceId ?? null,
    location: input.location ?? null,
    status: input.status ?? "triggered",
    actionTaken: input.actionTaken ?? "none",
    lockedAt: input.lockedAt ?? null,
    createdAt: now(),
  };
  return antiTheftCrud.create(data);
}

export function getAntiTheft(theftId: string): Promise<WithId<AntiTheftDoc> | null> {
  return antiTheftCrud.get(theftId);
}

export function listAntiTheftEvents(pageSize = 25, startAfterId?: string) {
  return antiTheftCrud.paginate({
    filters: { userId: requireUserId() },
    orderBy: [{ field: "createdAt", direction: "desc" }],
    pageSize,
    startAfterId,
  });
}

export function listAntiTheftByStatus(status: AntiTheftStatus): Promise<WithId<AntiTheftDoc>[]> {
  return antiTheftCrud.list({
    filters: { userId: requireUserId(), status },
    orderBy: [{ field: "createdAt", direction: "desc" }],
  });
}

export function listAntiTheftByDevice(deviceId: string): Promise<WithId<AntiTheftDoc>[]> {
  return antiTheftCrud.list({
    filters: { userId: requireUserId(), deviceId },
    orderBy: [{ field: "createdAt", direction: "desc" }],
  });
}

export function recordLocation(theftId: string, location: GeoPoint): Promise<void> {
  return antiTheftCrud.update(theftId, { location });
}

/**
 * Record a command being issued. `lockedAt` is stamped on the first `lock`,
 * not on every call, so it keeps meaning "when the device was locked".
 */
export function recordAction(theftId: string, action: AntiTheftAction): Promise<void> {
  return antiTheftCrud.update(theftId, {
    actionTaken: action,
    ...(action === "lock" ? { lockedAt: now() } : {}),
  });
}

export function setAntiTheftStatus(theftId: string, status: AntiTheftStatus): Promise<void> {
  return antiTheftCrud.update(theftId, { status });
}

/**
 * Unlock clears `lockedAt` outright. Omitting the key from an `update` would
 * leave the stored value in place, so it is named in `clearFields`.
 */
export function markUnlocked(theftId: string): Promise<void> {
  return antiTheftCrud.update(
    theftId,
    { status: "dismissed", actionTaken: "unlock" },
    { clearFields: ["lockedAt"] }
  );
}

export function countOpenIncidents(): Promise<number> {
  return antiTheftCrud.count({ userId: requireUserId(), status: "triggered" });
}

export function subscribeToAntiTheft(
  onNext: (events: WithId<AntiTheftDoc>[]) => void,
  onError?: (error: Error) => void
): () => void {
  return antiTheftCrud.subscribe(
    {
      filters: { userId: requireUserId() },
      orderBy: [{ field: "createdAt", direction: "desc" }],
      limit: 50,
    },
    onNext,
    onError
  );
}
