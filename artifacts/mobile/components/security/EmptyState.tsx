/**
 * EmptyState — "nothing here", distinguished from "we can't tell".
 *
 * Every Firestore list in this app has three states, and conflating them is how
 * a security tool tells a user it found nothing when it actually failed to look:
 *
 *   1. Loading      → a spinner (or `SessionGate` returning null)
 *   2. Unavailable  → `SessionGate` / `CautionState`, amber or red
 *   3. Empty        → this component
 *
 * `CautionState`'s header says this explicitly ("never default to a false sense
 * of safety"), and this component is the other half of that rule: it is only ever
 * rendered when the read *succeeded* and genuinely returned nothing.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import colors from "@/constants/colors";

export interface EmptyStateProps {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  /** What the user can do next. Omit only when there is genuinely nothing. */
  message?: string;
  compact?: boolean;
}

export function EmptyState({
  icon = "inbox",
  title,
  message,
  compact = false,
}: EmptyStateProps) {
  const c = colors.dark;

  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View style={styles.iconWrap}>
        <Feather name={icon} size={compact ? 18 : 24} color={c.textDisabled} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const c = colors.dark;
const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 8, paddingVertical: 40, paddingHorizontal: 24 },
  compact: { paddingVertical: 20, gap: 6 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: c.elevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  // Grey, never green. An empty security feed is a neutral observation, not a
  // clean bill of health.
  title: { fontSize: 15, fontWeight: "600", color: c.foreground },
  message: { fontSize: 13, color: c.mutedForeground, textAlign: "center", lineHeight: 19 },
});
