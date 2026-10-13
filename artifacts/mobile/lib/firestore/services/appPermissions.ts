/**
 * ERD entity 7 -- AppPermission.
 *
 * One row per (app, permission) pair. `grantedAt` and `revokedAt` are kept
 * independently rather than as a single `changedAt`, so a permission that was
 * granted, revoked, then granted again still shows the current grant time.
 */

import { collection, doc, writeBatch } from "firebase/firestore";

import { crud, now } from "../crud";
import { COLLECTIONS, type AppPermissionDoc, type PermissionStatus, type WithId } from "../schema";
import { getFirestoreDb } from "../../firebase";
import { requireUserId } from "./context";

const permissionsCrud = crud("appPermissions");

export interface UpsertPermissionInput {
  appName: string;
  permissionType: string;
  status: PermissionStatus;
}

export async function recordPermission(input: UpsertPermissionInput): Promise<string> {
  const userId = requireUserId();
  const data: AppPermissionDoc = {
    userId,
    appName: input.appName,
    permissionType: input.permissionType,
    status: input.status,
    grantedAt: input.status === "granted" ? now() : null,
    revokedAt: input.status === "revoked" ? now() : null,
  };
  return permissionsCrud.create(data);
}

/** Mark one permission granted or denied, keeping the timestamps coherent. */
export function setPermissionStatus(
  permissionId: string,
  status: PermissionStatus
): Promise<void> {
  const changes: Partial<AppPermissionDoc> = { status };
  if (status === "granted") changes.grantedAt = now() as never;
  if (status === "revoked") changes.revokedAt = now() as never;
  return permissionsCrud.update(permissionId, changes);
}

export function getPermission(permissionId: string): Promise<WithId<AppPermissionDoc> | null> {
  return permissionsCrud.get(permissionId);
}

/** ERD: "One User includes many AppPermission records". */
export function listPermissions(pageSize = 50, startAfterId?: string) {
  return permissionsCrud.paginate({
    filters: { userId: requireUserId() },
    orderBy: [{ field: "appName", direction: "asc" }],
    pageSize,
    startAfterId,
  });
}

export function listPermissionsByApp(appName: string): Promise<WithId<AppPermissionDoc>[]> {
  return permissionsCrud.list({
    filters: { userId: requireUserId(), appName },
    orderBy: [{ field: "permissionType", direction: "asc" }],
  });
}

export function listPermissionsByStatus(
  status: PermissionStatus
): Promise<WithId<AppPermissionDoc>[]> {
  return permissionsCrud.list({
    filters: { userId: requireUserId(), status },
    orderBy: [{ field: "appName", direction: "asc" }],
  });
}

/** The permissions worth surfacing on the dashboard: anything not granted. */
export function listRiskyPermissions(): Promise<WithId<AppPermissionDoc>[]> {
  return permissionsCrud.list({
    filters: { userId: requireUserId(), status: "denied" },
    orderBy: [{ field: "appName", direction: "asc" }],
  });
}

/**
 * Replace the full permission set for an app in one atomic write.
 *
 * A per-permission delete-then-insert would leave the app showing no
 * permissions mid-write, and two concurrent scans would interleave. IDs are
 * generated up front with `doc(collectionRef).id` so every delete and insert
 * lands in a single batch, which Firestore commits all-or-nothing.
 */
export async function replacePermissionsForApp(
  appName: string,
  permissions: UpsertPermissionInput[]
): Promise<void> {
  const userId = requireUserId();
  const existing = await permissionsCrud.list({ filters: { userId, appName } });

  const permissionsRef = collection(getFirestoreDb(), COLLECTIONS.appPermissions);
  const batch = writeBatch(getFirestoreDb());

  for (const stale of existing) {
    batch.delete(doc(permissionsRef, stale.id));
  }

  for (const permission of permissions) {
    batch.set(doc(permissionsRef), {
      userId,
      appName,
      permissionType: permission.permissionType,
      status: permission.status,
      grantedAt: permission.status === "granted" ? now() : null,
      revokedAt: permission.status === "revoked" ? now() : null,
    });
  }

  await batch.commit();
}

export async function removePermission(permissionId: string): Promise<void> {
  await permissionsCrud.remove(permissionId);
}

export function countPermissionsByStatus(status: PermissionStatus): Promise<number> {
  return permissionsCrud.count({ userId: requireUserId(), status });
}
