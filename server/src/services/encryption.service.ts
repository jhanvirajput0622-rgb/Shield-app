import crypto from "crypto";
import { logger } from "../utils/logger";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const TOTP_PREFIX = "enc:v1:";

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "";
  if (!raw) {
    logger.warn("ENCRYPTION_KEY not set — using dev fallback (NOT for production)");
    return Buffer.alloc(32, "shield_dev_key_00000000000000000");
  }

  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }
  return key;
}

export function encryptDetails(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    getEncryptionKey(),
    iv
  ) as crypto.CipherGCM;
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptDetails(encrypted: string): string {
  const payload = Buffer.from(encrypted, "base64");
  if (payload.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid encrypted payload");
  }
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv) as crypto.DecipherGCM;
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function encryptTotpSecret(secret: string): string {
  return `${TOTP_PREFIX}${encryptDetails(secret)}`;
}

export function decryptTotpSecret(secret: string): string {
  return secret.startsWith(TOTP_PREFIX)
    ? decryptDetails(secret.slice(TOTP_PREFIX.length))
    : secret;
}

export function isTotpSecretEncrypted(secret: string): boolean {
  return secret.startsWith(TOTP_PREFIX);
}