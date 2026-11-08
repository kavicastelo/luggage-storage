import { z } from "zod";

/**
 * Standard Platform Error Code Taxonomy
 */
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

/**
 * Error detail schema for field-level validation and contextual error reporting.
 */
export const ApiErrorDetailSchema = z.object({
  field: z.string().optional(),
  message: z.string(),
  code: z.string().optional()
});

export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;

/**
 * Standard API error response schema
 */
export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.array(ApiErrorDetailSchema).optional()
  }),
  meta: z.object({
    timestamp: z.string(),
    correlationId: z.string().optional()
  })
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

/**
 * Standard error code to default HTTP status mapping
 */
export const ERROR_CODE_TO_HTTP_STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  CAPACITY_EXCEEDED: 422,
  PAYMENT_FAILED: 402,
  RATE_LIMITED: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

/**
 * Creates a standardized error response envelope.
 * Accepts either an array of ApiErrorDetail or a key-value record which is safely normalized.
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: ApiErrorDetail[] | Record<string, unknown>,
  correlationId?: string
): ApiErrorResponse {
  let normalizedDetails: ApiErrorDetail[] | undefined;
  if (Array.isArray(details)) {
    normalizedDetails = details.length > 0 ? details : undefined;
  } else if (details && typeof details === "object") {
    normalizedDetails = Object.entries(details).map(([field, val]) => ({
      field,
      message: String(val)
    }));
  }

  return {
    success: false,
    error: {
      code,
      message,
      ...(normalizedDetails ? { details: normalizedDetails } : {})
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...(correlationId ? { correlationId } : {})
    }
  };
}
