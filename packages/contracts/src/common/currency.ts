import { z } from "zod";

/**
 * ISO 4217 Currency Code Schema
 */
export const CurrencyCodeSchema = z.enum(["LKR", "USD", "EUR", "GBP", "JPY"]);
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

export interface CurrencyMetadata {
  code: CurrencyCode;
  exponent: number;
  symbol: string;
}

/**
 * Authoritative currency registry defining minor-unit exponents and display symbols.
 * Conforms to ISO 4217 specifications.
 */
export const CURRENCY_REGISTRY: Record<CurrencyCode, CurrencyMetadata> = {
  LKR: { code: "LKR", exponent: 2, symbol: "Rs" },
  USD: { code: "USD", exponent: 2, symbol: "$" },
  EUR: { code: "EUR", exponent: 2, symbol: "€" },
  GBP: { code: "GBP", exponent: 2, symbol: "£" },
  JPY: { code: "JPY", exponent: 0, symbol: "¥" }
};

/**
 * Integer minor units schema:
 * Monetary values MUST be non-negative integers representing the smallest unit of currency
 * (e.g. cents for USD/EUR, minor units for LKR, whole yen for JPY).
 * Floating-point numbers are strictly forbidden.
 */
export const MinorUnitsSchema = z
  .number({ message: "Monetary amount must be a number" })
  .int({ message: "Monetary amount must be an integer minor unit (no floating-point values)" })
  .min(0, { message: "Monetary amount cannot be negative" });

export type MinorUnits = z.infer<typeof MinorUnitsSchema>;

/**
 * Explicit monetary amount schema pairing integer minor units with ISO 4217 currency code.
 */
export const MonetaryAmountSchema = z.object({
  amount: MinorUnitsSchema,
  currency: CurrencyCodeSchema
});

export type MonetaryAmount = z.infer<typeof MonetaryAmountSchema>;

/**
 * Formats minor units into an international display string with symbol and correct fractional digits.
 */
export function formatCurrencyMinorUnits(amountMinor: number, currency: CurrencyCode): string {
  const meta = CURRENCY_REGISTRY[currency];
  if (!meta) return `${amountMinor}`;
  if (meta.exponent === 0) return `${meta.symbol} ${amountMinor.toLocaleString("en-US")}`;
  const factor = Math.pow(10, meta.exponent);
  const major = amountMinor / factor;
  return `${meta.symbol} ${major.toLocaleString("en-US", {
    minimumFractionDigits: meta.exponent,
    maximumFractionDigits: meta.exponent
  })}`;
}

export const formatMinorUnits = formatCurrencyMinorUnits;

/**
 * Retrieves the exponent for a given currency code.
 */
export function getCurrencyExponent(currency: CurrencyCode): number {
  return CURRENCY_REGISTRY[currency]?.exponent ?? 2;
}

/**
 * Retrieves the currency symbol for a given currency code.
 */
export function getCurrencySymbol(currency: CurrencyCode): string {
  return CURRENCY_REGISTRY[currency]?.symbol ?? currency;
}

/**
 * Safely converts a major-unit decimal amount (e.g., 10.50 USD) to exact integer minor units (e.g., 1050).
 * Prevents JavaScript floating-point rounding errors using Math.round.
 */
export function toMinorUnits(majorAmount: number, currency: CurrencyCode): number {
  if (typeof majorAmount !== "number" || isNaN(majorAmount) || majorAmount < 0) {
    throw new Error(`Invalid major amount: ${majorAmount}`);
  }
  const exponent = getCurrencyExponent(currency);
  const factor = Math.pow(10, exponent);
  return Math.round(majorAmount * factor);
}

/**
 * Converts integer minor units to major units as a number.
 */
export function toMajorUnits(minorAmount: number, currency: CurrencyCode): number {
  if (!Number.isInteger(minorAmount) || minorAmount < 0) {
    throw new Error(`Invalid minor units amount: ${minorAmount}`);
  }
  const exponent = getCurrencyExponent(currency);
  const factor = Math.pow(10, exponent);
  return minorAmount / factor;
}

/**
 * Validation helper for minor units.
 */
export function isValidMinorUnits(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
