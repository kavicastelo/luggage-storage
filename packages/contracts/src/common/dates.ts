import { z } from "zod";

/**
 * ISO 8601 UTC Datetime String Schema:
 * Validates full datetime representations (e.g. 2026-11-08T06:30:00.000Z).
 */
export const IsoDateTimeStringSchema = z
  .string()
  .datetime({ message: "Must be a valid ISO 8601 UTC datetime string" });

export type IsoDateTimeString = z.infer<typeof IsoDateTimeStringSchema>;

/**
 * ISO 8601 Calendar Date Schema:
 * Validates calendar dates in YYYY-MM-DD format (e.g. 2026-11-08).
 */
export const IsoDateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Must be a valid ISO 8601 date string in YYYY-MM-DD format"
  });

export type IsoDateString = z.infer<typeof IsoDateStringSchema>;

/**
 * Validated Date Range Schema:
 * Ensures the start datetime precedes or equals the end datetime.
 */
export const DateRangeSchema = z
  .object({
    from: IsoDateTimeStringSchema,
    to: IsoDateTimeStringSchema
  })
  .refine(
    (range) => new Date(range.from).getTime() <= new Date(range.to).getTime(),
    {
      message: "'from' date must be before or equal to 'to' date",
      path: ["to"]
    }
  );

export type DateRange = z.infer<typeof DateRangeSchema>;

// ============================================================================
// Runtime Validation & Date Utilities
// ============================================================================

export function isValidISODateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return IsoDateTimeStringSchema.safeParse(value).success;
}

export function isValidISODateOnlyString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return IsoDateStringSchema.safeParse(value).success;
}

export function addDurationToISO(
  baseIso: string,
  amount: number,
  unit: "minutes" | "hours" | "days"
): string {
  const date = new Date(baseIso);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid base ISO date string: ${baseIso}`);
  }
  const multipliers: Record<string, number> = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000
  };
  const offset = amount * (multipliers[unit] ?? 0);
  return new Date(date.getTime() + offset).toISOString();
}
