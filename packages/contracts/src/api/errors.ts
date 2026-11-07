import { z } from "zod";

export const ErrorCodeSchema = z.enum([
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
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  };
  meta: {
    timestamp: string;
    correlationId?: string;
  };
}

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: ApiErrorDetail[],
  correlationId?: string
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {})
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...(correlationId ? { correlationId } : {})
    }
  };
}
