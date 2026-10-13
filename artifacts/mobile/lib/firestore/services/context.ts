/**
 * The signed-in uid, which every service needs in order to stamp `userId` on
 * write and to scope reads.
 *
 * Centralised so that "not signed in" fails in one place with one message,
 * instead of surfacing as a permission-denied error from Firestore that looks
 * like a rules bug.
 */

import { doc, getDoc } from "firebase/firestore";

import { getFirebaseAuth, getFirestoreDb } from "../../firebase";
import { COLLECTIONS } from "../schema";

export class NotSignedInError extends Error {
  constructor() {
    super(
      "No signed-in user. Await the first onAuthStateChanged callback before " +
        "using the Firestore services."
    );
    this.name = "NotSignedInError";
  }
}

/** The current uid, or `null` when signed out. */
export function currentUserId(): string | null {
  return getFirebaseAuth().currentUser?.uid ?? null;
}

/** The current uid, throwing `NotSignedInError` when signed out. */
export function requireUserId(): string {
  const uid = currentUserId();
  if (!uid) throw new NotSignedInError();
  return uid;
}

/**
 * True when the caller has a `mobileAdmins/{uid}` document.
 *
 * This mirrors the `isAdmin()` helper in firestore.rules. The rules check is the
 * one that matters — this is only so the UI can hide admin affordances instead
 * of letting the user tap into a permission error.
 */
export async function isAdmin(): Promise<boolean> {
  const uid = currentUserId();
  if (!uid) return false;
  const snap = await getDoc(doc(getFirestoreDb(), COLLECTIONS.admins, uid));
  return snap.exists();
}
