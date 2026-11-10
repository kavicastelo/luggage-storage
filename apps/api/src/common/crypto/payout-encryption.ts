import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { env } from "../../config/env.js";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";
const SALT = "luggage_payout_salt_v1";

let derivedKeyCache: Buffer | null = null;
let previousDerivedKeyCache: Buffer | null = null;

function getDerivedKey(): Buffer {
  if (derivedKeyCache) return derivedKeyCache;
  const rawKey = env.PAYOUT_ENCRYPTION_KEY;
  derivedKeyCache = scryptSync(rawKey, SALT, 32);
  return derivedKeyCache;
}

function getPreviousDerivedKey(): Buffer | null {
  if (previousDerivedKeyCache) return previousDerivedKeyCache;
  if (!env.PAYOUT_ENCRYPTION_KEY_PREVIOUS) return null;
  previousDerivedKeyCache = scryptSync(env.PAYOUT_ENCRYPTION_KEY_PREVIOUS, SALT, 32);
  return previousDerivedKeyCache;
}

/**
 * Resets the derived key cache (used during testing and key rotation verification).
 */
export function resetPayoutKeyCacheForTesting(): void {
  derivedKeyCache = null;
  previousDerivedKeyCache = null;
}

/**
 * Encrypts sensitive bank account numbers at rest using AES-256-GCM.
 * Safe to call repeatedly: if value is already encrypted, returns as-is.
 */
export function encryptPayoutAccountNumber(rawOrEncrypted: string | null | undefined): string | null {
  if (!rawOrEncrypted || rawOrEncrypted.trim() === "") return null;
  const value = rawOrEncrypted.trim();
  if (value.startsWith(PREFIX)) return value;

  const key = getDerivedKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts AES-256-GCM encrypted bank account numbers.
 * Backwards-compatible: if the value does not have the enc:v1: prefix, returns it as-is.
 * Supports zero-downtime key rotation: if decryption with the primary key fails,
 * attempts fallback to PAYOUT_ENCRYPTION_KEY_PREVIOUS if configured.
 */
export function decryptPayoutAccountNumber(encryptedOrPlain: string | null | undefined): string | null {
  if (!encryptedOrPlain || encryptedOrPlain.trim() === "") return null;
  const value = encryptedOrPlain.trim();
  if (!value.startsWith(PREFIX)) return value;

  try {
    const parts = value.slice(PREFIX.length).split(":");
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(cipherHex, "hex");

    // Attempt 1: Decrypt with primary key
    try {
      const key = getDerivedKey();
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString("utf8");
    } catch {
      // Attempt 2: Decrypt with previous key if configured during key rotation cutover
      const prevKey = getPreviousDerivedKey();
      if (prevKey) {
        const decipher = createDecipheriv(ALGORITHM, prevKey, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return decrypted.toString("utf8");
      }
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Re-encrypts an existing encrypted payout account number using the current primary key.
 * Used during batch key rotation to migrate historical records.
 */
export function reencryptPayoutAccountNumber(
  encryptedValue: string | null | undefined
): { reencrypted: string | null; neededRotation: boolean } {
  if (!encryptedValue) return { reencrypted: null, neededRotation: false };
  const decrypted = decryptPayoutAccountNumber(encryptedValue);
  if (!decrypted) return { reencrypted: null, neededRotation: false };

  const freshEncrypted = encryptPayoutAccountNumber(decrypted);
  return {
    reencrypted: freshEncrypted,
    neededRotation: freshEncrypted !== encryptedValue
  };
}

/**
 * Masks sensitive bank account numbers for normal API responses and UI displays.
 * e.g. "1234567890" -> "••••••••7890"
 */
export function maskPayoutAccountNumber(accountNumber: string | null | undefined): string | null {
  if (!accountNumber || accountNumber.trim() === "") return null;
  const plain = decryptPayoutAccountNumber(accountNumber) || accountNumber;
  const trimmed = plain.trim();
  if (trimmed.length <= 4) {
    return "****";
  }
  const lastFour = trimmed.slice(-4);
  const maskedPrefix = "•".repeat(Math.max(4, Math.min(trimmed.length - 4, 8)));
  return `${maskedPrefix}${lastFour}`;
}

