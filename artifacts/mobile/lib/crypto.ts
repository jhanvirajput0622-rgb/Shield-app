/**
 * End-to-end encryption for Shield.
 *
 * Architecture:
 * - Each device generates a 256-bit secret key on first launch (nacl.randomBytes)
 * - Key is stored in expo-secure-store (iOS Keychain / Android Keystore)
 * - Sensitive data (phishing URLs, location) is encrypted with nacl.secretbox
 *   before leaving the device — the server stores ciphertext it cannot read
 * - URL privacy: only a domain + hash is sent for phishing checks; the full
 *   URL is encrypted locally and the ciphertext is stored in the log
 */

import "react-native-get-random-values";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import nacl from "tweetnacl";
import {
  encodeBase64,
  decodeBase64,
  encodeUTF8,
  decodeUTF8,
} from "tweetnacl-util";

const KEY_STORAGE = "shield.e2e_key";

let _cachedKey: Uint8Array | null = null;

/** Read raw value from secure storage (SecureStore on native, AsyncStorage on web). */
async function secureRead(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

/** Write raw value to secure storage. */
async function secureWrite(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

/** Get (or generate) the device's persistent secret key from secure storage. */
export async function getDeviceKey(): Promise<Uint8Array> {
  if (_cachedKey) return _cachedKey;

  const stored = await secureRead(KEY_STORAGE);
  if (stored) {
    const decoded = decodeBase64(stored);
    if (!decoded || decoded.length !== nacl.secretbox.keyLength) {
      throw new Error("Stored device key is invalid or corrupted");
    }
    _cachedKey = decoded;
    return _cachedKey;
  }

  // First launch — generate a new 256-bit key and persist it securely
  const key = nacl.randomBytes(nacl.secretbox.keyLength);
  await secureWrite(KEY_STORAGE, encodeBase64(key));
  _cachedKey = key;
  return key;
}

/**
 * Encrypt a plaintext string with the device key (E2E — server stores
 * ciphertext but cannot decrypt it).
 */
export function encryptSensitive(plaintext: string, key: Uint8Array): string {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const msgBytes = decodeUTF8(plaintext);
  const box = nacl.secretbox(msgBytes, nonce, key);
  // Layout: [nonce (24 bytes) | ciphertext]
  const combined = new Uint8Array(nonce.length + box.length);
  combined.set(nonce);
  combined.set(box, nonce.length);
  return encodeBase64(combined);
}

/**
 * Decrypt a previously encrypted blob. Returns null if decryption fails
 * (wrong key, tampered data, etc.) — never throws.
 */
export function decryptSensitive(
  ciphertext: string,
  key: Uint8Array,
): string | null {
  try {
    const combined = decodeBase64(ciphertext);
    if (!combined) return null;

    const nonce = combined.slice(0, nacl.secretbox.nonceLength);
    const box = combined.slice(nacl.secretbox.nonceLength);
    const plainBytes = nacl.secretbox.open(box, nonce, key);
    if (!plainBytes) return null;
    return new TextDecoder().decode(plainBytes);
  } catch {
    return null;
  }
}

/**
 * Privacy-preserving URL fingerprint.
 * Sends only a short hash + the display domain to the backend so the server
 * never sees the full URL in plaintext.
 */
export function hashUrl(url: string): string {
  const bytes = decodeUTF8(url);
  const hash = nacl.hash(bytes); // SHA-512
  // Return first 16 hex chars (64-bit prefix) — enough for lookup, not enough to reverse
  return Array.from<number>(hash.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Extract registrable domain from a URL string (best-effort). */
export function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname;
  } catch {
    return url.slice(0, 64);
  }
}
