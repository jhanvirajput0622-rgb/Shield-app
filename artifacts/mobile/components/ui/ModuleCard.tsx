import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import colors from "@/constants/colors";
import { StatusPill } from "./StatusPill";
import { RiskLevel } from "@/lib/utils";

interface ModuleCardProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  statusLabel: string;
  risk: RiskLevel | string;
  onPress?: () => void;
}

export function ModuleCard({
  icon,
  title,
  statusLabel,
  risk,
  onPress,
}: ModuleCardProps) {
  const c = colors.dark;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.iconWrap}>
        <Feather name={icon} size={22} color={c.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.statusLabel} numberOfLines={1}>
        {statusLabel}
      </Text>
      <StatusPill risk={risk} size="sm" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.dark.elevated,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.dark.border,
    gap: 6,
    minHeight: 130,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: `${colors.dark.primary}18`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.dark.foreground,
  },
  statusLabel: {
    fontSize: 12,
    color: colors.dark.mutedForeground,
    lineHeight: 16,
  },
});
