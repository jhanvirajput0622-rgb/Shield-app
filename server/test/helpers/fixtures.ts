/**
 * Test fixtures.
 *
 * Everything is created through the real HTTP API rather than seeded directly,
 * so a fixture that stops working is a genuine regression signal rather than a
 * stale assumption about document shape. `seed`/`truncateAll` in ./db are for
 * the cases the API deliberately does not expose (see `threats` and
 * `notifications`, which have no write endpoint).
 */

import { post, data } from "./app";
import type { HttpResponse } from "./app";

/** Satisfies the registerSchema regex: upper, lower, digit, special, >= 8 chars. */
export const VALID_PASSWORD = "Str0ng!Passw0rd";

let counter = 0;

/**
 * Unique per call. `truncateAll()` runs between suites, so a fixed address would
 * collide with a document the previous suite left behind and turn a would-be
 * 409 into a 201 (or vice versa).
 */
export function uniqueEmail(prefix = "user"): string {
  counter += 1;
  return `${prefix}-${process.pid}-${Date.now()}-${counter}@shield.test`;
}

export interface TestUser {
  id: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
}

export interface TestUserOptions {
  email?: string;
  password?: string;
  displayName?: string;
  phoneNumber?: string;
}

/**
 * Registers a user and returns its tokens. Asserts the 201 itself so a broken
 * registration fails here with a useful message rather than as a confusing
 * downstream 401.
 */
export async function createUser(options: TestUserOptions = {}): Promise<TestUser> {
  const email = options.email ?? uniqueEmail();
  const password = options.password ?? VALID_PASSWORD;
  const displayName = options.displayName ?? "Test User";

  const response = await post<{ data: any }>("/api/auth/register", {
    email,
    password,
    displayName,
    name: displayName,
    ...(options.phoneNumber ? { phoneNumber: options.phoneNumber } : {}),
  });

  if (response.status !== 201) {
    throw new Error(
      `Fixture failed to register user: expected 201, got ${response.status} ${JSON.stringify(response.body)}`
    );
  }

  const payload = data(response);
  return {
    id: payload.user.id,
    email,
    displayName,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
  };
}

export interface TestDevice {
  id: string;
  deviceName: string;
  platform: string;
}

export interface TestDeviceOptions {
  deviceName?: string;
  platform?: "iOS" | "Android";
  osVersion?: string;
  appVersion?: string;
  deviceModel?: string;
  deviceKeyFingerprint?: string;
}

/** Registers a device against `user`'s access token. */
export async function createDevice(
  user: TestUser,
  options: TestDeviceOptions = {}
): Promise<TestDevice> {
  const response = await post<{ data: any }>(
    "/api/devices",
    {
      deviceName: options.deviceName ?? "Test Device",
      platform: options.platform ?? "Android",
      osVersion: options.osVersion ?? "14",
      appVersion: options.appVersion ?? "1.0.0",
      deviceModel: options.deviceModel ?? "Pixel 8",
      deviceKeyFingerprint: options.deviceKeyFingerprint ?? "fp-test",
    },
    { token: user.accessToken }
  );

  if (response.status !== 201) {
    throw new Error(
      `Fixture failed to register device: expected 201, got ${response.status} ${JSON.stringify(response.body)}`
    );
  }

  const payload = data(response);
  return {
    id: payload.id,
    deviceName: payload.deviceName,
    platform: payload.platform,
  };
}

/** Convenience: a user plus one registered device. */
export async function createUserWithDevice(
  options: TestUserOptions = {},
  deviceOptions: TestDeviceOptions = {}
): Promise<{ user: TestUser; device: TestDevice }> {
  const user = await createUser(options);
  const device = await createDevice(user, deviceOptions);
  return { user, device };
}

/** Unwraps the standard `{ success, data }` envelope or throws. */
export function expectSuccess<T = any>(response: HttpResponse<any>): T {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Expected 2xx, got ${response.status}: ${JSON.stringify(response.body)}`);
  }
  return data<T>(response);
}
