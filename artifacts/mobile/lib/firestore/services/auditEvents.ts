/**
 * ERD entity 10 -- AuditEvent.
 *
 * Admin actions, append-only, and readable only by admins. `adminId` is
 * stamped from the signed-in admin rather than passed in, so a client cannot
 * file an action against another admin's ID.
 *
 * Note the deliberate difference from SecurityLog: audit events survive their
 * subject. Deleting a user does not delete the events about them, which is why
 * there is no `remove` exposed and why `userId` is nullable -- system-wide
 * actions have no subject.
 */

import { collection, doc, writeBatch } from "firebase/firestore";

import { crud, now } from "../crud";
import { COLLECTIONS, type AuditEventDoc, type WithId } from "../schema";
import { getFirestoreDb } from "../../firebase";
import { requireUserId } from "./context";

const auditCrud = crud("auditEvents");

export interface RecordAuditInput {
  action: string;
  target?: string | null;
  userId?: string | null;
  details?: Record<string, unknown> | null;
}

export async function recordAuditEvent(input: RecordAuditInput): Promise<string> {
  const data: AuditEventDoc = {
    adminId: requireUserId(),
    userId: input.userId ?? null,
    action: input.action,
    target: input.target ?? null,
    details: input.details ?? null,
    timestamp: now(),
  };
  return auditCrud.create(data);
}

export function getAuditEvent(eventId: string): Promise<WithId<AuditEventDoc> | null> {
  return auditCrud.get(eventId);
}

/** ERD: "One Admin creates many Audit Events". */
export function listAuditEvents(pageSize = 25, startAfterId?: string) {
  return auditCrud.paginate({
    filters: { adminId: requireUserId() },
    orderBy: [{ field: "timestamp", direction: "desc" }],
    pageSize,
    startAfterId,
  });
}

export function listAuditEventsByUser(userId: string): Promise<WithId<AuditEventDoc>[]> {
  return auditCrud.list({
    filters: { userId },
    orderBy: [{ field: "timestamp", direction: "desc" }],
  });
}

export function listAuditEventsByAction(action: string): Promise<WithId<AuditEventDoc>[]> {
  return auditCrud.list({
    filters: { action },
    orderBy: [{ field: "timestamp", direction: "desc" }],
  });
}

/** Every event across all admins. Admin-only per firestore.rules. */
export function listAllAuditEvents(pageSize = 50, startAfterId?: string) {
  return auditCrud.paginate({
    orderBy: [{ field: "timestamp", direction: "desc" }],
    pageSize,
    startAfterId,
  });
}

/**
 * Record an action together with its effect, atomically.
 *
 * Use this instead of calling the mutate function and `recordAuditEvent`
 * separately: two independent writes can interleave, leaving a change that
 * happened with no audit trail -- the exact gap an audit log exists to close.
 * Both the event and the mutation go into one batch, which commits all or
 * neither. The event ID is pre-allocated with `doc(collectionRef).id` so the
 * audit row can carry its own ID without a second round trip.
 */
export async function recordWithEffect(
  input: RecordAuditInput,
  effect: {
    collection: "users" | "devices" | "admins";
    id: string;
    changes: Record<string, unknown>;
  }
): Promise<string> {
  const adminId = requireUserId();
  const event: AuditEventDoc = {
    adminId,
    userId: input.userId ?? null,
    action: input.action,
    target: input.target ?? `${effect.collection}:${effect.id}`,
    details: input.details ?? null,
    timestamp: now(),
  };

  const auditRef = collection(getFirestoreDb(), COLLECTIONS.auditEvents);
  const newEventRef = doc(auditRef);
  const batch = writeBatch(getFirestoreDb());

  batch.set(newEventRef, event);
  batch.update(doc(getFirestoreDb(), COLLECTIONS[effect.collection], effect.id), effect.changes);

  await batch.commit();
  return newEventRef.id;
}

export function countAuditEventsForUser(userId: string): Promise<number> {
  return auditCrud.count({ userId });
}

export function subscribeToAuditEvents(
  onNext: (events: WithId<AuditEventDoc>[]) => void,
  onError?: (error: Error) => void
): () => void {
  return auditCrud.subscribe(
    {
      filters: { adminId: requireUserId() },
      orderBy: [{ field: "timestamp", direction: "desc" }],
      limit: 50,
    },
    onNext,
    onError
  );
}
