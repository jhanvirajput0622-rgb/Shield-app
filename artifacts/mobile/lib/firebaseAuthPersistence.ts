/**
 * Auth persistence for the mobile app.
 *
 * ── Why this file exists ──────────────────────────────────────────────────────
 * `lib/firebase.ts` calls `getAuth(app)`, which on React Native resolves to an
 * Auth instance with NO durable persistence: the signed-in user lives in memory
 * and is gone the moment the process is killed.
 *
 * That is survivable for a plain app, but not for this one. The REST session in
 * `store/authStore.ts` is persisted in SecureStore and restored silently on
 * launch ("Remember Me"), so on a cold start the user is looking at an
 * authenticated UI while `getFirebaseAuth().currentUser` is `null`. Every
 * Firestore service calls `requireUserId()` and would throw `NotSignedInError`,
 * and `firestore.rules` rejects the reads outright with `request.auth == null`.
 *
 * So Auth needs `LOCAL` persistence to line up with the REST session's lifetime.
 *
 * ── Why not `getReactNativePersistence` ───────────────────────────────────────
 * Firebase ships it, but only from the `react-native` conditional export of
 * `@firebase/auth`. This project's tsconfig resolves types through the default
 * condition (`auth-public.d.ts`), which omits the symbol, so importing it is a
 * type error. Implementing the `PersistenceInternal` contract directly is the
 * same thing the helper does, and it is the only version that typechecks here.
 * See lib/firebase.ts for where this is wired into `initializeAuth`.
 */

import { Platform } from "react-native";
import type { Persistence } from "firebase/auth";

import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Keys are namespaced because `getReactNativePersistence` uses bare names, and
 * this app shares AsyncStorage with the onboarding flag and the token fallback
 * used on web. A collision with an unrelated `firebase:*` key would make Auth
 * fail to parse its own session.
 */
const KEY_PREFIX = "shield.firebase.auth";

/**
 * The `Persistence` contract as the SDK actually consumes it.
 *
 * `Persistence` is public but declares only `type`; the `_`-prefixed members are
 * internal to `@firebase/auth`. Declaring them here (rather than importing the
 * internal type, which is not exported) keeps the shape in one place and lets
 * the cast at the bottom of the file be the single boundary.
 */
interface PersistenceInternal extends Persistence {
  _isAvailable(): Promise<boolean>;
  _set(key: string, value: Record<string, unknown> | string): Promise<void>;
  _get<T>(key: string): Promise<T | null>;
  _remove(key: string): Promise<void>;
  _addListener(key: string, listener: (event: unknown) => void): void;
  _removeListener(key: string, listener: (event: unknown) => void): void;
}

/** Listeners the SDK registers for cross-tab/storage sync. */
const listeners = new Map<string, Set<(event: unknown) => void>>();

function emit(key: string, event: unknown): void {
  const forKey = listeners.get(key);
  if (!forKey) return;
  for (const listener of forKey) {
    try {
      listener(event);
    } catch {
      // A throwing listener must not take down the auth write that triggered it.
    }
  }
}

const asyncStoragePersistence: PersistenceInternal = {
  // `LOCAL`, not `SESSION`: the session must outlive the process, matching the
  // REST session's SecureStore lifetime. A `SESSION` tier would drop the user on
  // every cold start and reintroduce the mismatch described in the header.
  type: "LOCAL",

  async _isAvailable() {
    return true;
  },

  async _set(key, value) {
    const namespaced = `${KEY_PREFIX}:${key}`;
    await AsyncStorage.setItem(namespaced, JSON.stringify(value));
    emit(namespaced, { key: namespaced, newValue: value });
  },

  async _get<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(`${KEY_PREFIX}:${key}`);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Corrupt entry (interrupted write, or a key written by an older build
      // with a different value format). Drop it rather than wedging every
      // subsequent launch on a parse failure.
      await AsyncStorage.removeItem(`${KEY_PREFIX}:${key}`);
      return null;
    }
  },

  async _remove(key) {
    const namespaced = `${KEY_PREFIX}:${key}`;
    await AsyncStorage.removeItem(namespaced);
    emit(namespaced, { key: namespaced, newValue: null });
  },

  _addListener(key, listener) {
    const namespaced = `${KEY_PREFIX}:${key}`;
    const existing = listeners.get(namespaced);
    if (existing) existing.add(listener);
    else listeners.set(namespaced, new Set([listener]));
  },

  _removeListener(key, listener) {
    const forKey = listeners.get(`${KEY_PREFIX}:${key}`);
    if (!forKey) return;
    forKey.delete(listener);
    if (forKey.size === 0) listeners.delete(`${KEY_PREFIX}:${key}`);
  },
};

/**
 * `browserLocalPersistence` on web, AsyncStorage-backed on native.
 *
 * Web keeps the SDK's own implementation: in a browser `localStorage` is always
 * present and indexedDB is available, so there is nothing to add, and routing
 * through AsyncStorage's web shim (localStorage anyway) would add a failure
 * mode for no gain.
 */
export const firebaseAuthPersistence: Persistence =
  Platform.OS === "web" ? undefined : (asyncStoragePersistence as Persistence);

/**
 * Wipe every persisted Auth key. Called on sign-out so the next account on the
 * device does not inherit the previous user's Firestore session.
 */
export async function clearPersistedFirebaseSession(): Promise<void> {
  if (Platform.OS === "web") return;
  const keys = await AsyncStorage.getAllKeys();
  const ours = keys.filter((key) => key.startsWith(`${KEY_PREFIX}:`));
  if (ours.length > 0) await AsyncStorage.multiRemove(ours);
}
