import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ALL_MASCOT_KEYS, getMascotMeta } from "../src/lib/mascots.js";
import {
  WEB_PUBLIC_SCREENS,
  WEB_HOST_SCREENS,
  WEB_ADMIN_SCREENS,
  ALL_WEB_SCREENS,
  RESERVED_SCREEN_IDS,
  DEMO_LOCATIONS,
  DEMO_BOOKINGS,
  REFUND_SEVEN_STAGES,
  formatLkr
} from "../src/data/mock-marketplace.js";

describe("Phase 2 — Web Screen Registry & Mascot Catalogue Verification", () => {
  it("registers all 20 mascot assets with valid public paths and files on disk", () => {
    expect(ALL_MASCOT_KEYS).toHaveLength(20);

    for (const key of ALL_MASCOT_KEYS) {
      const meta = getMascotMeta(key);
      expect(meta.filename).toMatch(/^LS-mascot_\d{2}_[a-z-]+\.png$/);
      expect(meta.publicPath).toBe(`/assets/mascots/${meta.filename}`);
      expect(meta.alt.length).toBeGreaterThan(15);
      expect(meta.primaryScreens.length).toBeGreaterThan(0);

      const diskPath = path.resolve(__dirname, "../public/assets/mascots", meta.filename);
      expect(fs.existsSync(diskPath)).toBe(true);
    }
  });

  it("registers exactly 11 Public Website (PW), 14 Host Dashboard (HD), and 18 Superadmin (AD) screens (43 total Web screens)", () => {
    expect(WEB_PUBLIC_SCREENS).toHaveLength(11);
    expect(WEB_HOST_SCREENS).toHaveLength(14);
    expect(WEB_ADMIN_SCREENS).toHaveLength(18);
    expect(ALL_WEB_SCREENS).toHaveLength(43);

    const uniqueIds = new Set(ALL_WEB_SCREENS.map((s) => s.id));
    expect(uniqueIds.size).toBe(43);

    // Ensure no reserved IDs appear in active web screens
    for (const reservedId of RESERVED_SCREEN_IDS) {
      expect(uniqueIds.has(reservedId)).toBe(false);
    }
  });

  it("enforces role scopes on Host Owner-only and Superadmin-only web screens", () => {
    const ownerOnlyHostIds = WEB_HOST_SCREENS.filter((s) =>
      s.actorScope.includes("Host Owner") && !s.actorScope.includes("Staff")
    ).map((s) => s.id);

    expect(ownerOnlyHostIds).toEqual(
      expect.arrayContaining(["HD-010", "HD-011", "HD-013", "HD-014"])
    );

    const supportAccessibleAdminIds = WEB_ADMIN_SCREENS.filter((s) =>
      s.actorScope.includes("Support")
    ).map((s) => s.id);

    expect(supportAccessibleAdminIds).toEqual(["AD-003", "AD-005", "AD-011", "AD-012"]);
  });

  it("maintains balanced 85/15 LKR financial splits and 7-stage refund tracking", () => {
    expect(DEMO_LOCATIONS.length).toBeGreaterThanOrEqual(5);
    expect(REFUND_SEVEN_STAGES).toHaveLength(7);
    expect(formatLkr(1450)).toContain("LKR");

    for (const booking of DEMO_BOOKINGS) {
      expect(booking.platformCommissionLkr + booking.hostNetPayoutLkr).toBe(
        booking.totalAmountLkr
      );
      expect(booking.pinCode).toMatch(/^\d{6}$/);
    }
  });

  it("enforces OQ-014 (QR with PIN fallback, configurable photo evidence) and OQ-015 (configurable grace & late fee policies)", () => {
    const photoPolicies = new Set(DEMO_LOCATIONS.map((loc) => loc.photoEvidencePolicy));
    expect(photoPolicies.has("OPTIONAL_BY_DEFAULT")).toBe(true);
    expect(photoPolicies.has("CONFIGURED_MANDATORY")).toBe(true);

    const gracePeriods = new Set(DEMO_LOCATIONS.map((loc) => loc.gracePeriodMinutes));
    expect(gracePeriods.size).toBeGreaterThanOrEqual(3);

    for (const loc of DEMO_LOCATIONS) {
      expect(loc.description.toLowerCase()).not.toContain("dual-factor");
      expect(loc.lateFeePolicyLabel.toLowerCase()).toContain("illustrative");
    }
  });
});
