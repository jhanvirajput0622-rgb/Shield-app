/**
 * POST /api/auth/logout
 *
 * Proxies to the Express backend so the refresh token is revoked server-side,
 * then the client clears its local session.
 */
import { proxyToBackend } from "@/lib/server/backendProxy";

export function POST(request: Request): Promise<Response> {
  return proxyToBackend(request, "/api/auth/logout");
}
