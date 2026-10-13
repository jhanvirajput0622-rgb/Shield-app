/**
 * ERD entity 9 -- SecurityLog.
 *
 * Append-only. There is no `updateSecurityLog` here on purpose: a log that can
 * be edited after the fact is not an audit trail. `status` is the one exception,
 * because acknowledging or resolving an alert is part of the workflow rather
 * than a revision of what happened, and the original text is never touched.
 *
 * These are high-volume and unbounded, so `listLogs` pages rather than
 * returning everything, and `trimLogs` exists because a device that logs every
 * scan will otherwise grow without limit.
 */

import { doc, writeBatch } from "firebase/firestore";

import { crud, now } from "../crud";
import { COLLECTIONS, type LogSeverity, type LogStatus, type SecurityLogDoc, type WithId } from "../schema";
import { getFirestoreDb } from "../../firebase";
import { requireUserId } from "./context";

const logsCrud = crud("securityLogs");

function logRef(id: string) {
  return doc(getFirestoreDb(), COLLECTIONS.securityLogs, id);
}

export interface LogSecurityEventInput {
  eventType: string;
  description: string;
  severity?: LogSeverity;
  ipAddress?: string | null;
  deviceInfo?: string | null;
  status?: LogStatus;
}

export async function logSecurityEvent(input: LogSecurityEventInput): Promise<string> {
  const data: SecurityLogDoc = {
    userId: requireUserId(),
    eventType: input.eventType,
    description: input.description,
    ipAddress: input.ipAddress ?? null,
    deviceInfo: input.deviceInfo ?? null,
    timestamp: now(),
    severity: input.severity ?? "info",
    status: input.status ?? "open",
  };
  return logsCrud.create(data);
}

export function getSecurityLog(logId: string): Promise<WithId<SecurityLogDoc> | null> {
  return logsCrud.get(logId);
}

/** Newest first. `timestamp` is the sort key and is never null. */
export function listLogs(pageSize = 25, startAfterId?: string) {
  return logsCrud.paginate({
    filters: { userId: requireUserId() },
    orderBy: [{ field: "timestamp", direction: "desc" }],
    pageSize,
    startAfterId,
  });
}

export function listLogsBySeverity(severity: LogSeverity): Promise<WithId<SecurityLogDoc>[]> {
  return logsCrud.list({
    filters: { userId: requireUserId(), severity },
    orderBy: [{ field: "timestamp", direction: "desc" }],
  });
}

export function listLogsByStatus(status: LogStatus): Promise<WithId<SecurityLogDoc>[]> {
  return logsCrud.list({
    filters: { userId: requireUserId(), status },
    orderBy: [{ field: "timestamp", direction: "desc" }],
  });
}

export function listLogsByEventType(eventType: string): Promise<WithId<SecurityLogDoc>[]> {
  return logsCrud.list({
    filters: { userId: requireUserId(), eventType },
    orderBy: [{ field: "timestamp", direction: "desc" }],
  });
}

/**
 * Triage transition. The only permitted mutation of a log document -- see the
 * header note on why the rest of the record is immutable.
 */
export function setLogStatus(logId: string, status: LogStatus): Promise<void> {
  return logsCrud.update(logId, { status });
}

/**
 * Acknowledge every open log of a severity in one batch, for the
 * "dismiss all critical" bulk action.
 */
export async function acknowledgeAllOpen(severity: LogSeverity): Promise<number> {
  const open = await logsCrud.list({
    filters: { userId: requireUserId(), status: "open", severity },
  });
  if (open.length === 0) return 0;

  const batch = writeBatch(getFirestoreDb());
  for (const entry of open) {
    batch.update(logRef(entry.id), { status: "acknowledged" });
  }
  await batch.commit();
  return open.length;
}

/**
 * Delete all but the newest `keep` logs.
 *
 * There is no server-side TTL on a client-written collection, so retention is
 * the client's responsibility. Deletes are chunked by the CRUD layer's
 * 400-per-batch ceiling, but the read is capped at Firestore's 10,000-document
 * query limit: a user with more log history than that keeps everything older
 * than the cap, because those rows are never seen.
 */
export async function trimLogs(keep = 500): Promise<number> {
  const all = await logsCrud.list({
    filters: { userId: requireUserId() },
    orderBy: [{ field: "timestamp", direction: "desc" }],
    limit: 10_000,
  });
  if (all.length <= keep) return 0;

  const stale = all.slice(keep);
  const batch = writeBatch(getFirestoreDb());
  for (const entry of stale) {
    batch.delete(logRef(entry.id));
  }
  await batch.commit();
  return stale.length;
}

export function countLogsByStatus(status: LogStatus): Promise<number> {
  return logsCrud.count({ userId: requireUserId(), status });
}

export function subscribeToLogs(
  onNext: (logs: WithId<SecurityLogDoc>[]) => void,
  onError?: (error: Error) => void
): () => void {
  return logsCrud.subscribe(
    {
      filters: { userId: requireUserId() },
      orderBy: [{ field: "timestamp", direction: "desc" }],
      limit: 50,
    },
    onNext,
    onError
  );
}
