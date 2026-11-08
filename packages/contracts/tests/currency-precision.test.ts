import { describe, it, expect } from "vitest";
import {
  CurrencyCodeSchema,
  MinorUnitsSchema,
  MonetaryAmountSchema,
  CURRENCY_REGISTRY,
  formatCurrencyMinorUnits,
  toMinorUnits,
  toMajorUnits,
  getCurrencyExponent,
  getCurrencySymbol,
  isValidMinorUnits
} from "../src/index.js";

describe("Currency & Monetary Precision Contracts", () => {
  it("should validate supported ISO 4217 currency codes", () => {
    expect(CurrencyCodeSchema.parse("LKR")).toBe("LKR");
    expect(CurrencyCodeSchema.parse("USD")).toBe("USD");
    expect(CurrencyCodeSchema.parse("EUR")).toBe("EUR");
    expect(CurrencyCodeSchema.parse("GBP")).toBe("GBP");
    expect(CurrencyCodeSchema.parse("JPY")).toBe("JPY");
    expect(() => CurrencyCodeSchema.parse("XYZ")).toThrow();
  });

  it("should enforce integer minor units and reject floating-point numbers", () => {
    expect(MinorUnitsSchema.parse(0)).toBe(0);
    expect(MinorUnitsSchema.parse(150000)).toBe(150000);
    expect(isValidMinorUnits(150000)).toBe(true);

    // Floating-point values must be strictly rejected
    expect(() => MinorUnitsSchema.parse(10.5)).toThrow(/integer minor unit/);
    expect(() => MinorUnitsSchema.parse(99.99)).toThrow(/integer minor unit/);
    expect(isValidMinorUnits(10.5)).toBe(false);

    // Negative amounts must be strictly rejected
    expect(() => MinorUnitsSchema.parse(-100)).toThrow(/cannot be negative/);
    expect(isValidMinorUnits(-100)).toBe(false);

    // Strings and non-numbers must be rejected
    expect(() => MinorUnitsSchema.parse("100")).toThrow();
    expect(isValidMinorUnits("100")).toBe(false);
  });

  it("should validate explicit MonetaryAmount objects", () => {
    const validAmount = { amount: 2500, currency: "USD" as const };
    expect(MonetaryAmountSchema.parse(validAmount)).toEqual(validAmount);

    expect(() => MonetaryAmountSchema.parse({ amount: 25.5, currency: "USD" })).toThrow();
    expect(() => MonetaryAmountSchema.parse({ amount: 2500, currency: "BTC" })).toThrow();
  });

  it("should handle currency exponents correctly across 2-decimal and 0-decimal currencies", () => {
    expect(getCurrencyExponent("LKR")).toBe(2);
    expect(getCurrencyExponent("USD")).toBe(2);
    expect(getCurrencyExponent("EUR")).toBe(2);
    expect(getCurrencyExponent("GBP")).toBe(2);
    expect(getCurrencyExponent("JPY")).toBe(0);

    expect(CURRENCY_REGISTRY.JPY.exponent).toBe(0);
    expect(CURRENCY_REGISTRY.USD.exponent).toBe(2);
  });

  it("should convert major units to minor units without floating-point inaccuracies", () => {
    // 10.50 USD = 1050 cents
    expect(toMinorUnits(10.5, "USD")).toBe(1050);
    // 0.01 USD = 1 cent
    expect(toMinorUnits(0.01, "USD")).toBe(1);
    // 19.99 USD = 1999 cents
    expect(toMinorUnits(19.99, "USD")).toBe(1999);
    // 500 JPY (0 decimals) = 500
    expect(toMinorUnits(500, "JPY")).toBe(500);
    // 1500.75 LKR = 150075 minor units
    expect(toMinorUnits(1500.75, "LKR")).toBe(150075);

    expect(() => toMinorUnits(-5, "USD")).toThrow();
  });

  it("should convert minor units to major units accurately", () => {
    expect(toMajorUnits(1050, "USD")).toBe(10.5);
    expect(toMajorUnits(1999, "USD")).toBe(19.99);
    expect(toMajorUnits(500, "JPY")).toBe(500);
    expect(toMajorUnits(150075, "LKR")).toBe(1500.75);

    expect(() => toMajorUnits(10.5, "USD")).toThrow();
  });

  it("should format display strings properly with symbols", () => {
    expect(formatCurrencyMinorUnits(150000, "LKR")).toContain("Rs 1,500.00");
    expect(formatCurrencyMinorUnits(2550, "USD")).toContain("$ 25.50");
    expect(formatCurrencyMinorUnits(3000, "JPY")).toContain("¥ 3,000");
    expect(getCurrencySymbol("EUR")).toBe("€");
  });
});

