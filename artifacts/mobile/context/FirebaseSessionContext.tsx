/**
 * FirebaseSession — keeps Firebase Auth in step with the REST session.
 *
 * The app's identity lives in two places (see the header of lib/firebaseAuth.ts
 * for the full split). This provider owns the synchronisation between them so
 * that no screen has to:
 *
 *   - establishes the Firebase session on login / register / Google / OTP, while
 *     the password is still available to lib/firebaseAuth.ts;
 *   - mirrors REST sign-out into a Firebase sign-out;
 *   - exposes the resolved session so Firestore-backed screens can tell
 *     "restoring" from "signed out" from "degraded" instead of each of them
 *     re-deriving it from `getFirebaseAuth().currentUser`.
 *
 * ── Why `restoring` matters ───────────────────────────────────────────────────
 * `onAuthStateChanged` resolves asynchronously after a cold start, and so does
 * `authStore.rehydrate()`. A screen that reads either value on first render sees
 * `null` and would render a signed-out or empty state, then flip. Gating the
 * Firestore queries on `status === "ready"` removes the flash, and is also what
 * keeps `requireUserId()` from throwing during the window before the session
 * resolves.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  onFirebaseAuthChanged,
  signOutOfFirebase,
  type FirebaseSessionMode,
} from "@/lib/firebaseAuth";

export type FirebaseSessionStatus = "restoring" | "ready";

export interface FirebaseSessionState {
  /**
   * `null` while restoring, and permanently `null` when no Firebase session
   * could be established. Firestore services require a uid, so consumers must
   * treat `null` as "cannot read" rather than "no data".
   */
  uid: string | null;
  email: string | null;
  mode: FirebaseSessionMode;
  status: FirebaseSessionStatus;
  /**
   * True when `mode` is `anonymous`, meaning the uid is per-device and the
   * user's Firestore data is not shared across devices. Screens should say so.
   */
  isDegraded: boolean;
  /** Human-readable cause, set only when the session could not be established. */
  error: string | null;
  /** Tear the Firebase session down. Called by the REST sign-out flow. */
  signOut: () => Promise<void>;
}

const FirebaseSessionContext = createContext<FirebaseSessionState | null>(null);

export function FirebaseSessionProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [mode, setMode] = useState<FirebaseSessionMode>("none");
  const [status, setStatus] = useState<FirebaseSessionStatus>("restoring");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const unsubscribe = onFirebaseAuthChanged(
      (user) => {
        if (!active) return;
        setUid(user?.uid ?? null);
        setEmail(user?.email ?? null);
        setMode(user ? (user.isAnonymous ? "anonymous" : "identified") : "none");
        setError(null);
        // Fires once with the restored session (or null) on mount, so this is
        // also the signal that restoration finished.
        setStatus("ready");
      },
      (authError) => {
        if (!active) return;
        setError(authError.message);
        setStatus("ready");
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    setStatus("restoring");
    await signOutOfFirebase();
    // The `onAuthStateChanged` callback above is what clears these; the explicit
    // reset covers the case where the SDK delivers no event (already signed out
    // on a fresh launch) and we would otherwise sit on "restoring" forever.
    setUid(null);
    setEmail(null);
    setMode("none");
    setStatus("ready");
  }, []);

  const value = useMemo<FirebaseSessionState>(
    () => ({
      uid,
      email,
      mode,
      status,
      isDegraded: mode === "anonymous",
      error,
      signOut,
    }),
    [uid, email, mode, status, error, signOut]
  );

  return (
    <FirebaseSessionContext.Provider value={value}>{children}</FirebaseSessionContext.Provider>
  );
}

/**
 * Read the Firebase session.
 *
 * Throws outside a provider rather than returning a default: a default would
 * look like "signed out" and silently disable every Firestore query, which is
 * the exact failure this provider exists to prevent.
 */
export function useFirebaseSession(): FirebaseSessionState {
  const context = useContext(FirebaseSessionContext);
  if (!context) {
    throw new Error(
      "useFirebaseSession must be used inside a <FirebaseSessionProvider>. " +
        "Add it to app/_layout.tsx above the navigator."
    );
  }
  return context;
}

/**
 * True once a uid is available and Firestore reads are possible.
 *
 * Use this to gate queries: `enabled: sessionReady` keeps TanStack Query from
 * firing `requireUserId()` before the session resolves.
 */
export function useFirestoreReady(): boolean {
  const { status, uid } = useFirebaseSession();
  return status === "ready" && uid !== null;
}
