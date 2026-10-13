/**
 * GET /api/auth/session
 *
 * Verifies a Firebase Auth ID token directly against Firebase's Identity
 * Toolkit REST API and returns the caller's uid/email.
 *
 * This is the direct-to-Firebase counterpart to the proxy routes: no Shield
 * backend is involved, only the public Firebase web API key (which is not a
 * secret — it ships in the client bundle already). Use it to prove the client's
 * Firebase session is live before reading the `mobile*` Firestore collections.
 *
 * Auth: `Authorization: Bearer <firebase-id-token>`
 */
export async function GET(request: Request): Promise<Response> {
  const header = request.headers.get("authorization") ?? "";
  const idToken = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";

  if (!idToken) {
    return Response.json(
      { success: false, error: { message: "Missing bearer ID token" } },
      { status: 401 }
    );
  }

  const apiKey = (
    process.env.FIREBASE_API_KEY ??
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ??
    ""
  ).trim();

  if (!apiKey) {
    return Response.json(
      {
        success: false,
        error: {
          message:
            "Firebase API key not configured. Set FIREBASE_API_KEY (or " +
            "EXPO_PUBLIC_FIREBASE_API_KEY) in the server environment.",
        },
      },
      { status: 503 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: {
          message: `Firebase unreachable: ${
            error instanceof Error ? error.message : "network error"
          }`,
        },
      },
      { status: 502 }
    );
  }

  const data = (await upstream.json().catch(() => null)) as {
    users?: Array<{
      localId?: string;
      email?: string;
      emailVerified?: boolean;
      displayName?: string;
    }>;
    error?: { message?: string };
  } | null;

  if (!upstream.ok || !data?.users?.length) {
    return Response.json(
      {
        success: false,
        error: {
          message: data?.error?.message ?? "Invalid or expired ID token",
        },
      },
      { status: 401 }
    );
  }

  const user = data.users[0];
  return Response.json({
    success: true,
    data: {
      uid: user.localId ?? null,
      email: user.email ?? null,
      emailVerified: user.emailVerified ?? false,
      displayName: user.displayName ?? null,
    },
  });
}
