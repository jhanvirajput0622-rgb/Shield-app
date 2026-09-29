/**
 * Firebase client initialisation for the mobile app (project `shield-419e1`).
 *
 * ── Relationship to the REST API ─────────────────────────────────────────────
 * The app has two backends, and they are not interchangeable:
 *
 *   1. The Express API (lib/apiClient.ts) — authoritative, owns the existing
 *      25-collection schema in server/src/db/schema.ts, enforces validation in
 *      server/src/validators/ and ownership in the JWT middleware. Still the
 *      path for anything already implemented server-side.
 *   2. This Firestore client — the `mobile*` collections that model the ERD in
 *      lib/firestore/schema.ts. Scoped by its own rules block.
 *
 * The two write to disjoint paths, so they cannot corrupt each other. See the
 * header of lib/firestore/schema.ts for why the ERD is namespaced rather than
 * merged into the live collections.
 *
 * ── Auth ─────────────────────────────────────────────────────────────────────
 * Passwords are handled by Firebase Auth, not by a `password_hash` field.
 * Firestore rules can only scope access via `request.auth.uid`, so the ERD's
 * `user_id` primary key IS the Firebase uid, and every user-owned document
 * carries `userId == uid`. `mobileCredentials` exists to mirror a hash for
 * server-side use and is denied to all clients.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  connectAuthEmulator,
  type Auth,
} from "firebase/auth";
import { firebaseAuthPersistence } from "./firebaseAuthPersistence";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";

/**
 * Expo inlines `EXPO_PUBLIC_*` at build time, so these are static reads and not
 * a runtime lookup. Every one has a working default for `shield-419e1` so a
 * missing `.env` degrades to "wrong key" rather than "no app".
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyDTNPxDTFRzn6KxAAM0c8hVRoRERUb01nI",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "shield-419e1.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "shield-419e1",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "shield-419e1.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "637825924445",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "1:637825924445:android:1e8ad681e8f3018d8e7cb4",
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let emulatorsConnected = false;

function connectEmulators(instance: Auth, firestore: Firestore): void {
  if (emulatorsConnected) return;

  // Only in development. Point these at the emulators started by
  // `firebase emulators:start` (ports per firebase.json) so a device build
  // never talks to production data while developing.
  if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
    const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST ?? "10.0.2.2";
    // 9099 is the Auth emulator; 8080 is Firestore, per firebase.json.
    connectAuthEmulator(instance, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(firestore, host, 8080);
    emulatorsConnected = true;
  }
}

/**
 * Idempotently initialise and return the Firebase app, Auth and Firestore
 * instances. Safe to call from any module; the work happens once.
 */
export function ensureFirebaseInitialized(): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
} {
  if (!app || !auth || !db) {
    // `getApps()` first: Fast Refresh re-evaluates modules, and calling
    // initializeApp twice throws duplicate-app errors.
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    // `initializeAuth` rather than `getAuth`, so the Auth instance is created
    // with durable persistence. On React Native the default tier is in-memory,
    // which would leave the signed-in user null on every cold start while the
    // REST session (SecureStore) is still valid -- every Firestore service would
    // then throw NotSignedInError. Guarded by the `if` above, so the
    // already-initialized Auth error cannot fire on Fast Refresh re-evaluation.
    // See lib/firebaseAuthPersistence.ts.
    auth = firebaseAuthPersistence
      ? initializeAuth(app, { persistence: firebaseAuthPersistence })
      : getAuth(app);
    db = getFirestore(app);
    connectEmulators(auth, db);
  }

  return { app, auth, db };
}

export function getFirebaseAuth(): Auth {
  return ensureFirebaseInitialized().auth;
}

/**
 * Accessor used by lib/firestore/crud.ts. Throws rather than returning null so a
 * mis-ordered import surfaces at the call site instead of as a confusing
 * Firestore error later.
 */
export function getFirestoreDb(): Firestore {
  return ensureFirebaseInitialized().db;
}

export function getFirebaseApp(): FirebaseApp {
  return ensureFirebaseInitialized().app;
}

export const firebaseConfigForProject = firebaseConfig;
