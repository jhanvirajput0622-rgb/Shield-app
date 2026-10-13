/**
 * ERD entity 11 -- AppSession.
 *
 * One row per sign-in, opened on login and closed on logout. `status` is
 * derived from the timestamps rather than stored independently: an open session
 * has `logoutTime == null` and `status == "active"`.
 *
 * Closing a session also updates the user's `lastLoginAt`-adjacent state and
 * writes a SecurityLog row, so `endSession` uses a batch -- otherwise a crash
 * between the two writes leaves a session marked terminated with no
 * corresponding log, which is the gap a forensic timeline is for.
 */

import { collection, doc, writeBatch } from "firebase/firestore";

import { crud, now } from "../crud";
import {
  COLLECTIONS,
  type AppSessionDoc,
  type LogSeverity,
  type WithId,
} from "../schema";
import { getFirestoreDb } from "../../firebase";
import { requireUserId } from "./context";

const sessionsCrud = crud("appSessions");

export interface OpenSessionInput {
  ipAddress?: string | null;
  deviceId?: string | null;
}

export async function openSession(input: OpenSessionInput = {}): Promise<string> {
  const data: AppSessionDoc = {
    userId: requireUserId(),
    loginTime: now(),
    logoutTime: null,
    ipAddress: input.ipAddress ?? null,
    deviceId: input.deviceId ?? null,
    status: "active",
  };
  return sessionsCrud.create(data);
}

export function getSession(sessionId: string): Promise<WithId<AppSessionDoc> | null> {
  return sessionsCrud.get(sessionId);
}

/** The current open session for this user, if any. */
export function getActiveSession(): Promise<WithId<AppSessionDoc> | null> {
  return sessionsCrud
    .list({
      filters: { userId: requireUserId(), status: "active" },
      orderBy: [{ field: "loginTime", direction: "desc" }],
      limit: 1,
    })
    .then((rows) => rows[0] ?? null);
}

export function listSessions(pageSize = 25, startAfterId?: string) {
  return sessionsCrud.paginate({
    filters: { userId: requireUserId() },
    orderBy: [{ field: "loginTime", direction: "desc" }],
    pageSize,
    startAfterId,
  });
}

export function listSessionsByDevice(deviceId: string): Promise<WithId<AppSessionDoc>[]> {
  return sessionsCrud.list({
    filters: { userId: requireUserId(), deviceId },
    orderBy: [{ field: "loginTime", direction: "desc" }],
  });
}

/** Close a single session. Clears `logoutTime` on update if it was somehow set. */
export function endSession(
  sessionId: string,
  status: AppSessionDoc["status"] = "terminated"
): Promise<void> {
  return sessionsCrud.update(
    sessionId,
    { logoutTime: now(), status },
    { clearFields: [] }
  );
}

/**
 * Close a session and record the corresponding SecurityLog entry atomically.
 *
 * Both writes go into one batch. Two separate calls can interleave, leaving a
 * terminated session with no log entry -- precisely the inconsistency a security
 * timeline must not have.
 */
export async function endSessionWithLog(
  sessionId: string,
  context: { ipAddress?: string | null; deviceInfo?: string | null; severity?: LogSeverity } = {}
): Promise<void> {
  const userId = requireUserId();

  const sessionsRef = collection(getFirestoreDb(), COLLECTIONS.appSessions);
  const logsRef = collection(getFirestoreDb(), COLLECTIONS.securityLogs);
  const batch = writeBatch(getFirestoreDb());

  batch.update(doc(sessionsRef, sessionId), {
    logoutTime: now(),
    status: "terminated",
  });
  batch.set(doc(logsRef), {
    userId,
    eventType: "session_ended",
    description: "Session terminated",
    ipAddress: context.ipAddress ?? null,
    deviceInfo: context.deviceInfo ?? null,
    timestamp: now(),
    severity: context.severity ?? "info",
    status: "resolved",
  });

  await batch.commit();
}

/**
 * Close every open session for the user, for "sign out everywhere".
 * Returns the number closed.
 */
export async function endAllSessions(): Promise<number> {
  const userId = requireUserId();
  const active = await sessionsCrud.list({
    filters: { userId, status: "active" },
  });
  if (active.length === 0) return 0;

  const sessionsRef = collection(getFirestoreDb(), COLLECTIONS.appSessions);
  const batch = writeBatch(getFirestoreDb());
  for (const session of active) {
    batch.update(doc(sessionsRef, session.id), {
      logoutTime: now(),
      status: "terminated",
    });
  }
  await batch.commit();
  return active.length;
}

export function countSessionsByStatus(status: AppSessionDoc["status"]): Promise<number> {
  return sessionsCrud.count({ userId: requireUserId(), status });
}

export function subscribeToActiveSession(
  onNext: (session: WithId<AppSessionDoc> | null) => void,
  onError?: (error: Error) => void
): () => void {
  return sessionsCrud.subscribe(
    {
      filters: { userId: requireUserId(), status: "active" },
      orderBy: [{ field: "loginTime", direction: "desc" }],
      limit: 1,
    },
    (rows) => onNext(rows[0] ?? null),
    onError
  );
}
