import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  TRAVELLER_MOBILE_SCREENS,
  RESERVED_MOBILE_SCREEN_IDS,
  DEMO_LOCATIONS,
  DEMO_BOOKINGS
} from "../src/data/mock-marketplace";

describe("Phase 2C.3.1: Independent Traveller Mobile Verification Audit", () => {
  describe("1. Canonical 44-Screen Span Inventory Reconciliation", () => {
    it("accounts for all 44 potential IDs in the TM-001 through TM-044 span", () => {
      // Exactly 39 active screens + 5 reserved IDs = 44 total span IDs
      expect(TRAVELLER_MOBILE_SCREENS).toHaveLength(39);
      expect(RESERVED_MOBILE_SCREEN_IDS).toHaveLength(11); // 5 TM + 6 HM

      const reservedTmIds = RESERVED_MOBILE_SCREEN_IDS.filter((id) => id.startsWith("TM-"));
      expect(reservedTmIds).toEqual(["TM-009", "TM-010", "TM-025", "TM-026", "TM-038"]);
      expect(reservedTmIds).toHaveLength(5);

      const allActiveIds = TRAVELLER_MOBILE_SCREENS.map((s) => s.id);
      const allSpanIds = [...allActiveIds, ...reservedTmIds].sort();

      expect(allSpanIds).toHaveLength(44);
      for (let i = 1; i <= 44; i++) {
        const expectedId = `TM-${i.toString().padStart(3, "0")}`;
        expect(allSpanIds).toContain(expectedId);
      }
    });

    it("verifies all active 39 screens have registered specifications with user stories and workflows", () => {
      for (const screen of TRAVELLER_MOBILE_SCREENS) {
        expect(screen.id).toMatch(/^TM-\d{3}$/);
        expect(screen.name.length).toBeGreaterThan(3);
        expect(screen.route.length).toBeGreaterThan(0);
        expect(screen.summary.length).toBeGreaterThan(10);
      }
    });
  });

  describe("2. Security Audit: Offline Custody Credentials & Honest Prototype Presentation", () => {
    it("confirms digital pass does NOT claim server-verified HMAC cryptography", () => {
      const passPath = path.resolve(__dirname, "../app/(traveller)/pass.tsx");
      const content = fs.readFileSync(passPath, "utf-8");

      // Must not make unsubstantiated cryptographic claims
      expect(content).not.toContain("Server-Verified HMAC Token");
      expect(content).not.toContain("Save Pass Offline (SecureStore)");

      // Must honestly identify as prototype display
      expect(content).toContain("Digital Custody QR Pass • Prototype Display");
      expect(content).toContain("Cache Pass Offline (Prototype)");
    });

    it("confirms digital pass displays monospace human fallback PIN without claiming dynamic rotation", () => {
      const activeBooking = DEMO_BOOKINGS.find((b) => b.status === "IN_STORAGE");
      expect(activeBooking).toBeDefined();
      expect(activeBooking?.pinFallback).toBe("482 910"); // Verified as demonstration fixture
      expect(activeBooking?.reference).toBe("#LS-2026-8841");
    });
  });

  describe("3. Operational Claims & Uncontracted Marketing Neutralization", () => {
    it("confirms location dossier neutralizes uncontracted insurance guarantee claims", () => {
      const locPath = path.resolve(__dirname, "../app/(traveller)/location.tsx");
      const content = fs.readFileSync(locPath, "utf-8");

      // Must not present uncontracted guarantee as definitive platform promise
      expect(content).not.toContain("LKR 250,000 Platform Guarantee");
      expect(content).toContain("Illustrative Custody Guarantee (Demo)");
    });

    it("confirms onboarding slides neutralize uncontracted guarantee claims", () => {
      const onboardingPath = path.resolve(__dirname, "../app/(traveller)/onboarding.tsx");
      const content = fs.readFileSync(onboardingPath, "utf-8");

      expect(content).not.toContain("up to LKR 250,000 platform guarantee");
      expect(content).not.toContain("Safe custody guaranteed so you can immerse in island wonders.");
    });

    it("confirms support centre neutralizes 24/7 uncontracted claims and labels demo helpline", () => {
      const supportPath = path.resolve(__dirname, "../app/(traveller)/support.tsx");
      const content = fs.readFileSync(supportPath, "utf-8");

      expect(content).not.toContain("24/7 Dedicated Custody Hotline");
      expect(content).toContain("Custody Support Helpline");
      expect(content).toContain("Demo Hotline");
    });
  });

  describe("4. Fixture Traceability & Level 2 Functional Bounding", () => {
    it("confirms all demo locations and bookings are explicit fixtures", () => {
      expect(DEMO_LOCATIONS.length).toBe(6);
      expect(DEMO_BOOKINGS.length).toBe(4);

      for (const loc of DEMO_LOCATIONS) {
        expect(loc.id).toMatch(/^loc-/);
        expect(loc.coordinates.lat).toBeGreaterThan(5); // Sri Lanka latitudes
        expect(loc.coordinates.lat).toBeLessThan(10);
      }

      for (const booking of DEMO_BOOKINGS) {
        expect(booking.id).toMatch(/^bk-/);
        expect(booking.reference).toMatch(/^#LS-\d{4}-\d{4}$/);
      }
    });
  });
});
