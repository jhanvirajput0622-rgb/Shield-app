/**
 * VpnConnectionCard — the connect/disconnect control and session readout.
 *
 * ── Why the control is a button and not a `Switch` ────────────────────────────
 * Connecting is an operation with a handshake, a server-selection prerequisite
 * and two failure modes, not a boolean. A `Switch` implies "this is now on" the
 * instant it moves; here the tunnel is `connecting` for several seconds and may
 * never come up, and the user has to be able to tell those apart. The button
 * shows the phase and is disabled only where a second press would be incoherent.
 *
 * ── Why the IP is labelled "advertised" ───────────────────────────────────────
 * The address comes from the server catalogue, not from a transport that probed
 * the device. Presenting it as "your IP" would be a claim the app cannot back up,
 * so the caption says where it came from.
 */

import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import colors from "@/constants/colors";
import { StatusPill } from "@/components/ui/StatusPill";
import { CautionState } from "@/components/ui/CautionState";
import { formatDuration, type VpnUiState } from "@/hooks/firestore/useVpnConnection";

export interface VpnConnectionCardProps {
  state: VpnUiState;
  elapsedSeconds: number;
  onConnect: () => void;
  onDisconnect: () => void;
  onDismissError: () => void;
}

export function VpnConnectionCard({
  state,
  elapsedSeconds,
  onConnect,
  onDisconnect,
  onDismissError,
}: VpnConnectionCardProps) {
  const c = colors.dark;

  const isConnecting = state.phase === "connecting";
  const isDisconnecting = state.phase === "disconnecting";
  const connected = state.phase === "connected";

  const tone =
    state.phase === "error" ? c.danger : connected ? c.safe : isConnecting ? c.warning : c.mutedForeground;

  const headline =
    state.phase === "error"
      ? "Connection failed"
      : connected
        ? "Encrypted"
        : isConnecting
          ? "Connecting…"
          : isDisconnecting
            ? "Disconnecting…"
            : "Not protected";

  const server = state.phase === "connected" ? state.server : "server" in state ? state.server : null;

  return (
    <View style={[styles.card, { borderColor: `${tone}33` }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.label}>VPN Protection</Text>
          <Text style={[styles.status, { color: tone }]}>{headline}</Text>
        </View>

        {isConnecting || isDisconnecting ? (
          <ActivityIndicator size="large" color={tone} />
        ) : (
          <Pressable
            onPress={connected ? onDisconnect : onConnect}
            accessibilityRole="button"
            accessibilityLabel={connected ? "Disconnect VPN" : "Connect VPN"}
            style={({ pressed }) => [
              styles.toggle,
              {
                backgroundColor: connected ? `${c.safe}18` : `${c.danger}14`,
                borderColor: connected ? `${c.safe}50` : `${c.danger}50`,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather
              name={connected ? "lock" : "unlock"}
              size={26}
              color={connected ? c.safe : c.danger}
            />
          </Pressable>
        )}
      </View>

      {server ? (
        <View style={styles.serverRow}>
          <Text style={styles.serverFlag}>{server.flag}</Text>
          <Text style={styles.serverName} numberOfLines={1}>
            {server.city}, {server.country}
          </Text>
          {connected ? (
            <StatusPill risk="safe" label="Active" size="sm" />
          ) : isConnecting ? (
            <StatusPill risk="warning" label="Handshaking" size="sm" />
          ) : null}
        </View>
      ) : null}

      {state.phase === "error" ? (
        <CautionState
          title="Couldn't establish the tunnel"
          message={state.message}
          severity="error"
          onRetry={onConnect}
          retryLabel="Try Again"
          onDismiss={onDismissError}
          compact
        />
      ) : null}

      {connected ? (
        <View style={styles.sessionCard}>
          <Text style={styles.sessionTitle}>Session</Text>

          <SessionRow label="Elapsed" value={formatDuration(elapsedSeconds)} mono />
          <SessionRow
            label="Exit address"
            value={state.connection.ipAddress ?? "not assigned"}
            mono
          />
          <SessionRow label="Location" value={state.server?.city ?? state.connection.serverLocation} />
          <SessionRow label="Connected" value={formatWhen(state.connection.connectedAt)} />

          <View style={styles.disclosure}>
            <Feather name="info" size={11} color={c.textDisabled} />
            <Text style={styles.disclosureText}>
              The exit address is the one this location advertises. Shield records
              it as part of the session; it is not a live probe of your device.
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SessionRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const c = colors.dark;
  return (
    <View style={styles.sessionRow}>
      <Text style={styles.sessionLabel}>{label}</Text>
      <Text
        style={[styles.sessionValue, mono && { fontFamily: "monospace" }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function formatWhen(timestamp: Date): string {
  const when = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return Number.isNaN(when.getTime()) ? "unknown" : when.toLocaleString();
}

const c = colors.dark;
const styles = StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerText: { gap: 2 },
  label: { fontSize: 16, fontWeight: "700", color: c.foreground },
  status: { fontSize: 14, fontWeight: "600" },
  toggle: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  serverRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  serverFlag: { fontSize: 18 },
  serverName: { flex: 1, fontSize: 14, fontWeight: "500", color: c.foreground },
  sessionCard: {
    backgroundColor: c.elevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
    gap: 9,
  },
  sessionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: c.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sessionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  sessionLabel: { fontSize: 12, color: c.mutedForeground },
  sessionValue: {
    fontSize: 12,
    color: c.foreground,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
  disclosure: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 2 },
  disclosureText: { flex: 1, fontSize: 10, color: c.textDisabled, lineHeight: 15 },
});
