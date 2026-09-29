/**
 * Firebase Auth session bridge.
 *
 * ── The problem this solves ───────────────────────────────────────────────────
 * The app has two auth systems that do not know about each other:
 *
 *   1. `store/authStore.ts` — the Express API session (JWT in SecureStore,
 *      restored silently on launch via "Remember Me"). This is what the REST
 *      hooks in `hooks/useNetwork.ts`, `hooks/usePhishing.ts` and the generated
 *      `@workspace/api-client-react` hooks use.
 *   2. Firebase Auth — what `firestore.rules` actually checks. Every rule
 *      block starts with `signedIn()`, and the per-user blocks compare against
 *      `request.auth.uid`. Every service in `lib/firestore/services/` calls
 *      `requireUserId()`, which reads `getFirebaseAuth().currentUser`.
 *
 * Without a Firebase session, the Firestore modules in this app are inert: the
 * services throw `NotSignedInError` and the rules would deny the reads even if
 * they did not.
 *
 * ── Why the Firebase uid is the canonical user id ─────────────────────────────
 * The `mobile*` collections are keyed by the uid — `mobileProtectionSettings`
 * has the uid as its document ID, and every other document carries
 * `userId == uid`. `lib/firestore/schema.ts` states this explicitly. So the
 * Firebase uid, not `authStore`'s `user.id`, is what owns a user's data. That
 * holds only while the two identities refer to the same person, which is what
 * signing in with the same email and password achieves.
 *
 * ── Degradation, stated plainly ──────────────────────────────────────────────
 * `signInToFirebase` falls back to anonymous auth. That is a real fallback with
 * a real cost, and callers should surface it rather than pretend otherwise: an
 * anonymous uid is per-device, so the user's `mobile*` data does not follow them
 * to another device and is unreachable once the anonymous account is lost. The
 * session context re-exports `mode` so screens can show that state. Treat it as
 * a degraded mode to fix, not a working one.
 */

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";

import { getFirebaseAuth } from "./firebase";
import { clearPersistedFirebaseSession } from "./firebaseAuthPersistence";

/**
 * How the current Firebase session was established.
 *
 * - `identified` — email + password. The uid is stable across devices and is the
 *   uid the `mobile*` documents are keyed by. This is the only mode that
 *   behaves like a real account.
 * - `anonymous` — the degraded fallback. Per-device uid, no cross-device access.
 * - `none` — no Firebase session. Every Firestore service will throw; screens
 *   must render a signed-out state rather than an empty list.
 */
export type FirebaseSessionMode = "identified" | "anonymous" | "none";

export interface FirebaseSession {
  uid: string | null;
  email: string | null;
  mode: FirebaseSessionMode;
}

export interface FirebaseSignInResult {
  uid: string;
  mode: Exclude<FirebaseSessionMode, "none">;
  /** Set when the identified path failed and we dropped to anonymous. */
  degradedReason: string | null;
}

/** Classify an Auth user into a session mode. */
export function sessionModeOf(user: User | null): FirebaseSessionMode {
  if (!user) return "none";
  return user.isAnonymous ? "anonymous" : "identified";
}

function auth(): Auth {
  return getFirebaseAuth();
}

/** True when the error is "no such Firebase account", i.e. safe to create one. */
function isAccountMissing(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return (
    code === "auth/user-not-found" ||
    code === "auth/invalid-credential" ||
    // Newer SDKs mask "user not found" behind this code to avoid account
    // enumeration, so it is the same condition as far as we are concerned.
    code === "auth/invalid-login-credentials"
  );
}

/**
 * Sign in to Firebase Auth, escalating to anonymous auth if the identified path
 * is unavailable.
 *
 * Call this immediately after a successful REST login or register, while the
 * password is still in hand — it is never stored, and it is the only way to
 * obtain a Firebase session for an already-registered Shield account that has
 * no Firebase counterpart yet.
 *
 * Never let a throw here abort the REST login. The two sessions are
 * independent, and a Firebase outage should degrade the Firestore screens, not
 * lock the user out of the app.
 */
