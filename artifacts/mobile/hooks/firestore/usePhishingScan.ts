/**
 * ERD entity 5 — PhishingDetection, exposed to the UI.
 *
 * ── The two-phase write, and why the UI depends on it ─────────────────────────
 * `PhishingDetectionDoc` is written in two steps: `createPhishingScan` opens a
 * row with `status: "pending"` and no result, then `completeScan` or `failScan`
 * resolves it. The service header is explicit that a pending row is a scan *in
 * flight* and that `result === null` is the signal — not an omitted field.
 *
 * That is what makes the lifecycle legible on the screen: a row with
 * `result === null` and `status === "pending"` is genuinely still running, and
 * rendering it as a blank or as "safe" would be a lie in a security tool. The
 * scan itself is synchronous and local (see lib/phishing/riskEngine.ts), so
 * pending is brief — but a scan interrupted by the app being backgrounded leaves
 * a real pending row behind, and this hook surfaces those as "unverified" rather
 * than hiding them.
 */

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import {
  phishingDetection,
  type PhishingDetectionDoc,
  type ScanResult,
  type ScanStatus,
  type WithId,
} from "@/lib/firestore";
import { assessUrl, RESULT_LABEL, type RiskAssessment } from "@/lib/phishing/riskEngine";
import { useRealtimeQuery } from "./useRealtimeQuery";

export type { ScanResult, ScanStatus };
export type PhishingScan = WithId<PhishingDetectionDoc>;

export const PHISHING_SCANS_QUERY_KEY = ["firestore", "phishingScans"] as const;

export interface UsePhishingScanResult {
  scans: PhishingScan[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isUnavailable: boolean;
  isScanning: boolean;
  /** The scan that just resolved, for the result panel. Null before any run. */
  latest: PhishingScan | null;
  /** Local assessment of `latest`, with the signals that produced the score. */
  assessment: RiskAssessment | null;
  totalScanned: number;
  threatsBlocked: number;
  suspiciousCount: number;
  /** Rows left `pending` by an interrupted scan. */
  stuckCount: number;
  scanUrl: (url: string) => Promise<RiskAssessment>;
  clearHistory: () => Promise<void>;
  removeScan: (scanId: string) => Promise<void>;
}

export function usePhishingScan(): UsePhishingScanResult {
  const queryClient = useQueryClient();
  const [latestId, setLatestId] = useState<string | null>(null);
  /**
   * The assessment from the most recent run, held locally so a result can be
   * shown even when no row was written.
   *
   * That case is real: input that does not parse is rejected before the
   * two-phase write, so there is no document to read the verdict back from.
   * Without this the panel would silently show the *previous* scan's result
   * under a URL the user just typed, which is worse than showing nothing.
   */
  const [lastAssessment, setLastAssessment] = useState<RiskAssessment | null>(null);

  const realtime = useRealtimeQuery<PhishingScan[]>({
    queryKey: PHISHING_SCANS_QUERY_KEY,
    subscribe: ({ onData, onError }) => phishingDetection.subscribeToScans(onData, onError),
  });

  const scans = useMemo(() => realtime.data ?? [], [realtime.data]);

  const scanMutation = useMutation({
    mutationFn: async (url: string): Promise<{ id: string; assessment: RiskAssessment }> => {
      const assessment = assessUrl(url);

      // Do not open a row for input we could not even parse. A row with an empty
      // `url` would be a permanent artefact in the user's history that says
      // nothing.
      if (assessment.parseError) {
        return { id: "", assessment };
      }

      // Phase 1: the row exists before the verdict does, so a crash mid-scan
      // leaves a `pending` record rather than no evidence that it ever ran.
      const id = await phishingDetection.createPhishingScan({ url });

      // Phase 2: resolve it. A failure here is recorded rather than thrown away,
      // because "we tried and could not verify" is itself a result the user
      // should see.
      try {
        await phishingDetection.completeScan(id, {
          riskScore: assessment.score,
          result: assessment.result,
        });
      } catch (error) {
        await phishingDetection.failScan(id).catch(() => {});
        throw error;
      }

      return { id, assessment };
    },
    onSuccess: ({ id, assessment }) => {
      setLatestId(id || null);
      setLastAssessment(assessment);
      void queryClient.invalidateQueries({ queryKey: PHISHING_SCANS_QUERY_KEY });
      if (assessment.result === "malicious") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (assessment.result === "unknown") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: (scanId: string) => phishingDetection.removeScan(scanId),
    onSuccess: () => {
      setLatestId(null);
      void queryClient.invalidateQueries({ queryKey: PHISHING_SCANS_QUERY_KEY });
    },
  });

  const latest = useMemo(() => {
    if (latestId) {
      const match = scans.find((scan) => scan.id === latestId);
      if (match) return match;
    }
    return scans[0] ?? null;
  }, [latestId, scans]);

  /**
   * Prefer the locally held assessment for the most recent run; fall back to
   * re-deriving it from the stored row.
   *
   * Re-running the pure analyser is deterministic, so the signals shown always
   * match the score shown. The persisted document holds only the score and the
   * verdict — the ERD has no field for the signals — and adding one is a schema
   * change rather than a client change. Rows that never resolved are skipped:
   * there is no verdict to explain.
   */
  const assessment = useMemo(() => {
    if (lastAssessment) return lastAssessment;
    if (!latest || latest.result === null) return null;
    return assessUrl(latest.url);
  }, [lastAssessment, latest]);

  const scanUrl = useCallback(
    async (url: string) => {
      setLatestId(null);
      setLastAssessment(null);
      const { assessment: result } = await scanMutation.mutateAsync(url);
      return result;
    },
    [scanMutation]
  );

  const clearHistory = useCallback(async () => {
    // No bulk-delete service exists — `securityLogs.trimLogs` is for logs, and
    // scans are user-visible history. Deleting row by row keeps the same
    // semantics without adding a service method for a one-off action.
    for (const scan of scans) {
      await phishingDetection.removeScan(scan.id);
    }
    setLatestId(null);
    setLastAssessment(null);
    void queryClient.invalidateQueries({ queryKey: PHISHING_SCANS_QUERY_KEY });
  }, [scans, queryClient]);

  return {
    scans,
    isLoading: realtime.isPending,
    isError: realtime.subscriptionError !== null,
    error: realtime.subscriptionError,
    isUnavailable: realtime.isUnavailable,
    isScanning: scanMutation.isPending,
    latest,
    assessment,
    totalScanned: scans.filter((scan) => scan.result !== null).length,
    threatsBlocked: scans.filter((scan) => scan.result === "malicious").length,
    suspiciousCount: scans.filter((scan) => scan.result === "suspicious").length,
    stuckCount: scans.filter(
      (scan) => scan.result === null && scan.status === "pending"
    ).length,
    scanUrl,
    clearHistory,
    removeScan: async (scanId: string) => {
      await removeMutation.mutateAsync(scanId);
    },
  };
}

export { RESULT_LABEL };
