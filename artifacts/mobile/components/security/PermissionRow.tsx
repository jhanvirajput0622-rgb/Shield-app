/**
 * PermissionRow — one (app, permission) pair with its grant state and actions.
 *
 * ── Why the actions are explicit rather than a single toggle ──────────────────
 * `PermissionStatus` has four values, and collapsing them into one on/off switch
 * loses the distinction the ERD cares about: `denied` (the user or the OS said
 * no) and `revoked` (it was taken away) are different facts. A two-state toggle
 * between them is a lie, so the row offers the two transitions the UI supports —
 * Grant and Revoke — and shows the current state as a label.
 *
 * The write is `setPermissionStatus`, which keeps `grantedAt`/`revokedAt`
 * coherent. The row is disabled while its own write is in flight so a double
 * press cannot interleave two contradictory updates.
 */

import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import colors from "@/constants/colors";
import { riskColor } from "@/lib/utils";
import {
  PERMISSION_STATUS_META,
  permissionMeta,
  type AppPermission,
  type PermissionStatus,
} from "@/hooks/firestore/useAppPermissions";

export interface PermissionRowProps {
  permission: AppPermission;
  onSetStatus: (permissionId: string, status: PermissionStatus) => void;
  /** True while this row's write is in flight. */
  isPending?: boolean;
}

export function PermissionRow({ permission, onSetStatus, isPending = false }: PermissionRowProps) {
  const c = colors.dark;
  const meta = permissionMeta(permission.permissionType);
  const status = PERMISSION_STATUS_META[permission.status] ?? PERMISSION_STATUS_META.pending;
  const tone = riskColor(status.risk);

  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: `${tone}14` }]}>
        <Feather name={meta.icon as keyof typeof Feather.glyphMap} size={15} color={tone} />
      </View>

      <View style={styles.text}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{meta.label}</Text>
          {meta.sensitive ? (
            <View style={styles.sensitiveTag}>
              <Text style={styles.sensitiveText}>SENSITIVE</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.status, { color: tone }]}>{status.label}</Text>
        {permission.grantedAt ? (
          <Text style={styles.timestamp}>
            Granted {permission.grantedAt.toLocaleDateString()}
          </Text>
        ) : null}
        {permission.revokedAt ? (
          <Text style={styles.timestamp}>
            Revoked {permission.revokedAt.toLocaleDateString()}
          </Text>
        ) : null}
      </View>

      {isPending ? (
        <ActivityIndicator size="small" color={c.primary} />
      ) : (
        <View style={styles.actions}>
          {!status.granted ? (
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                { borderColor: `${c.safe}50` },
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => onSetStatus(permission.id, "granted")}
              accessibilityRole="button"
              accessibilityLabel={`Grant ${meta.label} to ${permission.appName}`}
            >
              <Feather name="check" size={13} color={c.safe} />
            </Pressable>
          ) : null}
          {status.granted || permission.status === "denied" ? (
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                { borderColor: `${c.danger}50` },
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => onSetStatus(permission.id, "revoked")}
              accessibilityRole="button"
              accessibilityLabel={`Revoke ${meta.label} from ${permission.appName}`}
            >
              <Feather name="x" size={13} color={c.danger} />
            </Pressable>
          ) : null}
        </View>
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
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 14, fontWeight: "500", color: c.foreground },
  sensitiveTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: `${c.warning}18`,
  },
  sensitiveText: { fontSize: 8, fontWeight: "700", color: c.warning, letterSpacing: 0.4 },
  status: { fontSize: 12, fontWeight: "600" },
  timestamp: { fontSize: 11, color: c.textDisabled },
  actions: { flexDirection: "row", gap: 6 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: c.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
});
