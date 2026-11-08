import { describe, it, expect } from "vitest";
import {
  UuidSchema,
  UserIdParamSchema,
  SessionIdParamSchema,
  RoleCodeParamSchema,
  UserRoleParamSchema,
  E164PhoneNumberSchema,
  CountryCodeSchema,
  IanaTimezoneSchema,
  Bcp47LanguageTagSchema,
  SortOrderSchema,
  isValidUuid,
  isValidE164Phone,
  isValidCountryCode,
  isValidIanaTimezone,
  isValidBcp47Language
} from "../src/index.js";

describe("Identifiers & Global Primitive Contracts", () => {
  describe("UUID Validation", () => {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000";

    it("should accept valid UUID v4 strings", () => {
      expect(UuidSchema.parse(validUuid)).toBe(validUuid);
      expect(isValidUuid(validUuid)).toBe(true);
    });

    it("should reject invalid UUIDs", () => {
      expect(() => UuidSchema.parse("not-a-uuid")).toThrow();
      expect(() => UuidSchema.parse("123e4567-e89b-12d3-a456")).toThrow();
      expect(isValidUuid("")).toBe(false);
      expect(isValidUuid(12345)).toBe(false);
      expect(isValidUuid(null)).toBe(false);
    });

    it("should validate path parameter objects", () => {
      expect(UserIdParamSchema.parse({ userId: validUuid })).toEqual({ userId: validUuid });
      expect(SessionIdParamSchema.parse({ sessionId: validUuid })).toEqual({ sessionId: validUuid });
      expect(UserRoleParamSchema.parse({ userId: validUuid, roleCode: "TRAVELLER" })).toEqual({
        userId: validUuid,
        roleCode: "TRAVELLER"
      });
      expect(() => RoleCodeParamSchema.parse({ roleCode: "" })).toThrow();
    });
  });

  describe("E.164 Phone Number Validation", () => {
    it("should accept valid international E.164 phone numbers", () => {
      const validNumbers = [
        "+94771234567", // Sri Lanka
        "+14155552671", // US
        "+442071838750", // UK
        "+81312345678", // Japan
        "+6561234567", // Singapore
        "+971501234567" // UAE
      ];
      for (const num of validNumbers) {
        expect(E164PhoneNumberSchema.parse(num)).toBe(num);
        expect(isValidE164Phone(num)).toBe(true);
      }
    });

    it("should reject non-E.164 phone numbers", () => {
      const invalidNumbers = [
        "0771234567", // missing plus
        "+0123456", // starts with 0 after +
        "+1234567890123456", // exceeds 15 digits
        "phone123", // letters
        "+94 77 123 4567", // spaces not trimmed inside
        ""
      ];
      for (const num of invalidNumbers) {
        expect(() => E164PhoneNumberSchema.parse(num)).toThrow();
        expect(isValidE164Phone(num)).toBe(false);
      }
    });
  });

  describe("ISO 3166-1 alpha-2 Country Code Validation", () => {
    it("should accept 2-letter uppercase alpha-2 country codes", () => {
      expect(CountryCodeSchema.parse("LK")).toBe("LK");
      expect(CountryCodeSchema.parse("us")).toBe("US"); // transformed to uppercase
      expect(CountryCodeSchema.parse("GB")).toBe("GB");
      expect(isValidCountryCode("LK")).toBe(true);
      expect(isValidCountryCode("SG")).toBe(true);
    });

    it("should reject invalid country codes", () => {
      expect(() => CountryCodeSchema.parse("LKA")).toThrow(); // 3 letters
      expect(() => CountryCodeSchema.parse("L1")).toThrow(); // numbers
      expect(() => CountryCodeSchema.parse("")).toThrow();
      expect(isValidCountryCode("123")).toBe(false);
    });
  });

  describe("IANA Timezone Validation", () => {
    it("should accept valid IANA timezone strings", () => {
      const timezones = [
        "Asia/Colombo",
        "UTC",
        "America/New_York",
        "Europe/London",
        "Asia/Tokyo",
        "Australia/Sydney"
      ];
      for (const tz of timezones) {
        expect(IanaTimezoneSchema.parse(tz)).toBe(tz);
        expect(isValidIanaTimezone(tz)).toBe(true);
      }
    });

    it("should reject invalid timezones", () => {
      expect(() => IanaTimezoneSchema.parse("")).toThrow();
      expect(() => IanaTimezoneSchema.parse("Invalid Timezone with Spaces")).toThrow();
      expect(isValidIanaTimezone("")).toBe(false);
    });
  });

  describe("BCP 47 Language Tag Validation", () => {
    it("should accept valid BCP 47 language tags", () => {
      const tags = ["en", "en-US", "en-GB", "si", "ta", "fr-FR", "de-DE", "ja"];
      for (const tag of tags) {
        expect(Bcp47LanguageTagSchema.parse(tag)).toBe(tag);
        expect(isValidBcp47Language(tag)).toBe(true);
      }
    });

    it("should reject invalid language tags", () => {
      expect(() => Bcp47LanguageTagSchema.parse("e")).toThrow(); // too short
      expect(() => Bcp47LanguageTagSchema.parse("english")).toThrow();
      expect(() => Bcp47LanguageTagSchema.parse("123")).toThrow();
    });
  });

  describe("Sort Order", () => {
    it("should accept 'asc' and 'desc', defaulting to 'asc'", () => {
      expect(SortOrderSchema.parse("asc")).toBe("asc");
      expect(SortOrderSchema.parse("desc")).toBe("desc");
      expect(SortOrderSchema.parse(undefined)).toBe("asc");
      expect(() => SortOrderSchema.parse("other")).toThrow();
    });
  });
});

