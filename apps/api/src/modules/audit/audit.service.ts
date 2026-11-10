import { eq, desc, and, gte, lte, sql, type SQL } from "drizzle-orm";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { logger } from "../../infrastructure/logging/logger.js";
import {
  SecurityEventType,
  type AdminAuditEventQuery,
  type SecurityAuditEvent,
  type SecurityEventType as SecurityEventTypeString
} from "@luggage-storage/contracts";

export { SecurityEventType };

export interface AuditClientInfo {
  ip?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface RecordSecurityEventParams {
  eventType: SecurityEventTypeString | string;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  clientInfo?: AuditClientInfo | null;
  metadata?: Record<string, unknown> | null;
  // Optional active Drizzle transaction to guarantee atomic audit logging with state mutation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: any;
  throwOnError?: boolean;
}

/**
 * Explicit allowlist of metadata keys permitted to pass without redaction.
 * Any key matching forbidden credential patterns that is NOT in this allowlist
 * is automatically redacted.
 */
const ALLOWED_METADATA_KEYS = new Set([
  "sessionId",
  "resetTokenId",
  "verificationTokenId",
  "keyHashPrefix",
  "tokenType",
  "tokenFamily",
  "roleCode",
  "action",
  "reason",
  "outcome",
  "correlationId",
  "actorUserId",
  "targetUserId",
  "adminId",
  "email",
  "verifiedEmail",
  "clientType",
  "attempts",
  "previousStatus",
  "previousState",
  "newStatus",
  "sessionsRevoked",
  "revokedCount",
  "path",
  "method",
  "requiredPermission",
  "missingPermission",
  "roles",
  "statusCode",
  "expiresAt",
  "scope",
  "points",
  "maxPoints",
  "retryAfterSeconds",
  "businessId",
  "locationId",
  "verificationId",
  "documentId",
  "poolId",
  "policyId",
  "zoneId",
  "fileKey",
  "documentType",
  "decision",
  "rejectionReason",
  "adminNotes"
]);

const FORBIDDEN_KEY_PATTERN = /(?:password|passwd|pwd|hash|salt|secret|token|bearer|authorization|cookie|credential)/i;

/**
 * Deep recursive metadata sanitizer ensuring zero credential or secret disclosure.
 */
export function sanitizeAuditMetadata(
  metadata?: Record<string, unknown> | null
): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    // If key matches forbidden pattern and is not in explicit allowed reference keys, redact
    if (FORBIDDEN_KEY_PATTERN.test(key) && !ALLOWED_METADATA_KEYS.has(key)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    // Recursively sanitize nested dictionary objects
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      sanitized[key] = sanitizeAuditMetadata(value as Record<string, unknown>);
      continue;
    }

    // Sanitize string values matching credential / token signatures
    if (typeof value === "string") {
      // Redact JSON Web Tokens (header.payload.signature)
      if (value.startsWith("eyJ") && value.split(".").length === 3) {
        sanitized[key] = "[REDACTED_JWT]";
        continue;
      }
      // Redact high-entropy raw hex tokens (e.g. 64-char sha256 or 32-byte hex keys) unless explicitly an ID
      if (
        /^[a-f0-9]{64}$/i.test(value) &&
        !key.toLowerCase().endsWith("id") &&
        !ALLOWED_METADATA_KEYS.has(key)
      ) {
        sanitized[key] = "[REDACTED_SECRET]";
        continue;
      }
    }

    sanitized[key] = value;
  }

  return sanitized;
}

export class AuditService {
  /**
   * Appends an immutable security audit record to the security_audit_events table.
   *
   * Architectural & Security Guarantees:
   * 1. Immutability: Protected by database trigger `trg_prevent_audit_tampering` blocking UPDATE/DELETE.
   * 2. Zero Credential Disclosure: Deep sanitization removes passwords, hashes, tokens, and secrets.
   * 3. Correlation Tracking: Automatically associates client IP, User-Agent, and correlationId.
   * 4. Transactional Consistency: Can execute within caller's Drizzle transaction (`tx`) or standalone (`db`).
   * 5. Failure Resilience: Standalone logging does not disrupt caller flow unless `throwOnError: true`.
   */
  async recordEvent(params: RecordSecurityEventParams) {
    const client = params.tx || db;

    const ipAddress =
      params.ipAddress ||
      params.clientInfo?.ip ||
      params.clientInfo?.ipAddress ||
      null;

    const userAgent =
      params.userAgent ||
      params.clientInfo?.userAgent ||
      null;

    const metadata: Record<string, unknown> = {
      ...(params.metadata || {})
    };

    // Inject correlationId if available and not explicitly provided
    if (params.clientInfo?.correlationId && !metadata.correlationId) {
      metadata.correlationId = params.clientInfo.correlationId;
    }

    const sanitizedMetadata = sanitizeAuditMetadata(metadata);

    try {
      const [inserted] = await client
        .insert(schema.securityAuditEvents)
        .values({
          userId: params.userId || null,
          eventType: params.eventType,
          ipAddress,
          userAgent,
          metadata: sanitizedMetadata
        })
        .returning();

      return inserted;
    } catch (error) {
      logger.error(
        {
          error,
          eventType: params.eventType,
          userId: params.userId
        },
        "[AuditService] Failed to record security audit event"
      );

      if (params.throwOnError || params.tx) {
        // If part of an atomic transaction, the error must propagate to rollback state
        throw error;
      }

      return null;
    }
  }

  /**
   * Retrieves security audit events for a specific user, ordered chronologically descending.
   */
  async getEventsForUser(userId: string, limit = 50) {
    return db
      .select()
      .from(schema.securityAuditEvents)
      .where(eq(schema.securityAuditEvents.userId, userId))
      .orderBy(desc(schema.securityAuditEvents.createdAt))
      .limit(limit);
  }

  /**
   * Retrieves recent security audit events across the platform with optional event filtering.
   */
  async getRecentEvents(options?: {
    eventType?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let query = db
      .select()
      .from(schema.securityAuditEvents)
      .$dynamic();

    if (options?.eventType) {
      query = query.where(eq(schema.securityAuditEvents.eventType, options.eventType));
    }

    return query
      .orderBy(desc(schema.securityAuditEvents.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Retrieves a single security audit event by ID.
   */
  async getEventById(id: string) {
    const [event] = await db
      .select()
      .from(schema.securityAuditEvents)
      .where(eq(schema.securityAuditEvents.id, id))
      .limit(1);

    return event || null;
  }

  /**
   * Paginated, filterable retrieval of security audit events for administrative inspection.
   */
  async listAuditEvents(query: AdminAuditEventQuery): Promise<{
    items: SecurityAuditEvent[];
    total: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (query.eventType) {
      conditions.push(eq(schema.securityAuditEvents.eventType, query.eventType));
    }
    if (query.userId) {
      conditions.push(eq(schema.securityAuditEvents.userId, query.userId));
    }
    if (query.from) {
      conditions.push(gte(schema.securityAuditEvents.createdAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lte(schema.securityAuditEvents.createdAt, new Date(query.to)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.securityAuditEvents)
      .where(whereClause);

    const rows = await db
      .select()
      .from(schema.securityAuditEvents)
      .where(whereClause)
      .orderBy(desc(schema.securityAuditEvents.createdAt))
      .limit(limit)
      .offset(offset);

    const items: SecurityAuditEvent[] = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      eventType: row.eventType as SecurityAuditEvent["eventType"],
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.createdAt.toISOString()
    }));

    return {
      items,
      total: Number(countRes?.count ?? 0)
    };
  }
}

export const auditService = new AuditService();
