import { describe, it, expect } from "vitest";
import {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  PaginationQuerySchema,
  formatCurrencyMinorUnits,
  isValidISODateString,
  addDurationToISO,
  ErrorCodeSchema,
  VerifyEmailRequestSchema,
  ResendVerificationRequestSchema,
  AdminAuditEventQuerySchema,
  SecurityEventTypeSchema
} from "../src/index.js";

describe("Shared Contracts & Utilities", () => {
  it("should create standard successful response envelope", () => {
    const response = createSuccessResponse({ id: "123", name: "Colombo Fort Luggage" }, "corr-456");
    expect(response.success).toBe(true);
    expect(response.data.id).toBe("123");
    expect(response.meta.correlationId).toBe("corr-456");
    expect(response.meta.timestamp).toBeDefined();
  });

  it("should create standard error response envelope", () => {
    const errorResponse = createErrorResponse("NOT_FOUND", "Resource missing", { resource: "booking" }, "corr-789");
    expect(errorResponse.success).toBe(false);
    expect(errorResponse.error.code).toBe("NOT_FOUND");
    expect(errorResponse.error.message).toBe("Resource missing");
    expect(errorResponse.meta.correlationId).toBe("corr-789");
  });

  it("should create standard paginated response envelope with navigation flags", () => {
    const items = [{ id: "1" }, { id: "2" }];
    const paginated = createPaginatedResponse(items, 1, 10, 25, "corr-pag");
    expect(paginated.success).toBe(true);
    expect(paginated.data).toHaveLength(2);
    expect(paginated.pagination.page).toBe(1);
    expect(paginated.pagination.limit).toBe(10);
    expect(paginated.pagination.total).toBe(25);
    expect(paginated.pagination.totalPages).toBe(3);
    expect(paginated.pagination.hasNext).toBe(true);
    expect(paginated.pagination.hasPrev).toBe(false);
  });

  it("should handle empty paginated result with 0 total items", () => {
    const paginated = createPaginatedResponse([], 1, 20, 0);
    expect(paginated.success).toBe(true);
    expect(paginated.data).toHaveLength(0);
    expect(paginated.pagination.total).toBe(0);
    expect(paginated.pagination.totalPages).toBe(1);
    expect(paginated.pagination.hasNext).toBe(false);
    expect(paginated.pagination.hasPrev).toBe(false);
  });

  it("should validate and coerce pagination parameters", () => {
    const parsed = PaginationQuerySchema.parse({ page: "2", limit: "50" });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
  });

  it("should format currency from minor units to display string across decimal and non-decimal currencies", () => {
    const formattedLKR = formatCurrencyMinorUnits(150000, "LKR");
    expect(formattedLKR).toContain("1,500.00");

    const formattedUSD = formatCurrencyMinorUnits(2550, "USD");
    expect(formattedUSD).toContain("25.50");

    const formattedJPY = formatCurrencyMinorUnits(3000, "JPY");
    expect(formattedJPY).toContain("3,000");
  });

  it("should validate ISO dates and compute duration offsets accurately", () => {
    const nowIso = new Date().toISOString();
    expect(isValidISODateString(nowIso)).toBe(true);
    expect(isValidISODateString("invalid-date")).toBe(false);
    expect(isValidISODateString(12345)).toBe(false);

    const base = "2026-11-07T00:00:00.000Z";
    const futureMinutes = addDurationToISO(base, 15, "minutes");
    expect(futureMinutes).toBe("2026-11-07T00:15:00.000Z");

    const futureHours = addDurationToISO(base, 2, "hours");
    expect(futureHours).toBe("2026-11-07T02:00:00.000Z");

    const futureDays = addDurationToISO(base, 1, "days");
    expect(futureDays).toBe("2026-11-08T00:00:00.000Z");
  });

  it("should enforce standard error code taxonomy", () => {
    expect(ErrorCodeSchema.safeParse("NOT_FOUND").success).toBe(true);
    expect(ErrorCodeSchema.safeParse("CAPACITY_EXCEEDED").success).toBe(true);
    expect(ErrorCodeSchema.safeParse("PAYMENT_FAILED").success).toBe(true);
    expect(ErrorCodeSchema.safeParse("UNKNOWN_CUSTOM_CODE").success).toBe(false);
  });

  it("should validate self-service email verification and resend schemas", () => {
    expect(VerifyEmailRequestSchema.safeParse({ token: "valid-token-hex-12345" }).success).toBe(true);
    expect(VerifyEmailRequestSchema.safeParse({ token: "" }).success).toBe(false);
    expect(ResendVerificationRequestSchema.safeParse({ email: "traveller@example.com" }).success).toBe(true);
    expect(ResendVerificationRequestSchema.safeParse({ email: "invalid-email" }).success).toBe(false);
  });

  it("should validate admin audit event query parameters and security event types", () => {
    expect(SecurityEventTypeSchema.safeParse("AUTH_EMAIL_VERIFICATION_SENT").success).toBe(true);
    expect(SecurityEventTypeSchema.safeParse("AUTH_EMAIL_VERIFICATION_COMPLETED").success).toBe(true);
    expect(SecurityEventTypeSchema.safeParse("AUTH_RATE_LIMIT_EXCEEDED").success).toBe(true);
    expect(SecurityEventTypeSchema.safeParse("ADMIN_AUDIT_LOG_ACCESSED").success).toBe(true);

    const queryResult = AdminAuditEventQuerySchema.safeParse({
      page: "1",
      limit: "25",
      eventType: "AUTH_LOGIN_SUCCESS",
      userId: "550e8400-e29b-41d4-a716-446655440000",
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-11-09T23:59:59.000Z"
    });
    expect(queryResult.success).toBe(true);
  });
});
