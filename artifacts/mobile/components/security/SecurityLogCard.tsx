/**
 * SecurityLogCard — one incident row in the security log.
 *
 * ── Why the timestamp is formatted twice ──────────────────────────────────────
 * `timeAgo` alone is unreadable for an incident you are deciding whether to act
 * on: "3h ago" does not tell you whether it happened before or after you left
 * the flat. So the relative time carries the absolute one next to it. The
 * separator is the log's own `deviceInfo` when present, since that is what
 * distinguishes "this phone" from "somewhere else".
 *
 * ── Why the record cannot be edited ───────────────────────────────────────────
 * `securityLogs` deliberately exposes no update besides `status`. This component
 * offers the two triage transitions and nothing else — no edit, no delete. A log
 * that can be rewritten is not an audit trail, and a UI affordance for editing
 * one would be a lie about what the system guarantees.
 */

import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import colors from "@/constants/colors";
import { riskColor } from "@/lib/utils";
import {
  SEVERITY_META,
  STATUS_META,
  TRIAGE_ACTIONS,
  type LogStatus,
  type SecurityLog,
} from "@/hooks/firestore/useSecurityLogs";

export interface SecurityLogCardProps {
  log: SecurityLog;
  onSetStatus: (logId: string, status: LogStatus) => void;
  /** True while this row's triage write is in flight. */
  isPending?: boolean;
  /** The next status to offer as the primary action, when not already applied. */
  primaryAction?: LogStatus;
}

export function SecurityLogCard({
  log,
  onSetStatus,
  isPending = false,
  primaryAction,
}: SecurityLogCardProps) {
  const c = colors.dark;
  const severity = SEVERITY_META[log.severity] ?? SEVERITY_META.info;
  const status = STATUS_META[log.status] ?? STATUS_META.open;
  const tone = riskColor(severity.risk);
  const isOpen = log.status === "open";

  // Prefer an explicit `primaryAction`; otherwise offer whichever triage
  // transition has not been applied yet. Never offer the transition the row is
  // already in.
  const suggested =
    primaryAction ?? TRIAGE_ACTIONS.find((action) => action.status !== log.status)?.status;

  return (
    <View
      style={[
        styles.card,
        { borderColor: isOpen ? `${tone}40` : c.border },
        isOpen && { backgroundColor: `${tone}0A` },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.severityIcon, { backgroundColor: `${tone}18` }]}>
          <Feather
            name={severity.icon as keyof typeof Feather.glyphMap}
            size={15}
            color={tone}
          />
        </View>

        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={styles.eventType} numberOfLines={1}>
              {log.eventType}
            </Text>
            {!isOpen ? (
              <View style={[styles.statusTag, { backgroundColor: `${riskColor(status.risk)}18` }]}>
                <Text
                  style={[styles.statusTagText, { color: riskColor(status.risk) }]}
                >
                  {status.label.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.severity, { color: tone }]}>{severity.label}</Text>
        </View>

        {isPending ? <ActivityIndicator size="small" color={c.primary} /> : null}
      </View>

      <Text style={styles.description}>{log.description}</Text>

      <View style={styles.metaRow}>
        <Feather name="clock" size={10} color={c.textDisabled} />
        <Text style={styles.meta}>
          {formatWhen(log.timestamp)}
        </Text>
        {log.ipAddress ? (
          <>
            <Feather name="globe" size={10} color={c.textDisabled} />
            <Text style={styles.meta} numberOfLines={1}>
              {log.ipAddress}
            </Text>
          </>
        ) : null}
        {log.deviceInfo ? (
          <>
            <Feather name="smartphone" size={10} color={c.textDisabled} />
            <Text style={styles.meta} numberOfLines={1}>
              {log.deviceInfo}
            </Text>
          </>
        ) : null}
      </View>

      {isOpen && suggested && !isPending ? (
        <Pressable
          style={[styles.actionBtn, { borderColor: `${tone}44` }]}
          onPress={() => onSetStatus(log.id, suggested)}
          accessibilityRole="button"
          accessibilityLabel={`Mark "${log.eventType}" as ${STATUS_META[suggested].label}`}
          activeOpacity={0.75}
        >
          <Feather
            name={TRIAGE_ACTIONS.find((a) => a.status === suggested)?.icon as "eye" | "check"}
            size={13}
            color={tone}
          />
          <Text style={[styles.actionText, { color: tone }]}>
            {TRIAGE_ACTIONS.find((a) => a.status === suggested)?.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Relative time with the absolute time attached.
 *
 * `toLocaleString` is used rather than a hand-rolled format so the locale
 * matches the device — a user reading a timestamp needs it in their own format
 * to match a bank statement or a carrier log.
 */
function formatWhen(timestamp: Date): string {
  const when = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(when.getTime())) return "unknown time";

  const diffMins = Math.max(0, Math.floor((Date.now() - when.getTime()) / 60_000));
  const relative =
    diffMins < 1
      ? "just now"
      : diffMins < 60
        ? `${diffMins}m ago`
        : diffMins < 1440
          ? `${Math.floor(diffMins / 60)}h ago`
          : `${Math.floor(diffMins / 1440)}d ago`;

  return `${relative} · ${when.toLocaleString()}`;
}

const c = colors.dark;
const styles = StyleSheet.create({
  card: {
    backgroundColor: c.elevated,
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
    gap: 9,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  severityIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eventType: { flex: 1, fontSize: 13, fontWeight: "600", color: c.foreground },
  statusTag: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  statusTagText: { fontSize: 8, fontWeight: "700", letterSpacing: 0.4 },
  severity: { fontSize: 11, fontWeight: "600" },
  description: { fontSize: 13, color: c.mutedForeground, lineHeight: 18 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  meta: { fontSize: 10, color: c.textDisabled },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    backgroundColor: `${c.primary}0D`,
  },
  actionText: { fontSize: 12, fontWeight: "600" },
});
