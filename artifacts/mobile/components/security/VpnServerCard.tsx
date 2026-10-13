/**
 * VpnServerCard — one location in the server picker.
 *
 * `load` and `latencyLabel` are catalogue values, not live measurements — see
 * lib/vpn/servers.ts for why there is no discovery endpoint. The card labels
 * them as estimates rather than presenting them as a ping, because a user will
 * otherwise read "12 ms" as something this device measured.
 */

import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import colors from "@/constants/colors";
import type { VpnServer } from "@/lib/vpn/servers";

export interface VpnServerCardProps {
  server: VpnServer;
  selected: boolean;
  /** The tunnel is up on this server. */
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
  isPending?: boolean;
}

export function VpnServerCard({
  server,
  selected,
  active,
  onPress,
  disabled = false,
  isPending = false,
}: VpnServerCardProps) {
  const c = colors.dark;
  const accent = active ? c.safe : selected ? c.primary : c.border;
  const loadTone = server.load >= 60 ? c.danger : server.load >= 40 ? c.warning : c.safe;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || isPending}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: disabled || isPending }}
      accessibilityLabel={`${server.city}, ${server.country}. Estimated load ${server.load} percent.${active ? " Connected." : ""}`}
      style={({ pressed }) => [
        styles.card,
        { borderColor: active ? `${c.safe}66` : selected ? `${c.primary}55` : c.border },
        selected && !active && { backgroundColor: `${c.primary}0A` },
        pressed && styles.pressed,
        (disabled || isPending) && styles.dimmed,
      ]}
    >
      <View style={styles.topRow}>
        <Text style={styles.flag}>{server.flag}</Text>
        <View style={styles.text}>
          <Text style={styles.city} numberOfLines={1}>
            {server.city}
          </Text>
          <Text style={styles.country} numberOfLines={1}>
            {server.country}
          </Text>
        </View>
        {isPending ? (
          <ActivityIndicator size="small" color={c.primary} />
        ) : active ? (
          <View style={[styles.activeTag, { backgroundColor: `${c.safe}18` }]}>
            <Feather name="lock" size={10} color={c.safe} />
            <Text style={[styles.activeText, { color: c.safe }]}>UP</Text>
          </View>
        ) : selected ? (
          <Feather name="check-circle" size={17} color={c.primary} />
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.meta}>
          {/* Labelled as an estimate: this device did not measure it. */}
          <Text style={styles.metaLabel}>~{server.latencyLabel}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={[styles.metaLabel, { color: loadTone }]}>{server.load}% load</Text>
        </View>
        {server.featured ? (
          <View style={styles.meta}>
            <Text style={[styles.metaLabel, { color: c.primary }]}>Priority</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const c = colors.dark;
const styles = StyleSheet.create({
  card: {
    backgroundColor: c.elevated,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  pressed: { opacity: 0.75 },
  dimmed: { opacity: 0.5 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  flag: { fontSize: 20 },
  text: { flex: 1, gap: 1 },
  city: { fontSize: 14, fontWeight: "600", color: c.foreground },
  country: { fontSize: 11, color: c.mutedForeground },
  activeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  activeText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.4 },
  metaRow: { flexDirection: "row", gap: 12 },
  meta: { flexDirection: "row", alignItems: "center" },
  metaLabel: { fontSize: 10, color: c.textDisabled, fontWeight: "500" },
});
