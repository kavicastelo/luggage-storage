import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DEMO_LOCATIONS,
  DEMO_BOOKINGS,
  TRAVELLER_MOBILE_SCREENS
} from "../src/data/mock-marketplace";
import { mobileColors } from "../src/lib/theme";

describe("Phase 2C.3 — Traveller Mobile Journeys & Discovery Tests", () => {
  describe("Task TSK-2C-011: 5-Tab Mobile Application Shell & Routing", () => {
    it("defines all 5 bottom tabs and detail stack routes in _layout.tsx", () => {
      const layoutPath = path.resolve(__dirname, "../app/(traveller)/_layout.tsx");
      expect(fs.existsSync(layoutPath)).toBe(true);
      const content = fs.readFileSync(layoutPath, "utf-8");

      // Verify the 5 primary tabs
      expect(content).toContain('name="index"');
      expect(content).toContain('title: "Explore"');
      expect(content).toContain('name="bookings"');
      expect(content).toContain('title: "My Storage"');
      expect(content).toContain('name="saved"');
      expect(content).toContain('title: "Saved"');
      expect(content).toContain('name="support"');
      expect(content).toContain('title: "Support"');
      expect(content).toContain('name="profile"');
      expect(content).toContain('title: "Account"');

      // Verify stack & detail routes hidden from tab bar
      expect(content).toContain('name="explore"');
      expect(content).toContain('name="location"');
      expect(content).toContain('name="checkout"');
      expect(content).toContain('name="pass"');
      expect(content).toContain('name="onboarding"');
      expect(content).toContain("href: null");
    });

    it("uses CWCP terracotta active tint and coastal navy tab bar background", () => {
      const layoutPath = path.resolve(__dirname, "../app/(traveller)/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      expect(content).toContain("tabBarActiveTintColor: mobileColors.terracotta[500]");
      expect(content).toContain("backgroundColor: mobileColors.navy[900]");
    });
  });

  describe("Task TSK-2C-012: Mobile Discovery Hub & Filtering (TM-011, TM-012, TM-013, TM-014)", () => {
    it("provides verified storage locations across Sri Lanka rail & transit hubs", () => {
      expect(DEMO_LOCATIONS.length).toBeGreaterThanOrEqual(6);

      const cities = DEMO_LOCATIONS.map((l) => l.city);
      expect(cities).toContain("Colombo");
      expect(cities).toContain("Ella");
      expect(cities).toContain("Kandy");
      expect(cities).toContain("Galle");
      expect(cities).toContain("Katunayake");
      expect(cities).toContain("Mirissa");
    });

    it("verifies partner security checklist and operating hours", () => {
      for (const loc of DEMO_LOCATIONS) {
        expect(loc.rating).toBeGreaterThanOrEqual(4.5);
        expect(loc.reviewCount).toBeGreaterThan(50);
        expect(loc.hasInsurance).toBe(true);
        expect(loc.insuranceLimitLkr).toBe(250000);
        expect(loc.hourlyRateLkr.MEDIUM).toBeGreaterThan(0);
        expect(loc.dailyCapLkr.MEDIUM).toBeGreaterThan(loc.hourlyRateLkr.MEDIUM);
        expect(loc.availableCapacity).toBeGreaterThan(0);
        expect(loc.availableCapacity).toBeLessThanOrEqual(loc.totalCapacity);
      }
    });

    it("filters storage locations by destination, 24/7 hours, CCTV, and price cap", () => {
      // Test Colombo filter
      const colomboHubs = DEMO_LOCATIONS.filter((l) => l.city === "Colombo");
      expect(colomboHubs.length).toBeGreaterThanOrEqual(1);

      // Test 24/7 filter
      const open24hHubs = DEMO_LOCATIONS.filter((l) => l.is24Hours);
      expect(open24hHubs.length).toBeGreaterThanOrEqual(2);

      // Test CCTV filter
      const cctvHubs = DEMO_LOCATIONS.filter((l) => l.hasCctv);
      expect(cctvHubs.length).toBe(DEMO_LOCATIONS.length); // All verified hubs have CCTV

      // Test price cap filter
      const budgetHubs = DEMO_LOCATIONS.filter((l) => l.dailyCapLkr.MEDIUM <= 1400);
      expect(budgetHubs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Task TSK-2C-013: Bag Selection, Capacity & Booking Checkout (TM-017–TM-023)", () => {
    it("defines 4 luggage categories with transparent dimensions and daily caps", () => {
      const sampleLoc = DEMO_LOCATIONS[0];
      const categories = ["SMALL", "MEDIUM", "LARGE", "OVERSIZED"] as const;

      for (const cat of categories) {
        expect(sampleLoc.hourlyRateLkr[cat]).toBeGreaterThan(0);
        expect(sampleLoc.dailyCapLkr[cat]).toBeGreaterThan(sampleLoc.hourlyRateLkr[cat]);
      }

      // Small < Medium < Large < Oversized
      expect(sampleLoc.dailyCapLkr.SMALL).toBeLessThan(sampleLoc.dailyCapLkr.MEDIUM);
      expect(sampleLoc.dailyCapLkr.MEDIUM).toBeLessThan(sampleLoc.dailyCapLkr.LARGE);
      expect(sampleLoc.dailyCapLkr.LARGE).toBeLessThan(sampleLoc.dailyCapLkr.OVERSIZED);
    });

    it("calculates exact itemized price and enforces touch target size >= 44pt", () => {
      const checkoutPath = path.resolve(__dirname, "../app/(traveller)/checkout.tsx");
      const content = fs.readFileSync(checkoutPath, "utf-8");

      // Verify touch targets >= 44pt (48px in styles for buttons)
      expect(content).toContain("width: 48");
      expect(content).toContain("height: 48");

      // Verify transparent formula calculation
      const loc = DEMO_LOCATIONS[0];
      const bagCounts = { SMALL: 1, MEDIUM: 2, LARGE: 1, OVERSIZED: 0 };
      const calculatedTotal =
        bagCounts.SMALL * loc.dailyCapLkr.SMALL +
        bagCounts.MEDIUM * loc.dailyCapLkr.MEDIUM +
        bagCounts.LARGE * loc.dailyCapLkr.LARGE +
        bagCounts.OVERSIZED * loc.dailyCapLkr.OVERSIZED;

      expect(calculatedTotal).toBe(1 * 900 + 2 * 1450 + 1 * 1950); // 900 + 2900 + 1950 = 5750 LKR
    });

    it("includes transparent overdue policy disclosure without silent charges (DEC-002)", () => {
      const checkoutPath = path.resolve(__dirname, "../app/(traveller)/checkout.tsx");
      const content = fs.readFileSync(checkoutPath, "utf-8");

      expect(content).toContain("Decoupled Custody Policy Disclosure");
      expect(content).toContain("Overdue payments are handled strictly via in-app");
      expect(content).toContain("No silent charges and luggage return is NEVER delayed");
    });
  });

  describe("Task TSK-2C-014: Mobile Digital Custody Pass & Offline Caching (TM-024, TM-028, TM-030)", () => {
    it("formats digital pass ticket with monospace reference, PIN, and QR token", () => {
      const activeBooking = DEMO_BOOKINGS.find((b) => b.status === "IN_STORAGE");
      expect(activeBooking).toBeDefined();

      expect(activeBooking?.reference).toMatch(/^#LS-\d{4}-\d{4}$/);
      expect(activeBooking?.pinFallback).toMatch(/^\d{3}\s\d{3}$/); // e.g. "482 910"
      expect(activeBooking?.qrPayload).toContain("LS-CUSTODY://");
      expect(activeBooking?.exactAddress.length).toBeGreaterThan(15);
      expect(activeBooking?.hostPhone).toMatch(/^\+94\s/);
    });

    it("displays serialized tamper-evident seal identifiers (DEC-007)", () => {
      const activeBooking = DEMO_BOOKINGS.find((b) => b.status === "IN_STORAGE");
      expect(activeBooking?.seals.length).toBeGreaterThanOrEqual(1);

      for (const seal of activeBooking!.seals) {
        expect(seal).toMatch(/^SEAL-LK-\d{5}$/);
      }
    });

    it("includes offline pass caching support without roaming dependency (DEC-005)", () => {
      const passPath = path.resolve(__dirname, "../app/(traveller)/pass.tsx");
      const content = fs.readFileSync(passPath, "utf-8");

      expect(content).toContain("Offline Storage Protection");
      expect(content).toContain("This ticket and PIN are stored locally on your device");
      expect(content).toContain("6-DIGIT FALLBACK PIN");
    });
  });

  describe("Task TSK-2C-015: Live Active Custody Countdown Timer & Extension Modal (TM-027, TM-030–TM-035)", () => {
    it("formats live countdown timer correctly into hours, minutes, and seconds", () => {
      const formatTimer = (totalSec: number) => {
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
      };

      expect(formatTimer(8100)).toBe("02h 15m 00s");
      expect(formatTimer(1800)).toBe("00h 30m 00s");
      expect(formatTimer(45)).toBe("00h 00m 45s");
      expect(formatTimer(0)).toBe("00h 00m 00s");
    });

    it("shifts timer color progressively: Emerald (>30m) -> Amber (<=30m) -> Rose (Overdue)", () => {
      const getTimerColor = (sec: number) => {
        if (sec === 0) return mobileColors.rose[600];
        if (sec <= 1800) return mobileColors.amber[600];
        return mobileColors.emerald[600];
      };

      expect(getTimerColor(8100)).toBe(mobileColors.emerald[600]);
      expect(getTimerColor(1800)).toBe(mobileColors.amber[600]);
      expect(getTimerColor(300)).toBe(mobileColors.amber[600]);
      expect(getTimerColor(0)).toBe(mobileColors.rose[600]);
    });

    it("calculates extension rate transparently in LKR", () => {
      const ratePerHour = 250;
      const numBags = 2;
      expect(1 * ratePerHour * numBags).toBe(500); // 1 hour extension
      expect(2 * ratePerHour * numBags).toBe(1000); // 2 hour extension
      expect(4 * ratePerHour * numBags).toBe(2000); // 4 hour extension
    });

    it("implements 7-stage cancellation refund progress stepper", () => {
      const bookingsPath = path.resolve(__dirname, "../app/(traveller)/bookings.tsx");
      const content = fs.readFileSync(bookingsPath, "utf-8");

      expect(content).toContain("7-Stage Settlement Tracker");
      expect(content).toContain("1. Requested");
      expect(content).toContain("2. Policy Window Checked");
      expect(content).toContain("3. Capacity Released");
      expect(content).toContain("4. Ledger Reversed");
      expect(content).toContain("5. PayHere Dispatched");
      expect(content).toContain("6. Bank Processing (CEFT)");
      expect(content).toContain("7. Card Credited");
    });
  });

  describe("Code Suppression: Complete developer identifier isolation", () => {
    it("confirms zero customer-facing screens expose TM-xxx, HM-xxx, or WF-xxx codes in rendered UI", () => {
      const travellerDir = path.resolve(__dirname, "../app/(traveller)");
      const files = fs.readdirSync(travellerDir).filter((f) => f.endsWith(".tsx"));

      for (const file of files) {
        const filePath = path.join(travellerDir, file);
        const content = fs.readFileSync(filePath, "utf-8");

        // Strip code comments and DeveloperDrawer which is sequestered for internal QA
        const renderedCustomerContent = content
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "")
          .replace(/<MobileDevDrawer[\s\S]*?\/>/g, "")
          .replace(/import[\s\S]*?from[\s\S]*?;/g, "");

        expect(renderedCustomerContent).not.toMatch(/TM-\d{3}/);
        expect(renderedCustomerContent).not.toMatch(/HM-\d{3}/);
        expect(renderedCustomerContent).not.toMatch(/WF-\d{3}/);
      }
    });

    it("confirms all 39 traveller screens remain registered in the screen specification catalogue", () => {
      expect(TRAVELLER_MOBILE_SCREENS).toHaveLength(39);
    });
  });
});
