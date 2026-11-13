import crypto from "node:crypto";
import { env } from "../../config/env.js";

export type DatabaseIdentityAction =
  | "ASSIGN_ROLE"
  | "REVOKE_ROLE"
  | "SELF_ASSIGN_HOST_OWNER";

export const DB_IDENTITY_KEY_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
export const DB_IDENTITY_SIGNATURE_HEX_PATTERN = /^[0-9a-f]{64}$/i;

export interface DatabaseIdentityAssertionInput {
  actorId: string;
  action: DatabaseIdentityAction;
  targetId: string;
  roleCode?: string | null;
  ttlSeconds?: number;
  keyId?: string;
  secretOverride?: string;
}

export interface DatabaseIdentityAssertion {
  keyId: string;
  actorId: string;
  action: DatabaseIdentityAction;
  targetId: string;
  roleCode: string | null;
  expiresAt: number;
  nonce: string;
  signature: string;
}

/**
 * Builds the canonical payload string to sign and verify.
 * Format: keyId:actorId:action:targetId:roleCode:expiresAt:nonce
 */
export function buildIdentityAssertionPayload(
  keyId: string,
  actorId: string,
  action: string,
  targetId: string,
  roleCode: string | null | undefined,
  expiresAt: number,
  nonce: string
): string {
  return `${keyId}:${actorId}:${action}:${targetId}:${roleCode || ""}:${expiresAt}:${nonce}`;
}

/**
 * Creates a cryptographically signed database identity assertion.
 * The assertion binds the active signing key ID, authenticated actor identity,
 * authorized action, target resource, role code, expiration timestamp, and a
 * single-use cryptographic nonce.
 *
 * PostgreSQL verifies this assertion via HMAC-SHA256 (pgcrypto) against the declared
 * key_id in public.trusted_auth_secrets (inaccessible to runtime role luggage_user).
 * Note: In PostgreSQL PL/pgSQL, verify_identity_assertion performs a fixed-length
 * (32-byte), fixed-iteration byte comparison without early exit, avoiding SQL bytea
 * `<>` short-circuiting, though PL/pgSQL does not provide formal hardware/compiler
 * constant-time execution guarantees.
 */
export function createDatabaseIdentityAssertion(
  input: DatabaseIdentityAssertionInput
): DatabaseIdentityAssertion {
  const keyId = (input.keyId ?? env.DB_IDENTITY_KEY_ID).trim();
  if (!DB_IDENTITY_KEY_ID_PATTERN.test(keyId)) {
    throw new Error("Invalid database identity keyId format");
  }
  const secret = input.secretOverride ?? env.DB_IDENTITY_SECRET;
  const ttl = input.ttlSeconds ?? 60; // 60-second window to prevent stale replay
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const nonce = crypto.randomBytes(16).toString("hex");
  const roleCode = input.roleCode ?? null;

  const payload = buildIdentityAssertionPayload(
    keyId,
    input.actorId,
    input.action,
    input.targetId,
    roleCode,
    expiresAt,
    nonce
  );

  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  return {
    keyId,
    actorId: input.actorId,
    action: input.action,
    targetId: input.targetId,
    roleCode,
    expiresAt,
    nonce,
    signature
  };
}

/**
 * Verifies a database identity assertion in Node.js (for server-side sanity/testing).
 * Uses Node.js crypto.timingSafeEqual after validating strict 64-character hex encoding.
 */
export function verifyDatabaseIdentityAssertion(
  assertion: DatabaseIdentityAssertion,
  expectedAction: DatabaseIdentityAction,
  expectedTargetId: string,
  expectedRoleCode?: string | null,
  secretOverride?: string,
  expectedKeyId?: string
): { valid: boolean; reason?: string } {
  if (!assertion.keyId || !DB_IDENTITY_KEY_ID_PATTERN.test(assertion.keyId)) {
    return { valid: false, reason: "Invalid key identifier" };
  }

  if (expectedKeyId !== undefined && assertion.keyId !== expectedKeyId) {
    return { valid: false, reason: "Key identifier mismatch" };
  }

  if (!assertion.signature || !DB_IDENTITY_SIGNATURE_HEX_PATTERN.test(assertion.signature)) {
    return { valid: false, reason: "Invalid signature encoding or length" };
  }

  const secret = secretOverride || env.DB_IDENTITY_SECRET;
  const now = Math.floor(Date.now() / 1000);

  if (now > assertion.expiresAt) {
    return { valid: false, reason: "Assertion has expired" };
  }

  if (assertion.expiresAt > now + 120) {
    return { valid: false, reason: "Assertion expiration exceeds maximum permitted lifetime" };
  }

  if (assertion.action !== expectedAction) {
    return { valid: false, reason: "Action mismatch" };
  }

  if (assertion.targetId !== expectedTargetId) {
    return { valid: false, reason: "Target mismatch" };
  }

  if (expectedRoleCode !== undefined && assertion.roleCode !== (expectedRoleCode || null)) {
    return { valid: false, reason: "Role code mismatch" };
  }

  const payload = buildIdentityAssertionPayload(
    assertion.keyId,
    assertion.actorId,
    assertion.action,
    assertion.targetId,
    assertion.roleCode,
    assertion.expiresAt,
    assertion.nonce
  );

  const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const valid = crypto.timingSafeEqual(
    Buffer.from(assertion.signature.toLowerCase(), "hex"),
    Buffer.from(expectedSig.toLowerCase(), "hex")
  );

  if (!valid) {
    return { valid: false, reason: "Invalid signature" };
  }

  return { valid: true };
}