export async function signInToFirebase(input: {
  email: string;
  password: string;
}): Promise<FirebaseSignInResult> {
  const instance = auth();
  const email = input.email.trim().toLowerCase();

  // Already signed in as the right account: nothing to do. This is the common
  // case on a re-login without an intervening sign-out.
  const existing = instance.currentUser;
  if (existing && !existing.isAnonymous && existing.email === email) {
    return { uid: existing.uid, mode: "identified", degradedReason: null };
  }
  if (existing) await signOutOfFirebase();

  // Primary: the Shield account is already mirrored into Firebase Auth.
  try {
    const cred = await signInWithEmailAndPassword(instance, email, input.password);
    return { uid: cred.user.uid, mode: "identified", degradedReason: null };
  } catch (error) {
    if (!isAccountMissing(error)) {
      // Email/password provider disabled, network failure, too many attempts,
      // or a stored password that diverged from the REST copy. All of these
      // mean "we cannot identify this user", not "this user does not exist".
      return await anonymousFallback(error);
    }
  }

  // The Shield account predates the Firebase Auth mirror (or the REST password
  // was changed by the server without Firebase learning about it). Create the
  // counterpart so the uid is a real, stable, identified one from now on.
  try {
    const cred = await createUserWithEmailAndPassword(instance, email, input.password);
    return { uid: cred.user.uid, mode: "identified", degradedReason: null };
  } catch (error) {
    // `auth/email-already-in-use` lands here too: the account exists but our
    // sign-in was rejected, so the stored password differs. Anonymous is a
    // worse outcome than a wrong password, but the alternative is no Firestore
    // access at all, and the session context flags the degradation.
    return await anonymousFallback(error);
  }
}

/**
 * Obtain a Firebase session by any means available.
 *
 * Used for sign-in paths that never see a password — Google sign-in, the email
 * OTP flow, and app launch when a persisted Firebase session should already
 * exist. Returns the established session or `null` if Firebase is unreachable.
 */
export async function ensureFirebaseSession(): Promise<FirebaseSession | null> {
  const current = auth().currentUser;
  if (current) {
    return { uid: current.uid, email: current.email, mode: sessionModeOf(current) };
  }
  try {
    const cred = await signInAnonymously(auth());
    return { uid: cred.user.uid, email: null, mode: "anonymous" };
  } catch {
    return null;
  }
}

/**
 * Tear down the Firebase session and its persisted keys.
 *
 * Clearing storage is the part that matters: `signOut` alone leaves the
 * AsyncStorage entry, so the next user to sign in on a shared device could be
 * handed the previous user's cached Auth state on a cold start.
 */
export async function signOutOfFirebase(): Promise<void> {
  try {
    await signOut(auth());
  } catch {
    // Already signed out, or the instance is gone. The storage wipe below is
    // what actually matters, so a failure here is not fatal.
  }
  await clearPersistedFirebaseSession();
}

/**
 * Subscribe to Firebase Auth state.
 *
 * `onAuthStateChanged` fires once immediately with the restored session (or
 * `null`) before any sign-in, which is what lets the session context distinguish
 * "still restoring" from "signed out".
 */
export function onFirebaseAuthChanged(
  onNext: (user: User | null) => void,
  onError?: (error: Error) => void
): () => void {
  return onAuthStateChanged(auth(), onNext, (error) => onError?.(error));
}

/** Translate an Auth failure into something a user can act on. */
export function firebaseAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case "auth/network-request-failed":
      return "Can't reach Firebase. Check your connection.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a moment.";
    case "auth/operation-not-allowed":
      return "Email sign-in is disabled for this project.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    default:
      return error instanceof Error ? error.message : "Authentication failed.";
  }
}

function anonymousFallback(error: unknown): Promise<FirebaseSignInResult> {
  const code = (error as { code?: string } | null)?.code ?? "unknown";
  return signInAnonymously(auth())
    .then((cred) => ({
      uid: cred.user.uid,
      mode: "anonymous" as const,
      degradedReason:
        `Firebase sign-in failed (${code}); continuing with an anonymous session. ` +
        "Firestore data will not sync across devices until this is resolved.",
    }))
    .catch((anonError: unknown) => {
      // Anonymous is the last resort. If it fails too, Firebase is genuinely
      // unreachable or the project is misconfigured, and no Firestore service
      // can work. Surface that rather than returning a session that does not
      // exist -- callers render the signed-out state from a null uid.
      throw new Error(
        `Could not establish a Firebase session: ${firebaseAuthErrorMessage(anonError)} ` +
          `(original failure: ${code})`
      );
    });
}
