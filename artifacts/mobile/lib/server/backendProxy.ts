/**
 * Server-only helpers for Expo Router API routes (`app/**‍+api.ts`).
 *
 * ── Why a proxy ───────────────────────────────────────────────────────────────
 * Shield already has a complete, Firebase-backed auth service: the Express API
 * in `server/`. It owns password hashing, email OTP, 2FA, refresh-token
 * rotation and the Firebase custom-token bridge
 * (`server/src/services/firebaseAuth.service.ts`). Re-implementing that inside a
 * route handler would either duplicate it or silently drop features (2FA,
 * refresh, Google, OTP) from the login screen.
 *
 * So the Expo API routes are a thin, same-origin facade in front of that
 * service. The client calls `/api/auth/login` on the Expo origin, the route
 * forwards it to the Express origin, and the response is passed through
 * verbatim. The client keeps the exact `{ success, data }` envelope it already
 * parses, which means 2FA (`401 MFA_REQUIRED`) and refresh tokens keep working.
 *
 * This file is only ever imported by `+api.ts` route handlers, so its contents
 * are stripped from the client bundle by `expo/metro-config`.
 */

const METHODS_WITHOUT_BODY = new Set(["GET", "HEAD"]);

/**
 * Resolve the upstream Express API origin on the server.
 *
 * `EXPO_PUBLIC_API_URL` is the documented client value; `SHIELD_API_URL` is a
 * server-only override for when the server bundle runs somewhere the client's
 * public URL is not reachable (e.g. an internal deployment hostname).
 */
export function resolveBackendBaseUrl(): string | null {
  const raw = (
    process.env.SHIELD_API_URL ??
    process.env.API_URL ??
    process.env.EXPO_PUBLIC_API_URL ??
    ""
  ).trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

export class BackendUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackendUnavailableError";
  }
}

/**
 * Forward an incoming API-route Request to the Express backend.
 *
 * The body is buffered (not streamed) because the payloads here are small JSON
 * documents and reading it once keeps the method/body handling uniform. Auth
 * headers are forwarded so already-authenticated calls (`/logout`) keep their
 * bearer token.
 *
 * @param request      The inbound Request from the route handler.
 * @param upstreamPath Path on the Express server, e.g. `/api/auth/login`.
 */
export async function proxyToBackend(
  request: Request,
  upstreamPath: string
): Promise<Response> {
  const base = resolveBackendBaseUrl();
  if (!base) {
    return Response.json(
      {
        success: false,
        error: {
          message:
            "Auth backend is not configured. Set SHIELD_API_URL (or " +
            "EXPO_PUBLIC_API_URL) in the server environment.",
        },
      },
      { status: 503 }
    );
  }

  const incoming = new URL(request.url);
  const target = `${base}${upstreamPath}${incoming.search}`;

  const headers = new Headers();
  headers.set(
    "Content-Type",
    request.headers.get("content-type") ?? "application/json"
  );
  headers.set("Accept", "application/json");
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("Authorization", authorization);

  const method = request.method.toUpperCase();
  const body = METHODS_WITHOUT_BODY.has(method) ? undefined : await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: body ? body : undefined,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: {
          message: `Auth backend unreachable: ${
            error instanceof Error ? error.message : "network error"
          }`,
        },
      },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("Content-Type", contentType);
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) responseHeaders.set("Retry-After", retryAfter);

  const responseBody = await upstream.arrayBuffer();
  return new Response(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
