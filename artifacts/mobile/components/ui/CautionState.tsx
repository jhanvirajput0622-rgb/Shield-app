/**
 * CautionState — "never default to a false sense of safety."
 *
 * Use whenever a failure, timeout, or unknown state occurs.
 * This component NEVER shows a green "safe" state — it always shows amber or worse.
 */

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import colors from "@/constants/colors";

interface CautionStateProps {
  title: string;
  message: string;
  severity?: "caution" | "error";
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
  /**
   * Optional dismiss. Shown as a small ✕ rather than a second text button, so
   * the retry action stays the visually dominant one — a user who has read the
   * warning and wants it gone should not be offered a peer of "Try Again".
   */
  onDismiss?: () => void;
}

export function CautionState({
  title,
  message,
  severity = "caution",
  onRetry,
  retryLabel = "Try Again",
  compact = false,
  onDismiss,
}: CautionStateProps) {
  const c = colors.dark;
  const iconColor = severity === "error" ? c.danger : c.warning;
  const borderColor = severity === "error" ? `${c.danger}40` : `${c.warning}40`;
  const bgColor = severity === "error" ? `${c.danger}10` : `${c.warning}10`;

  return (
    <View
      style={[
        styles.container,
        { borderColor, backgroundColor: bgColor },
        compact && styles.compact,
      ]}
    >
      <Feather
        name={severity === "error" ? "alert-circle" : "alert-triangle"}
        size={compact ? 18 : 24}
        color={iconColor}
      />
      <View style={styles.textWrap}>
        <Text
          style={[
            styles.title,
            { color: iconColor },
            compact && styles.titleSm,
          ]}
        >
          {title}
        </Text>
        <Text style={[styles.message, compact && styles.messageSm]}>
          {message}
        </Text>
      </View>
      {onRetry && (
        <TouchableOpacity
          style={[styles.retryBtn, { borderColor: iconColor }]}
          onPress={onRetry}
        >
          <Text style={[styles.retryText, { color: iconColor }]}>
            {retryLabel}
          </Text>
        </TouchableOpacity>
      )}
      {onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          style={styles.dismissBtn}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={8}
        >
          <Feather name="x" size={16} color={c.textDisabled} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const c = colors.dark;
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexWrap: "wrap",
  },
  compact: {
    padding: 12,
    gap: 8,
  },
  textWrap: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  titleSm: {
    fontSize: 13,
  },
  message: {
    fontSize: 13,
    color: c.mutedForeground,
    lineHeight: 18,
  },
  messageSm: {
    fontSize: 12,
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  retryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  dismissBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
});
