/**
 * SessionGate — the banner shown when Firestore cannot be read.
 *
 * ── Why this component exists at all ──────────────────────────────────────────
 * The app has two backends (see lib/firebaseAuth.ts) and only one of them is
 * required for the REST screens to work. When Firebase is unreachable, signed
 * out, or degraded to anonymous, every `mobile*` screen has a genuine choice to
 * make between three wrong-looking options: show an empty list, show a spinner
 * forever, or show a green "all clear". The third is the dangerous one, and it is
 * the default a naive `catch` produces.
 *
 * So the state is named explicitly, once, and every Firestore screen renders it.
 * A screen that cannot read its data says so, in the user's terms, with the
 * reason and what to do about it.
 *
 * This is deliberately amber/red. Per the project's "never default to a false
 * sense of safety" rule, an unavailable security feed is not a passing state.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { CautionState } from "@/components/ui/CautionState";
import { useFirebaseSession } from "@/context/FirebaseSessionContext";

export interface SessionGateProps {
  /** True while the screen is still waiting for its first data. */
  isLoading: boolean;
  /** Non-null when the Firestore listener itself failed. */
  error?: Error | null;
  onRetry?: () => void;
}

/**
 * Render children only when Firestore is readable; otherwise explain why not.
 *
 * Returns `null` — not the caution — while loading, so a screen does not flash a
 * warning before its first snapshot arrives. Passing `isLoading` here rather than
 * reading it internally keeps the caller's own loading state authoritative.
 */
export function SessionGate({
  isLoading,
  error,
  onRetry,
  children,
}: SessionGateProps & { children: React.ReactNode }) {
  const { status, uid, mode, error: sessionError, isDegraded } = useFirebaseSession();

  // Still restoring the Auth session, or the first snapshot is in flight. Not a
  // warning state yet.
  if (isLoading || status === "restoring") return null;

  if (!uid) {
    return (
      <CautionState
        title="Security data unavailable"
        message={
          sessionError
            ? `Shield could not verify your session: ${sessionError}`
            : "Your session has no active verification, so protection settings, permissions, and logs cannot be read. Sign in again to restore them."
        }
        severity="error"
        onRetry={onRetry}
        retryLabel="Retry"
      />
    );
  }

  if (error) {
    return (
      <CautionState
        title="Couldn't read from the database"
        message={
          error.message.includes("PERMISSION_DENIED")
            ? "Your account isn't allowed to read this data. If you just changed accounts, sign out and back in."
            : `${error.message} — showing nothing until this resolves, rather than an empty list.`
        }
        severity="error"
        onRetry={onRetry}
        retryLabel="Retry"
      />
    );
  }

  if (isDegraded) {
    // `mode === "anonymous"`: a per-device uid. The data below is real and
    // readable, but it is not the account's data, so the user has to know before
    // they trust or act on it.
    return (
      <View style={styles.wrap}>
        <CautionState
          title="Not syncing to your account"
          message="You're signed in to Shield with an anonymous session, so this data stays on this device and will not follow you to another one. Sign out and in with your email to fix it."
          severity="caution"
          compact
        />
        <View style={styles.modeRow}>
          <Feather name="user" size={11} color="#5B6570" />
          <Text style={styles.modeText}>Session mode: {mode}</Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  modeRow: { flexDirection: "row", alignItems: "center", gap: 5, paddingLeft: 4 },
  modeText: { fontSize: 11, color: "#5B6570" },
});
