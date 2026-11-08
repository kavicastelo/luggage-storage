import { z } from "zod";
import { SortOrderSchema } from "../common/identifiers.js";

/**
 * Standard pagination query parameters with coercion and sensible defaults.
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "Page must be greater than or equal to 1").default(1),
  limit: z.coerce.number().int().min(1, "Limit must be at least 1").max(100, "Limit cannot exceed 100").default(20)
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Extended query parameters supporting sorting alongside pagination.
 */
export const SortablePaginationQuerySchema = PaginationQuerySchema.extend({
  sortBy: z.string().trim().max(32).optional(),
  sortOrder: SortOrderSchema.optional()
});

export type SortablePaginationQuery = z.infer<typeof SortablePaginationQuerySchema>;

/**
 * Standard pagination metadata schema
 */
export const PaginationMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(1),
  hasNext: z.boolean(),
  hasPrev: z.boolean()
});

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

export interface PaginatedApiResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
  meta: {
    timestamp: string;
    correlationId?: string;
  };
}

/**
 * Higher-order schema builder for paginated API responses.
 */
export function createPaginatedApiResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    pagination: PaginationMetaSchema,
    meta: z.object({
      timestamp: z.string(),
      correlationId: z.string().optional()
    })
  });
}

export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  correlationId?: string
): PaginatedApiResponse<T> {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...(correlationId ? { correlationId } : {})
    }
  };
}
