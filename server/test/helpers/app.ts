/**
 * Boots the real Shield Express application on an ephemeral port and exposes a
 * typed HTTP client for the suite.
 *
 * Why in-process rather than `supertest`/`fetch` against a spawned server:
 * mounting the actual `app` instance means the tests exercise the real
 * middleware chain, the real error handler and the real rate limiters. A
 * re-assembled router in a test would drift from production silently.
 *
 * `PORT=0` lets the OS pick a free port, so the suite can run concurrently with
 * a dev server on 3001 without colliding.
 */

import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// `env` must be imported first: it sets FIRESTORE_EMULATOR_HOST and the test
// secrets before config/firestore.ts and the rate limiters read them.
import "./env";

import { app } from "../../src/server";
import { connectFirestore, getFirestoreStatus } from "../../src/config/firestore";

export interface HttpResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

let server: Server | null = null;
let baseUrl = "";

export async function startTestServer(): Promise<string> {
  if (baseUrl) return baseUrl;

  await connectFirestore();

  // Fail loudly if the emulator is not actually reachable. Without this, every
  // test would fail with an opaque connection error instead of one clear cause.
  if (getFirestoreStatus() !== "connected") {
    throw new Error(
      `Firestore is not connected (status: ${getFirestoreStatus()}). ` +
        `Is the emulator running at ${process.env.FIRESTORE_EMULATOR_HOST}?`
    );
  }

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });

  const { port } = server!.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
  return baseUrl;
}

export async function stopTestServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
  baseUrl = "";
}

export function getBaseUrl(): string {
  if (!baseUrl) throw new Error("startTestServer() has not been called");
  return baseUrl;
}

export interface RequestOptions {
  token?: string | null;
  headers?: Record<string, string>;
  /** Forwarded as `x-forwarded-for`; auth controllers read it for audit logs. */
  ip?: string;
}

/**
 * Single JSON request helper. Returns the parsed body even for 4xx/5xx so tests
 * can assert on the error envelope instead of throwing.
 */
export async function request<T = any>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<HttpResponse<T>> {
  if (!baseUrl) throw new Error("startTestServer() has not been called");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.ip) headers["x-forwarded-for"] = options.ip;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  return { status: response.status, body: parsed as T, headers: response.headers };
}

export const get = <T = any>(path: string, options?: RequestOptions) =>
  request<T>("GET", path, undefined, options);
export const post = <T = any>(path: string, body?: unknown, options?: RequestOptions) =>
  request<T>("POST", path, body, options);
export const patch = <T = any>(path: string, body?: unknown, options?: RequestOptions) =>
  request<T>("PATCH", path, body, options);
export const del = <T = any>(path: string, options?: RequestOptions) =>
  request<T>("DELETE", path, undefined, options);

/** The standard success envelope: `{ success: true, data: ... }`. */
export function data<T = any>(response: HttpResponse<any>): T {
  return response.body?.data as T;
}
