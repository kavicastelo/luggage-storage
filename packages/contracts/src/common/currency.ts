import { z } from "zod";

export const CurrencyCodeSchema = z.enum(["LKR", "USD", "EUR", "GBP", "JPY"]);
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

export interface CurrencyMetadata {
  code: CurrencyCode;
  exponent: number;
  symbol: string;
}

export const CURRENCY_REGISTRY: Record<CurrencyCode, CurrencyMetadata> = {
  LKR: { code: "LKR", exponent: 2, symbol: "Rs" },
  USD: { code: "USD", exponent: 2, symbol: "$" },
  EUR: { code: "EUR", exponent: 2, symbol: "€" },
  GBP: { code: "GBP", exponent: 2, symbol: "£" },
  JPY: { code: "JPY", exponent: 0, symbol: "¥" }
};

export function formatCurrencyMinorUnits(amountMinor: number, currency: CurrencyCode): string {
  const meta = CURRENCY_REGISTRY[currency];
  if (!meta) return `${amountMinor}`;
  if (meta.exponent === 0) return `${meta.symbol} ${amountMinor.toLocaleString("en-US")}`;
  const factor = Math.pow(10, meta.exponent);
  const major = amountMinor / factor;
  return `${meta.symbol} ${major.toLocaleString("en-US", { minimumFractionDigits: meta.exponent, maximumFractionDigits: meta.exponent })}`;
}

export const formatMinorUnits = formatCurrencyMinorUnits;
