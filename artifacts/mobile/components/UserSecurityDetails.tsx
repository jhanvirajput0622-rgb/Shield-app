import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type {
  GetUserByIdData,
  ListSecurityLogsForUserData,
} from "@/src/generated/dataconnect";
import {
  getUserById,
  listSecurityLogsForUser,
} from "@/src/generated/dataconnect";
import { getShieldDataConnect } from "@/lib/dataConnect";
import colors from "@/constants/colors";

const c = colors.dark;

type User = GetUserByIdData["users"][number];
type SecurityLog = ListSecurityLogsForUserData["securityLogs"][number];

type Props = {
  userId: string;
};

export default function UserSecurityDetails({ userId }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      if (!userId.trim()) {
        setUser(null);
        setLogs([]);
        setError("A user ID is required.");
        setLoading(false);
        return;
      }

      try {
        const dc = getShieldDataConnect();
        const [userResult, logsResult] = await Promise.all([
          getUserById(dc, { id: userId }),
          listSecurityLogsForUser(dc),
        ]);

        if (!active) return;
        setUser(userResult.data.users[0] ?? null);
        setLogs(logsResult.data.securityLogs);
      } catch (cause: unknown) {
        if (!active) return;
        setUser(null);
        setLogs([]);
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load this user's security details.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [userId, reloadKey]);

  if (loading) {
    return (
      <View accessibilityRole="progressbar" style={styles.state}>
        <ActivityIndicator color={c.primary} />
        <Text style={styles.muted}>Loading security details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setReloadKey((key) => key + 1)}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : user ? (
        <>
          <View style={styles.profile}>
            <Text style={styles.title}>{user.name}</Text>
            <Text style={styles.body}>{user.email}</Text>
            <Text style={styles.muted}>Role: {user.role}</Text>
          </View>
          <Text style={styles.sectionTitle}>Security logs</Text>
          {logs.length === 0 ? (
            <Text style={styles.muted}>No security events recorded.</Text>
          ) : (
            logs.map((log) => (
              <View key={log.id} style={styles.log}>
                <Text style={styles.body}>{log.eventType}</Text>
                <Text style={styles.muted}>
                  {log.description || log.status} · {log.severity} · {new Date(log.timestamp).toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </>
      ) : (
        <Text style={styles.muted}>No user profile found for this ID.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  state: { alignItems: "center", gap: 10, paddingVertical: 20 },
  profile: { borderBottomColor: c.border, borderBottomWidth: 1, gap: 4, paddingBottom: 12 },
  title: { color: c.foreground, fontSize: 18, fontWeight: "700" },
  sectionTitle: { color: c.foreground, fontSize: 16, fontWeight: "700", marginTop: 4 },
  body: { color: c.foreground, fontSize: 14 },
  muted: { color: c.mutedForeground, fontSize: 13 },
  error: { color: c.danger, fontSize: 14, textAlign: "center" },
  log: { borderBottomColor: c.border, borderBottomWidth: 1, gap: 4, paddingVertical: 10 },
  retryButton: { paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { color: c.primary, fontSize: 14, fontWeight: "600" },
});