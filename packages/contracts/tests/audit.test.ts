import { describe, it, expect } from "vitest";
import {
  SecurityEventType,
  SecurityEventTypeSchema,
  SecurityAuditEventSchema,
  securityEventTypeValues
} from "../src/audit/index.js";

describe("Audit Contracts & Event Types", () => {
  it("should define all mandatory security event types", () => {
    // Authentication & Registration
    expect(SecurityEventType.AUTH_REGISTER_SUCCESS).toBe("AUTH_REGISTER_SUCCESS");
    expect(SecurityEventType.AUTH_REGISTER_FAILURE).toBe("AUTH_REGISTER_FAILURE");
    expect(SecurityEventType.AUTH_LOGIN_SUCCESS).toBe("AUTH_LOGIN_SUCCESS");
    expect(SecurityEventType.AUTH_LOGIN_FAILURE).toBe("AUTH_LOGIN_FAILURE");

    // Password Management & Recovery
    expect(SecurityEventType.AUTH_PASSWORD_CHANGE_SUCCESS).toBe("AUTH_PASSWORD_CHANGE_SUCCESS");
    expect(SecurityEventType.AUTH_PASSWORD_CHANGE_FAILURE).toBe("AUTH_PASSWORD_CHANGE_FAILURE");
    expect(SecurityEventType.AUTH_PASSWORD_RESET_REQUESTED).toBe("AUTH_PASSWORD_RESET_REQUESTED");
    expect(SecurityEventType.AUTH_PASSWORD_RESET_COMPLETED).toBe("AUTH_PASSWORD_RESET_COMPLETED");
    expect(SecurityEventType.AUTH_PASSWORD_RESET_SUCCESS).toBe("AUTH_PASSWORD_RESET_COMPLETED");
    expect(SecurityEventType.AUTH_PASSWORD_RESET_FAILURE).toBe("AUTH_PASSWORD_RESET_FAILURE");

    // Session Management & Token Rotation
    expect(SecurityEventType.AUTH_SESSION_CREATED).toBe("AUTH_SESSION_CREATED");
    expect(SecurityEventType.AUTH_TOKEN_ROTATED).toBe("AUTH_TOKEN_ROTATED");
    expect(SecurityEventType.AUTH_REFRESH_SUCCESS).toBe("AUTH_TOKEN_ROTATED");
    expect(SecurityEventType.AUTH_REFRESH_FAILURE).toBe("AUTH_REFRESH_FAILURE");
    expect(SecurityEventType.AUTH_TOKEN_REUSE_DETECTED).toBe("AUTH_TOKEN_REUSE_DETECTED");
    expect(SecurityEventType.AUTH_LOGOUT).toBe("AUTH_LOGOUT");
    expect(SecurityEventType.AUTH_LOGOUT_SUCCESS).toBe("AUTH_LOGOUT");
    expect(SecurityEventType.AUTH_LOGOUT_ALL).toBe("AUTH_LOGOUT_ALL");
    expect(SecurityEventType.AUTH_LOGOUT_ALL_SUCCESS).toBe("AUTH_LOGOUT_ALL");
    expect(SecurityEventType.AUTH_SESSION_REVOKED).toBe("AUTH_SESSION_REVOKED");

    // Administrative Lifecycle & Governance
    expect(SecurityEventType.AUTH_ACCOUNT_SUSPENDED).toBe("AUTH_ACCOUNT_SUSPENDED");
    expect(SecurityEventType.AUTH_ACCOUNT_REINSTATED).toBe("AUTH_ACCOUNT_REINSTATED");
    expect(SecurityEventType.AUTH_ACCOUNT_DEACTIVATED).toBe("AUTH_ACCOUNT_DEACTIVATED");
    expect(SecurityEventType.AUTH_ACCOUNT_REACTIVATED).toBe("AUTH_ACCOUNT_REACTIVATED");
    expect(SecurityEventType.AUTH_EMAIL_VERIFIED_BY_ADMIN).toBe("AUTH_EMAIL_VERIFIED_BY_ADMIN");

    // Authorization & RBAC
    expect(SecurityEventType.AUTH_ROLE_ASSIGNED).toBe("AUTH_ROLE_ASSIGNED");
    expect(SecurityEventType.AUTH_ROLE_REVOKED).toBe("AUTH_ROLE_REVOKED");
    expect(SecurityEventType.AUTH_ACCESS_DENIED).toBe("AUTH_ACCESS_DENIED");
  });

  it("should validate valid event types with SecurityEventTypeSchema", () => {
    for (const event of securityEventTypeValues) {
      const parsed = SecurityEventTypeSchema.safeParse(event);
      expect(parsed.success).toBe(true);
    }
  });

  it("should reject invalid event types", () => {
    const invalid = SecurityEventTypeSchema.safeParse("INVALID_EVENT_TYPE");
    expect(invalid.success).toBe(false);
  });

  it("should validate structured audit event record", () => {
    const validEvent = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      userId: "223e4567-e89b-12d3-a456-426614174000",
      eventType: "AUTH_LOGIN_SUCCESS",
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      metadata: {
        email: "test@example.com",
        correlationId: "req-123"
      },
      createdAt: new Date().toISOString()
    };

    const parsed = SecurityAuditEventSchema.safeParse(validEvent);
    expect(parsed.success).toBe(true);
  });

  it("should accept audit event with nullable userId and ipAddress", () => {
    const anonymousEvent = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      userId: null,
      eventType: "AUTH_LOGIN_FAILURE",
      ipAddress: null,
      userAgent: null,
      metadata: {
        reason: "USER_NOT_FOUND"
      },
      createdAt: new Date().toISOString()
    };

    const parsed = SecurityAuditEventSchema.safeParse(anonymousEvent);
    expect(parsed.success).toBe(true);
  });
});
