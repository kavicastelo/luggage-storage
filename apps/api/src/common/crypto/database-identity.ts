import crypto from "node:crypto";
import { env } from "../../config/env.js";

export type DatabaseIdentityAction =
  | "ASSIGN_ROLE"
  | "REVOKE_ROLE"
  | "SELF_ASSIGN_HOST_OWNER";

export interface DatabaseIdentityAssertionInput {
  actorId: string;
  action: DatabaseIdentityAction;
  targetId: string;
  roleCode?: string | null;
  ttlSeconds?: number;
}

export interface DatabaseIdentityAssertion {
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
 * Format: actorId:action:targetId:roleCode:expiresAt:nonce
 */
export function buildIdentityAssertionPayload(
  actorId: string,
  action: string,
  targetId: string,
  roleCode: string | null | undefined,
  expiresAt: number,
  nonce: string
): string {
  return `${actorId}:${action}:${targetId}:${roleCode || ""}:${expiresAt}:${nonce}`;
}

/**
 * Creates a cryptographically signed database identity assertion.
 * The assertion binds the authenticated actor identity, authorized action,
 * target resource, role code, expiration timestamp, and a unique cryptographic nonce.
 *
 * PostgreSQL verifies this assertion using HMAC-SHA256 via pgcrypto and a shared
 * secret provisioned in trusted_auth_secrets (inaccessible to the application role luggage_user).
 */
export function createDatabaseIdentityAssertion(
  input: DatabaseIdentityAssertionInput
): DatabaseIdentityAssertion {
  const secret = env.DB_IDENTITY_SECRET;
  const ttl = input.ttlSeconds ?? 60; // 60-second window to prevent stale replay
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const nonce = crypto.randomBytes(16).toString("hex");
  const roleCode = input.roleCode ?? null;

  const payload = buildIdentityAssertionPayload(
    input.actorId,
    input.action,
    input.targetId,
    roleCode,
    expiresAt,
    nonce
  );

  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  return {
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
 * Verifies a database identity assertion server-side (for sanity/testing).
 */
export function verifyDatabaseIdentityAssertion(
  assertion: DatabaseIdentityAssertion,
  expectedAction: DatabaseIdentityAction,
  expectedTargetId: string,
  expectedRoleCode?: string | null,
  secretOverride?: string
): { valid: boolean; reason?: string } {
  const secret = secretOverride || env.DB_IDENTITY_SECRET;
  const now = Math.floor(Date.now() / 1000);

  if (now > assertion.expiresAt) {
    return { valid: false, reason: "Assertion has expired" };
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
    assertion.actorId,
    assertion.action,
    assertion.targetId,
    assertion.roleCode,
    assertion.expiresAt,
    assertion.nonce
  );

  const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const valid = crypto.timingSafeEqual(
    Buffer.from(assertion.signature, "hex"),
    Buffer.from(expectedSig, "hex")
  );

  if (!valid) {
    return { valid: false, reason: "Invalid signature" };
  }

  return { valid: true };
}

