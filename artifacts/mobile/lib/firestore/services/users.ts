/**
 * ERD entity 2 -- User.
 *
 * The document ID is the Firebase Auth uid, which is what makes the ownership
 * rules in firestore.rules expressible as `resource.data.userId == auth.uid`
 * without a second lookup. Uniqueness of `email` is enforced by the server via
 * `mobileUserEmails`; a client-side pre-check cannot be authoritative because
 * two concurrent registrations can both pass it.
 */

import { collection, doc, getDocs, onSnapshot, query, where } from "firebase/firestore";

import { crud, now } from "../crud";
import { COLLECTIONS, type UserDoc, type WithId } from "../schema";
import { getFirestoreDb } from "../../firebase";
import { requireUserId } from "./context";

const usersCrud = crud("users");

export interface CreateUserInput {
  name: string;
  email: string;
  phone?: string | null;
  profilePic?: string | null;
  /** Absent for self-registration; set when an admin creates the account. */
  adminId?: string | null;
}

/**
 * Create the profile document for an already-authenticated uid.
 *
 * Registration order matters: create the Firebase Auth user first, then call
 * this with the resulting uid. The uid cannot be chosen client-side, so a user
 * document cannot be created before its auth record exists.
 */
export async function createUserProfile(uid: string, input: CreateUserInput): Promise<string> {
  const data: UserDoc = {
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    profilePic: input.profilePic ?? null,
    // Default to the least-privileged role. An admin must be promoted
    // deliberately; never derive this from a client-supplied value.
    role: "user",
    isActive: true,
    createdAt: now(),
    lastLoginAt: null,
    adminId: input.adminId ?? null,
  };
  return usersCrud.createWithId(uid, data);
}

export function getUser(uid: string): Promise<WithId<UserDoc> | null> {
  return usersCrud.get(uid);
}

/** The signed-in user's own profile. */
export function getCurrentUser(): Promise<WithId<UserDoc> | null> {
  return usersCrud.get(requireUserId());
}

export function updateCurrentUser(changes: Partial<UserDoc>): Promise<void> {
  return usersCrud.update(requireUserId(), changes);
}

export function touchLastLogin(uid: string): Promise<void> {
  return usersCrud.update(uid, { lastLoginAt: now() });
}

export function setUserActive(uid: string, isActive: boolean): Promise<void> {
  return usersCrud.update(uid, { isActive });
}

/**
 * Best-effort client-side "is this email registered" check, for signup UX only.
 *
 * Reads `mobileUserEmails`, which firestore.rules denies to clients, so this
 * currently returns false for every address. It is kept as the documented call
 * site should the ledger ever be opened up; do not treat the result as an
 * authority check.
 */
export async function isEmailRegistered(_email: string): Promise<boolean> {
  const snapshot = await getDocs(
    query(
      collection(getFirestoreDb(), COLLECTIONS.userEmails),
      where("email", "==", _email.toLowerCase())
    )
  );
  return !snapshot.empty;
}

/** Docs a single admin manages (ERD: "One Admin manages many Users"). */
export function listUsersManagedBy(adminId: string): Promise<WithId<UserDoc>[]> {
  return usersCrud.list({
    filters: { adminId },
    orderBy: [{ field: "createdAt", direction: "desc" }],
  });
}

/** Realtime stream of the signed-in user's profile. */
export function subscribeToCurrentUser(
  onNext: (user: WithId<UserDoc> | null) => void,
  onError?: (error: Error) => void
): () => void {
  const uid = requireUserId();
  const ref = doc(getFirestoreDb(), COLLECTIONS.users, uid);
  return onSnapshot(
    ref,
    (snap) =>
      onNext(
        snap.exists() ? ({ ...(snap.data() as UserDoc), id: snap.id } as WithId<UserDoc>) : null
      ),
    (error) => onError?.(error)
  );
}
