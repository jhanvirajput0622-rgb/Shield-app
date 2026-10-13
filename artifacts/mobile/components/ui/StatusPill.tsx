import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { riskBgColor, riskColor, RiskLevel } from "@/lib/utils";

interface StatusPillProps {
  risk: RiskLevel | string;
  label?: string;
  size?: "sm" | "md";
}

const LABELS: Record<string, string> = {
  safe: "Safe",
  low: "Low Risk",
  medium: "Medium",
  high: "High Risk",
  critical: "Critical",
  warning: "Warning",
  danger: "Danger",
  unknown: "Unknown",
  protected: "Protected",
  action_needed: "Action Needed",
  at_risk: "At Risk",
};

export function StatusPill({ risk, label, size = "md" }: StatusPillProps) {
  const fg = riskColor(risk);
  const bg = riskBgColor(risk);
  const displayLabel = label ?? LABELS[risk] ?? risk;

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: bg },
        size === "sm" && styles.pillSm,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text
        style={[styles.text, { color: fg }, size === "sm" && styles.textSm]}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 5,
    alignSelf: "flex-start",
  },
  pillSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  textSm: {
    fontSize: 11,
  },
});
