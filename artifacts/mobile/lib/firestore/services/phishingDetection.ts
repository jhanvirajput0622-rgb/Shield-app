/**
 * ERD entity 5 -- PhishingDetection.
 *
 * A two-phase record: created with `status: "pending"` and no result, then
 * updated once the scan resolves. That ordering matters for the UI — a pending
 * row is a scan in flight, and `result` being null is the signal, not an
 * omitted field.
 *
 * `riskScore` is 0-100 and is clamped on write. An unclamped score would make
 * the `riskScore >= 70` range query below return rows the UI then renders as
 * out of range.
 */

import { crud, now } from "../crud";
import type { PhishingDetectionDoc, ScanResult, ScanStatus, WithId } from "../schema";
import { requireUserId } from "./context";

const phishingCrud = crud("phishingDetections");

const RISK_MAX = 100;
const HIGH_RISK_THRESHOLD = 70;

function clampRisk(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.min(RISK_MAX, Math.max(0, Math.round(score)));
}

export interface CreateScanInput {
  url: string;
  riskScore?: number;
  status?: ScanStatus;
  result?: ScanResult | null;
  scannedAt?: Date | null;
}

/** Open a scan. Defaults to `pending` so a row is never briefly "no result". */
export async function createPhishingScan(input: CreateScanInput): Promise<string> {
  const data: PhishingDetectionDoc = {
    userId: requireUserId(),
    url: input.url,
    riskScore: clampRisk(input.riskScore ?? 0),
    status: input.status ?? "pending",
    scannedAt: null,
    result: input.result ?? null,
    createdAt: now(),
  };
  return phishingCrud.create(data);
}

/** Resolve a pending scan with its verdict. */
export function completeScan(
  phishingId: string,
  outcome: { riskScore: number; result: ScanResult; status?: ScanStatus }
): Promise<void> {
  return phishingCrud.update(phishingId, {
    riskScore: clampRisk(outcome.riskScore),
    result: outcome.result,
    status: outcome.status ?? "completed",
    scannedAt: now(),
  });
}

export function failScan(phishingId: string): Promise<void> {
  return phishingCrud.update(phishingId, { status: "failed", scannedAt: now() });
}

export function getScan(phishingId: string): Promise<WithId<PhishingDetectionDoc> | null> {
  return phishingCrud.get(phishingId);
}

export function listScans(pageSize = 25, startAfterId?: string) {
  return phishingCrud.paginate({
    filters: { userId: requireUserId() },
    orderBy: [{ field: "createdAt", direction: "desc" }],
    pageSize,
    startAfterId,
  });
}

export function listPendingScans(): Promise<WithId<PhishingDetectionDoc>[]> {
  return phishingCrud.list({
    filters: { userId: requireUserId(), status: "pending" },
    orderBy: [{ field: "createdAt", direction: "desc" }],
  });
}

export function listHighRiskScans(threshold = HIGH_RISK_THRESHOLD): Promise<WithId<PhishingDetectionDoc>[]> {
  return phishingCrud.list({
    filters: { userId: requireUserId() },
    // An inequality filter cannot be combined with `orderBy` on a different
    // field without a composite index; see firestore.indexes.json.
    ranges: [{ field: "riskScore", op: ">=", value: threshold }],
    orderBy: [{ field: "riskScore", direction: "desc" }],
  });
}

export function countScansByStatus(status: ScanStatus): Promise<number> {
  return phishingCrud.count({ userId: requireUserId(), status });
}

export async function removeScan(phishingId: string): Promise<void> {
  await phishingCrud.remove(phishingId);
}

export function subscribeToScans(
  onNext: (scans: WithId<PhishingDetectionDoc>[]) => void,
  onError?: (error: Error) => void
): () => void {
  return phishingCrud.subscribe(
    {
      filters: { userId: requireUserId() },
      orderBy: [{ field: "createdAt", direction: "desc" }],
      limit: 50,
    },
    onNext,
    onError
  );
}
