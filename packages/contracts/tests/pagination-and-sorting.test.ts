import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  PaginationQuerySchema,
  SortablePaginationQuerySchema,
  createPaginatedResponse,
  createPaginatedApiResponseSchema
} from "../src/index.js";

describe("Pagination and Sorting Contracts", () => {
  it("should apply defaults and coerce string query parameters", () => {
    const emptyResult = PaginationQuerySchema.parse({});
    expect(emptyResult.page).toBe(1);
    expect(emptyResult.limit).toBe(20);

    const coerced = PaginationQuerySchema.parse({ page: "3", limit: "50" });
    expect(coerced.page).toBe(3);
    expect(coerced.limit).toBe(50);
  });

  it("should reject invalid pagination parameters", () => {
    expect(() => PaginationQuerySchema.parse({ page: 0 })).toThrow(/greater than or equal to 1/);
    expect(() => PaginationQuerySchema.parse({ page: -1 })).toThrow();
    expect(() => PaginationQuerySchema.parse({ limit: 0 })).toThrow(/at least 1/);
    expect(() => PaginationQuerySchema.parse({ limit: 101 })).toThrow(/cannot exceed 100/);
  });

  it("should support sortable pagination query parameters", () => {
    const parsed = SortablePaginationQuerySchema.parse({
      page: "2",
      limit: "25",
      sortBy: "createdAt",
      sortOrder: "desc"
    });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(25);
    expect(parsed.sortBy).toBe("createdAt");
    expect(parsed.sortOrder).toBe("desc");

    const defaultOrder = SortablePaginationQuerySchema.parse({ sortBy: "name" });
    expect(defaultOrder.sortOrder).toBe("asc");
  });

  it("should build standard paginated response structures", () => {
    const items = [{ id: "item-1" }, { id: "item-2" }, { id: "item-3" }];
    const res = createPaginatedResponse(items, 2, 3, 10, "test-corr-id");

    expect(res.success).toBe(true);
    expect(res.data).toEqual(items);
    expect(res.pagination.page).toBe(2);
    expect(res.pagination.limit).toBe(3);
    expect(res.pagination.total).toBe(10);
    expect(res.pagination.totalPages).toBe(4);
    expect(res.pagination.hasNext).toBe(true);
    expect(res.pagination.hasPrev).toBe(true);
    expect(res.meta.correlationId).toBe("test-corr-id");
    expect(res.meta.timestamp).toBeDefined();
  });

  it("should correctly handle single page and zero total scenarios", () => {
    const singlePage = createPaginatedResponse([{ id: "1" }], 1, 10, 1);
    expect(singlePage.pagination.totalPages).toBe(1);
    expect(singlePage.pagination.hasNext).toBe(false);
    expect(singlePage.pagination.hasPrev).toBe(false);

    const empty = createPaginatedResponse([], 1, 20, 0);
    expect(empty.pagination.totalPages).toBe(1);
    expect(empty.pagination.hasNext).toBe(false);
    expect(empty.pagination.hasPrev).toBe(false);
  });

  it("should validate paginated responses with higher-order schema builder", () => {
    const itemSchema = z.object({ id: z.string(), name: z.string() });
    const schema = createPaginatedApiResponseSchema(itemSchema);

    const validPayload = {
      success: true as const,
      data: [{ id: "1", name: "Location A" }],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };

    expect(schema.parse(validPayload)).toEqual(validPayload);
    expect(() => schema.parse({ ...validPayload, success: false })).toThrow();
  });
});

