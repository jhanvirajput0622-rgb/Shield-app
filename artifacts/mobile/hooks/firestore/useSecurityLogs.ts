/**
 * ERD entity 9 — SecurityLog, exposed to the UI.
 *
 * ── Append-only, with one exception ───────────────────────────────────────────
 * The service has no `updateSecurityLog` and that is not an oversight: a log
 * that can be edited is not an audit trail. `status` is the one field that moves,
 * because acknowledging or resolving an alert is workflow rather than revision
 * of what happened, and the original text is never touched. So the only mutation
 * this hook exposes is a triage transition — it does not offer "edit" or
 * "delete", and adding either would break the property the ERD is built on.
 *
 * ── Filtering is client-side and that is a real limit ─────────────────────────
 * `subscribeToLogs` is capped at 50 documents, and it is a single listener — one
 * Firestore read stream for the whole screen, rather than a new query per filter
 * tab. The consequence: the severity and status filters narrow what is *shown*
 * from those 50 rows, they do not re-query. A user with more than 50 incidents
 * cannot filter their way past row 50. The UI says how many are loaded and how
 * many matched, so the limit is visible rather than looking like "that's all of
 * them". Paging under `LISTEN_LIMIT` would need a paged listener, which Firestore
 * does not offer — the honest options are a higher limit or a server rollup.
 */

import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import {
  securityLogs,
  type LogSeverity,
  type LogStatus,
  type SecurityLogDoc,
  type WithId,
} from "@/lib/firestore";
import { useRealtimeQuery } from "./useRealtimeQuery";

export type { LogSeverity, LogStatus };
export type SecurityLog = WithId<SecurityLogDoc>;

export const SECURITY_LOGS_QUERY_KEY = ["firestore", "securityLogs"] as const;

/** Mirrors the 50-document ceiling in `securityLogs.subscribeToLogs`. */
export const LOGS_LISTEN_LIMIT = 50;

export const SEVERITY_ORDER: LogSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

export interface SeverityMeta {
  label: string;
  risk: "safe" | "warning" | "danger" | "critical";
  /** Sort weight — lower is more urgent. */
  rank: number;
  icon: "alert-octagon" | "alert-triangle" | "alert-circle" | "info" | "check-circle";
}

export const SEVERITY_META: Record<LogSeverity, SeverityMeta> = {
  critical: { label: "Critical", risk: "critical", rank: 0, icon: "alert-octagon" },
  high: { label: "High", risk: "danger", rank: 1, icon: "alert-triangle" },
  medium: { label: "Medium", risk: "warning", rank: 2, icon: "alert-circle" },
  low: { label: "Low", risk: "warning", rank: 3, icon: "info" },
  info: { label: "Info", risk: "safe", rank: 4, icon: "check-circle" },
};

export const STATUS_META: Record<LogStatus, { label: string; risk: "safe" | "warning" | "danger" }> = {
  open: { label: "Open", risk: "danger" },
  acknowledged: { label: "Acknowledged", risk: "warning" },
  resolved: { label: "Resolved", risk: "safe" },
  ignored: { label: "Ignored", risk: "safe" },
};

export type SeverityFilter = LogSeverity | "all";
export type StatusFilter = LogStatus | "all";

/** Only the two transitions the UI offers. The record itself stays immutable. */
export const TRIAGE_ACTIONS: { status: LogStatus; label: string; icon: string }[] = [
  { status: "acknowledged", label: "Acknowledge", icon: "eye" },
  { status: "resolved", label: "Resolve", icon: "check" },
];

