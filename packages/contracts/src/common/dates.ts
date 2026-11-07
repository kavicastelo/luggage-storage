import { z } from "zod";

export const IsoDateTimeStringSchema = z
  .string()
  .datetime({ message: "Must be a valid ISO 8601 UTC datetime string" });

export type IsoDateTimeString = z.infer<typeof IsoDateTimeStringSchema>;

export function isValidISODateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const result = IsoDateTimeStringSchema.safeParse(value);
  return result.success;
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
