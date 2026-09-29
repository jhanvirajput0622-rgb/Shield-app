/**
 * ProtectionToggleRow — one switch in the Protection Settings screen.
 *
 * Extracted because the settings screen needs the row in three different states
 * (default, sensitive-with-gate, error), and inlining it three times is how the
 * variants drift apart. The switch is disabled while a write for *this* row is in
 * flight, so a double-tap cannot queue two contradictory writes and leave the
 * toggle disagreeing with the database.
 */

import React from "react";
import { ActivityIndicator, StyleSheet, Switch, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import colors from "@/constants/colors";
import type { ProtectionFlagMeta } from "@/hooks/firestore/useProtectionSettings";

export interface ProtectionToggleRowProps {
  meta: ProtectionFlagMeta;
  value: boolean;
  onToggle: (value: boolean) => void;
  /** True while this row's write is in flight. */
  isPending?: boolean;
  /** Set when the biometric gate refused the change. */
  blockedReason?: string | null;
  /** True on a device with enrolled biometrics, for the hint under the label. */
  biometricsAvailable?: boolean;
}

export function ProtectionToggleRow({
  meta,
  value,
  onToggle,
  isPending = false,
  blockedReason = null,
  biometricsAvailable = false,
}: ProtectionToggleRowProps) {
  const c = colors.dark;
  // A destructive flag that is ON is the state to make unmissable.
  const accent = meta.destructiveWhenEnabled && value ? c.critical : c.primary;
  const showGateHint = meta.requiresBiometric && biometricsAvailable && !blockedReason;

  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Feather name={meta.icon} size={16} color={value ? accent : c.mutedForeground} />
      </View>

      <View style={styles.text}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{meta.label}</Text>
          {meta.destructiveWhenEnabled && value ? (
            <View style={[styles.warnTag, { backgroundColor: `${c.critical}18` }]}>
              <Feather name="alert-triangle" size={9} color={c.critical} />
              <Text style={[styles.warnTagText, { color: c.critical }]}>ARMED</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.description}>{meta.description}</Text>

        {blockedReason ? (
          <Text style={[styles.hint, { color: c.warning }]}>{blockedReason}</Text>
        ) : showGateHint ? (
          <Text style={styles.hint}>Requires biometrics to enable</Text>
        ) : null}
      </View>

      {isPending ? (
        <View style={styles.switchSlot}>
          <ActivityIndicator size="small" color={accent} />
        </View>
      ) : (
        <Switch
          value={value}
          // `disabled` rather than ignoring onValueChange: a visibly inert
          // control explains itself, a live-looking one that ignores you does not.
          disabled={isPending}
          onValueChange={onToggle}
          trackColor={{ false: c.border, true: `${accent}60` }}
          thumbColor={value ? accent : c.textDisabled}
          ios_backgroundColor={c.border}
        />
      )}
    </View>
  );
}

const c = colors.dark;
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${c.primary}14`,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 3 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 14, fontWeight: "500", color: c.foreground },
  description: { fontSize: 12, color: c.mutedForeground, lineHeight: 17 },
  hint: { fontSize: 11, color: c.textDisabled, lineHeight: 15 },
  warnTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  warnTagText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.4 },
  switchSlot: { width: 51, alignItems: "flex-end" },
});