export interface UseSecurityLogsResult {
  /** Every row the listener holds, newest first. */
  logs: SecurityLog[];
  /** `logs` after the active filters. */
  visibleLogs: SecurityLog[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isUnavailable: boolean;
  /** True when filters are hiding rows that exist. */
  isFiltered: boolean;
  counts: Record<LogStatus, number>;
  severityCounts: Record<LogSeverity, number>;
  openCount: number;
  criticalCount: number;
  severityFilter: SeverityFilter;
  statusFilter: StatusFilter;
  setSeverityFilter: (filter: SeverityFilter) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  clearFilters: () => void;
  /** Ids with an in-flight triage write, so rows can show a spinner. */
  pendingIds: ReadonlySet<string>;
  isTriaging: boolean;
  setStatus: (logId: string, status: LogStatus) => Promise<void>;
  acknowledgeAllOpen: (severity: LogSeverity) => Promise<void>;
  /** Write a new incident. Used by the other modules so their actions land here. */
  log: (input: {
    eventType: string;
    description: string;
    severity?: LogSeverity;
    ipAddress?: string | null;
    deviceInfo?: string | null;
  }) => Promise<void>;
}

export function useSecurityLogs(): UseSecurityLogsResult {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const realtime = useRealtimeQuery<SecurityLog[]>({
    queryKey: SECURITY_LOGS_QUERY_KEY,
    subscribe: ({ onData, onError }) => securityLogs.subscribeToLogs(onData, onError),
  });

  const logs = useMemo(() => realtime.data ?? [], [realtime.data]);

  const triageMutation = useMutation({
    mutationFn: ({ logId, status }: { logId: string; status: LogStatus }) =>
      securityLogs.setLogStatus(logId, status),
    onSuccess: () => void Haptics.selectionAsync(),
  });

  const bulkMutation = useMutation({
    mutationFn: (severity: LogSeverity) => securityLogs.acknowledgeAllOpen(severity),
  });

  const logMutation = useMutation({
    mutationFn: securityLogs.logSecurityEvent,
  });

  const visibleLogs = useMemo(
    () =>
      logs.filter(
        (log) =>
          (severityFilter === "all" || log.severity === severityFilter) &&
          (statusFilter === "all" || log.status === statusFilter)
      ),
    [logs, severityFilter, statusFilter]
  );

  const counts = useMemo<Record<LogStatus, number>>(
    () => ({
      open: logs.filter((log) => log.status === "open").length,
      acknowledged: logs.filter((log) => log.status === "acknowledged").length,
      resolved: logs.filter((log) => log.status === "resolved").length,
      ignored: logs.filter((log) => log.status === "ignored").length,
    }),
    [logs]
  );

  const severityCounts = useMemo<Record<LogSeverity, number>>(
    () => ({
      critical: logs.filter((log) => log.severity === "critical").length,
      high: logs.filter((log) => log.severity === "high").length,
      medium: logs.filter((log) => log.severity === "medium").length,
      low: logs.filter((log) => log.severity === "low").length,
      info: logs.filter((log) => log.severity === "info").length,
    }),
    [logs]
  );

  const setStatus = useCallback(
    async (logId: string, status: LogStatus) => {
      await triageMutation.mutateAsync({ logId, status });
    },
    [triageMutation]
  );

  const acknowledgeAllOpen = useCallback(
    async (severity: LogSeverity) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await bulkMutation.mutateAsync(severity);
    },
    [bulkMutation]
  );

  const log = useCallback<UseSecurityLogsResult["log"]>(
    async (input) => {
      await logMutation.mutateAsync(input);
    },
    [logMutation]
  );

  const pendingIds = useMemo(
    () =>
      new Set(
        triageMutation.isPending && triageMutation.variables
          ? [triageMutation.variables.logId]
          : []
      ),
    [triageMutation.isPending, triageMutation.variables]
  );

  return {
    logs,
    visibleLogs,
    isLoading: realtime.isPending,
    isError: realtime.subscriptionError !== null,
    error: realtime.subscriptionError,
    isUnavailable: realtime.isUnavailable,
    isFiltered: severityFilter !== "all" || statusFilter !== "all",
    counts,
    severityCounts,
    openCount: counts.open,
    criticalCount: severityCounts.critical,
    severityFilter,
    statusFilter,
    setSeverityFilter,
    setStatusFilter,
    clearFilters: () => {
      setSeverityFilter("all");
      setStatusFilter("all");
    },
    pendingIds,
    isTriaging: triageMutation.isPending,
    setStatus,
    acknowledgeAllOpen,
    log,
  };
}

/**
 * Turn an action in another module into a log row.
 *
 * Centralised so `eventType` stays a small closed vocabulary. The field is a
 * plain string in the ERD, which means nothing stops a typo from creating a new
 * "type" that the severity filter will never group — and `listLogsByEventType`
 * would return nothing for it.
 */
export const LOG_EVENTS = {
  settingsChanged: "settings.changed",
  permissionChanged: "permission.changed",
  permissionScan: "permission.scan",
  phishingScan: "phishing.scan",
  vpnConnected: "vpn.connected",
  vpnDisconnected: "vpn.disconnected",
  vpnFailed: "vpn.failed",
} as const;

export type LogEventType = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS];
