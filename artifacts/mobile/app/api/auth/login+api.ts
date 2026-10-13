/**
 * POST /api/auth/login
 *
 * Same-origin Expo API route used by `app/login.tsx`. Proxies to the Shield
 * Express backend (`POST /api/auth/login`), which owns password verification,
 * 2FA (`401 MFA_REQUIRED`) and Firebase session bridging. See
 * `lib/server/backendProxy.ts` for why this is a proxy rather than a
 * re-implementation.
 */
import { proxyToBackend } from "@/lib/server/backendProxy";

export function POST(request: Request): Promise<Response> {
  return proxyToBackend(request, "/api/auth/login");
}
