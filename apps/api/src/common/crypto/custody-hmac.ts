import crypto from "node:crypto";
import { env } from "../../config/env.js";

export const CUSTODY_HASH_VERSION = "hmac-sha256-v2" as const;
export const LEGACY_CUSTODY_HASH_VERSION = "sha256-legacy-v1" as const;

export type CustodyCredentialPurpose = "CUSTODY_QR" | "CUSTODY_PIN";
export type CustodyOperationKind = "CHECK_IN" | "COLLECTION";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QR_TOKEN_HEX_REGEX = /^[0-9a-f]{64}$/i;
const PIN_SIX_DIGIT_REGEX = /^\d{6}$/;
const HMAC_HEX_DIGEST_REGEX = /^[0-9a-f]{64}$/i;

function resolveValidatedCustodySecret(secretOverride?: string): string {
  const secret = (secretOverride ?? env.CUSTODY_TOKEN_HMAC_SECRET ?? "").trim();
  if (secret.length < 32) {
    throw new Error(
      "CUSTODY_TOKEN_HMAC_SECRET must be configured with at least 32 characters"
    );
  }
  return secret;
}

function normalizeAndValidateBookingId(bookingId: string): string {
  const normalized = bookingId.trim().toLowerCase();
  if (!UUID_REGEX.test(normalized)) {
    throw new Error("Invalid bookingId for custody credential HMAC");
  }
  return normalized;
}

function normalizeAndValidateCredential(
  purpose: CustodyCredentialPurpose,
  credential: string
): string {
  const trimmed = credential.trim();
  if (purpose === "CUSTODY_QR") {
    if (!QR_TOKEN_HEX_REGEX.test(trimmed)) {
      throw new Error("Invalid custody QR token format");
    }
    return trimmed.toLowerCase();
  }

  // Exact 6 ASCII digits preserving leading zeros ("000000".."999999")
  if (!PIN_SIX_DIGIT_REGEX.test(trimmed)) {
    throw new Error("Invalid 6-digit custody verification PIN format");
  }
  return trimmed;
}

function buildCanonicalCustodyHmacInput(params: {
  purpose: CustodyCredentialPurpose;
  bookingId: string;
  operation: CustodyOperationKind;
  credential: string;
}): string {
  const normalizedBookingId = normalizeAndValidateBookingId(params.bookingId);
  const normalizedCredential = normalizeAndValidateCredential(
    params.purpose,
    params.credential
  );

  // Length-delimited, unambiguous JSON tuple guarantees domain separation across
  // hash version, purpose (CUSTODY_QR vs CUSTODY_PIN), bookingId, operation, and value.
  return JSON.stringify([
    CUSTODY_HASH_VERSION,
    params.purpose,
    normalizedBookingId,
    params.operation,
    normalizedCredential
  ]);
}

/**
 * Computes a domain-separated keyed HMAC-SHA256 hex digest for custody QR tokens or 6-digit PINs.
 * Never embeds or falls back to any default secret.
 */
export function computeCustodyCredentialHmac(params: {
  purpose: CustodyCredentialPurpose;
  bookingId: string;
  operation: CustodyOperationKind;
  credential: string;
  secretOverride?: string;
}): string {
  const secret = resolveValidatedCustodySecret(params.secretOverride);
  const canonicalInput = buildCanonicalCustodyHmacInput(params);

  return crypto
    .createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(canonicalInput, "utf8")
    .digest("hex");
}

/**
 * Verifies a candidate custody QR token or 6-digit PIN against a stored HMAC-SHA256 hex digest
 * using strict fixed-length 32-byte buffer decoding and crypto.timingSafeEqual.
 */
export function verifyCustodyCredentialHmac(params: {
  purpose: CustodyCredentialPurpose;
  bookingId: string;
  operation: CustodyOperationKind;
  candidateCredential: string;
  storedDigestHex: string;
  secretOverride?: string;
}): boolean {
  const secret = resolveValidatedCustodySecret(params.secretOverride);

  if (
    typeof params.storedDigestHex !== "string" ||
    !HMAC_HEX_DIGEST_REGEX.test(params.storedDigestHex.trim())
  ) {
    return false;
  }

  let canonicalInput: string;
  try {
    canonicalInput = buildCanonicalCustodyHmacInput({
      purpose: params.purpose,
      bookingId: params.bookingId,
      operation: params.operation,
      credential: params.candidateCredential
    });
  } catch {
    return false;
  }

  const expectedHex = crypto
    .createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(canonicalInput, "utf8")
    .digest("hex");

  const expectedBuf = Buffer.from(expectedHex, "hex");
  const storedBuf = Buffer.from(params.storedDigestHex.trim().toLowerCase(), "hex");

  if (expectedBuf.byteLength !== 32 || storedBuf.byteLength !== 32) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, storedBuf);
}

