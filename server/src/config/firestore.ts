import { getApps, initializeApp } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";

let firestoreDb: Firestore | null = null;
export type FirestoreStatus = "not_configured" | "connecting" | "connected" | "error";

let firestoreStatus: FirestoreStatus = "not_configured";

export function isFirestoreConfigured(): boolean {
  return Boolean(
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
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT,
    });
  }

  firestoreDb = getFirestore();
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
