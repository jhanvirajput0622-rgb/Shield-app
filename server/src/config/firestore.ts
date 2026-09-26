import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Typed against the ambient `FirebaseFirestore` namespace rather than the
 * `Firestore` type re-exported by "firebase-admin/firestore".
 *
 * `@google-cloud/firestore@7.11.6` ships two conflicting type surfaces:
 * `types/firestore.d.ts` (a complete ambient namespace with generic
 * `CollectionReference`/`Query` and `Firestore.batch()`) and
 * `build/src/index.d.ts` (the hand-written per-class surface, which does not
 * export `Firestore` at all). The `types` field in package.json points at the
 * former, but under `moduleResolution: node16` the imported `Firestore` resolves
 * to a stripped shape with no `batch()` and a non-generic `CollectionReference`.
 *
 * Rather than patch node_modules or force a dependency upgrade, this module
 * pins the type at the boundary so the rest of the codebase gets the real API.
 */
export type Firestore = FirebaseFirestore.Firestore;

let firestoreDb: Firestore | null = null;
export type FirestoreStatus = "not_configured" | "connecting" | "connected" | "error";

let firestoreStatus: FirestoreStatus = "not_configured";

export function isFirestoreConfigured(): boolean {
  return Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

export function getFirestoreStatus(): FirestoreStatus {
  return firestoreStatus;
}

export function initFirestore(): Firestore {
  if (!isFirestoreConfigured()) {
    throw new Error(
      "Firebase Admin SDK is not configured. Set FIREBASE_PROJECT_ID or GOOGLE_APPLICATION_CREDENTIALS before enabling Firestore migration."
    );
  }

  if (!getApps().length) {
    // The emulator needs a projectId but no credentials. Without a fallback the
    // Admin SDK throws "Failed to determine project ID" before it ever reaches
    // the emulator host, so tests would fail with a misleading error.
    const projectId =
      process.env.FIREBASE_PROJECT_ID ??
      process.env.GOOGLE_CLOUD_PROJECT ??
      (process.env.FIRESTORE_EMULATOR_HOST ? "demo-shield" : undefined);

    initializeApp({ projectId });
  }

  firestoreDb = getFirestore() as unknown as Firestore;
  return firestoreDb;
}

export function getFirestoreDb(): Firestore {
  if (!firestoreDb) {
    return initFirestore();
  }

  return firestoreDb;
}

export async function connectFirestore(): Promise<void> {
  if (!isFirestoreConfigured()) {
    firestoreStatus = "not_configured";
    return;
  }

  firestoreStatus = "connecting";

  try {
    await getFirestoreDb().collection("__health").limit(1).get();
    firestoreStatus = "connected";
  } catch (error) {
    firestoreStatus = "error";
    throw error;
  }
}
