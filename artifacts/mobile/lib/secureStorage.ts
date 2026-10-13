/**
 * Centralized secure storage utility for Shield.
 *
 * ROOT CAUSE FIX:
 *   expo-secure-store on iOS/Android only accepts keys matching:
 *     [A-Za-z0-9._-]
 *   Keys containing "@", "/", spaces or other special characters crash
 *   with: "Invalid key provided to SecureStore. Keys must not be empty
 *   and contain only alphanumeric characters, '-', '.', and '_'."
 *
 *   The old keys  "@shield/auth_token"  and  "@shield/refresh_token"
 *   were the root cause of every scan error and auth failure on native.
 *   They are replaced here with valid keys.
 *
 * Architecture:
 *   - Validate every key before calling SecureStore.
 *   - Use SecureStore on native (iOS Keychain / Android Keystore).
 *   - Fall back to AsyncStorage on web (SecureStore is not available there).
 *   - Never swallow errors silently — log them in dev, surface them to callers.
 */

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Valid key constants ──────────────────────────────────────────────────────
// All keys must match /^[A-Za-z0-9._-]+$/ for SecureStore compatibility.

export const SECURE_KEYS = {
  ACCESS_TOKEN: "shield_access_token",
  REFRESH_TOKEN: "shield_refresh_token",
  REMEMBER_ME: "shield_remember_me",
  DEVICE_KEY: "shield_device_key",
} as const;

type SecureKey = string;

// ─── Key validator ────────────────────────────────────────────────────────────

const VALID_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

function assertValidKey(key: SecureKey): void {
  if (!key || key.trim() === "") {
    throw new Error(`[secureStorage] Key must not be empty.`);
  }
  if (!VALID_KEY_PATTERN.test(key)) {
    throw new Error(
      `[secureStorage] Invalid key "${key}". ` +
        `Keys must only contain letters, digits, ".", "_", or "-".`
    );
  }
}

// ─── Core operations ──────────────────────────────────────────────────────────

/**
 * Store a value securely.
 * Uses SecureStore on native, AsyncStorage on web.
 */
export async function setSecureItem(key: SecureKey, value: string): Promise<void> {
  assertValidKey(key);
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

/**
 * Read a value from secure storage.
 * Returns null if the key does not exist.
 */
export async function getSecureItem(key: SecureKey): Promise<string | null> {
  assertValidKey(key);
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

/**
 * Delete a value from secure storage.
 * Silently succeeds if the key does not exist.
 */
export async function deleteSecureItem(key: SecureKey): Promise<void> {
  assertValidKey(key);
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

/**
 * Check whether a key exists in secure storage.
 */
export async function hasSecureItem(key: SecureKey): Promise<boolean> {
  const value = await getSecureItem(key);
  return value !== null;
}
