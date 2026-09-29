/**
 * ERD entity 1 -- Admin.
 *
 * Admin documents are keyed by the admin's Firebase uid so firestore.rules can
 * authorise admin-only reads with a single `get(/mobileAdmins/$(auth.uid))`.
 * That is why `createAdmin` takes the uid from an already-created auth user
 * rather than generating an ID.
 *
 * Passwords live in Firebase Auth. `passwordHash` from the ERD is deliberately
 * absent: a client-readable document is readable by its owner, so an inline
 * hash would be exposed to the account it protects. `mobileCredentials` is the
 * server-only mirror for it, and firestore.rules denies it to every client.
 */

import { crud, now } from "../crud";
import type { AdminDoc, WithId } from "../schema";
import { requireUserId } from "./context";

const adminsCrud = crud("admins");

export interface CreateAdminInput {
  name: string;
  email: string;
  role: AdminDoc["role"];
}

export function createAdmin(uid: string, input: CreateAdminInput): Promise<string> {
  const data: AdminDoc = {
    name: input.name,
    email: input.email,
    role: input.role,
    createdAt: now(),
    lastLoginAt: null,
  };
  return adminsCrud.createWithId(uid, data);
}

export function getAdmin(uid: string): Promise<WithId<AdminDoc> | null> {
  return adminsCrud.get(uid);
}

/** The signed-in admin's own record. */
export function getCurrentAdmin(): Promise<WithId<AdminDoc> | null> {
  return adminsCrud.get(requireUserId());
}

export function touchAdminLastLogin(uid: string): Promise<void> {
  return adminsCrud.update(uid, { lastLoginAt: now() });
}

export function setAdminRole(uid: string, role: AdminDoc["role"]): Promise<void> {
  return adminsCrud.update(uid, { role });
}

/** Reachable only by admins; enforced by the rules, not by this function. */
export function listAdmins(): Promise<WithId<AdminDoc>[]> {
  return adminsCrud.list({ orderBy: [{ field: "createdAt", direction: "desc" }] });
}
