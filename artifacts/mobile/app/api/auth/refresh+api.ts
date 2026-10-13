/**
 * POST /api/auth/refresh
 *
 * Exchanges a refresh token for a new access token via the Express backend.
 * Exposed here so the client can perform silent re-auth through the same
 * same-origin facade as login/register.
 */
import { proxyToBackend } from "@/lib/server/backendProxy";

export function POST(request: Request): Promise<Response> {
  return proxyToBackend(request, "/api/auth/refresh");
}
