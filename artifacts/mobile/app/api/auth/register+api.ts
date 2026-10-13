/**
 * POST /api/auth/register
 *
 * Same-origin Expo API route used by `app/register.tsx`. Proxies to the Shield
 * Express backend (`POST /api/auth/register`), which creates the account, the
 * Firestore profile and the Firebase Auth counterpart.
 */
import { proxyToBackend } from "@/lib/server/backendProxy";

export function POST(request: Request): Promise<Response> {
  return proxyToBackend(request, "/api/auth/register");
}
