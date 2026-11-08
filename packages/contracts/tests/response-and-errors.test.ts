import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  ErrorCodeSchema,
  createSuccessResponse,
  createErrorResponse,
  createApiResponseSchema,
  ApiErrorResponseSchema,
  ERROR_CODE_TO_HTTP_STATUS
} from "../src/index.js";

describe("Response and Error Standards Contracts", () => {
  it("should validate all 12 platform error codes", () => {
    const codes = [
      "BAD_REQUEST",
      "VALIDATION_ERROR",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "CAPACITY_EXCEEDED",
      "PAYMENT_FAILED",
      "UNPROCESSABLE_ENTITY",
      "INTERNAL_SERVER_ERROR",
      "SERVICE_UNAVAILABLE",
      "RATE_LIMITED"
    ];
    for (const code of codes) {
      expect(ErrorCodeSchema.parse(code)).toBe(code);
      expect(ERROR_CODE_TO_HTTP_STATUS[code as keyof typeof ERROR_CODE_TO_HTTP_STATUS]).toBeDefined();
    }
  });

  it("should construct valid error responses with field-level details", () => {
    const details = [
      { field: "email", message: "Email is already taken", code: "CONFLICT" },
      { field: "password", message: "Password is too weak" }
    ];
    const res = createErrorResponse("VALIDATION_ERROR", "Validation failed", details, "corr-123");

    expect(res.success).toBe(false);
    expect(res.error.code).toBe("VALIDATION_ERROR");
    expect(res.error.message).toBe("Validation failed");
    expect(res.error.details).toEqual(details);
    expect(res.meta.correlationId).toBe("corr-123");
    expect(res.meta.timestamp).toBeDefined();

    // Verify response conforms to ApiErrorResponseSchema
    expect(ApiErrorResponseSchema.parse(res)).toEqual(res);
  });

  it("should construct valid error responses with object details dictionary normalized to array", () => {
    const res = createErrorResponse(
      "NOT_FOUND",
      "Booking not found",
      { bookingId: "b-123", attemptedAction: "CANCEL" },
      "corr-obj"
    );

    expect(res.success).toBe(false);
    expect(res.error.code).toBe("NOT_FOUND");
    expect(res.error.details).toEqual([
      { field: "bookingId", message: "b-123" },
      { field: "attemptedAction", message: "CANCEL" }
    ]);
    expect(ApiErrorResponseSchema.parse(res)).toEqual(res);
  });

  it("should construct valid error responses without details", () => {
    const res = createErrorResponse("UNAUTHORIZED", "Authentication required");
    expect(res.success).toBe(false);
    expect(res.error.details).toBeUndefined();
    expect(ApiErrorResponseSchema.parse(res)).toEqual(res);
  });

  it("should create typed success responses validating against higher-order schema builder", () => {
    const userSchema = z.object({ id: z.string(), email: z.string().email() });
    const successSchema = createApiResponseSchema(userSchema);

    const user = { id: "123", email: "traveller@example.com" };
    const res = createSuccessResponse(user, "corr-success");

    expect(res.success).toBe(true);
    expect(res.data).toEqual(user);
    expect(res.meta?.correlationId).toBe("corr-success");

    expect(successSchema.parse(res)).toEqual(res);
  });
});
