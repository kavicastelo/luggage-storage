import { z } from "zod";

export const ApiResponseMetaSchema = z.object({
  timestamp: z.string(),
  correlationId: z.string().optional()
});

export type ApiResponseMeta = z.infer<typeof ApiResponseMetaSchema>;

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    correlationId?: string;
  };
}

/**
 * Higher-order schema builder for standard successful API response envelopes.
 * Supports typed response schema validation and OpenAPI generator compatibility.
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: ApiResponseMetaSchema.optional()
  });
}

export function createSuccessResponse<T>(data: T, correlationId?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...(correlationId ? { correlationId } : {})
    }
  };
}
