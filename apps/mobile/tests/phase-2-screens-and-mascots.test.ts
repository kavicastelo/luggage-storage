import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  ALL_MOBILE_MASCOT_KEYS,
  getMobileMascotMeta
} from "../src/lib/mascots.js";
import {
  TRAVELLER_MOBILE_SCREENS,
  HOST_MOBILE_SCREENS,
  ALL_MOBILE_SCREENS,
  RESERVED_MOBILE_SCREEN_IDS
} from "../src/data/mock-marketplace.js";

describe("Phase 2 — Mobile Screen Registry (70 Active Screens) & Mascot Assets", () => {
  it("bundles all 20 mascot PNG assets in apps/mobile/assets/mascots", () => {
    expect(ALL_MOBILE_MASCOT_KEYS).toHaveLength(20);

    for (const key of ALL_MOBILE_MASCOT_KEYS) {
      const meta = getMobileMascotMeta(key);
      expect(meta.filename).toMatch(/^LS-mascot_\d{2}_[a-z-]+\.png$/);
      expect(meta.source).toBeDefined();
      expect(meta.alt.length).toBeGreaterThan(15);

      const diskPath = path.resolve(__dirname, "../assets/mascots", meta.filename);
      expect(fs.existsSync(diskPath)).toBe(true);
    }
  });

  it("registers exactly 39 Traveller Mobile (TM) and 31 Host Mobile (HM) active screens (70 total Mobile screens)", () => {
    expect(TRAVELLER_MOBILE_SCREENS).toHaveLength(39);
    expect(HOST_MOBILE_SCREENS).toHaveLength(31);
    expect(ALL_MOBILE_SCREENS).toHaveLength(70);

    const uniqueIds = new Set(ALL_MOBILE_SCREENS.map((s) => s.id));
    expect(uniqueIds.size).toBe(70);
  });

  it("never implements any of the 11 reserved screen IDs as active screens", () => {
    expect(RESERVED_MOBILE_SCREEN_IDS).toHaveLength(11);
    const activeIds = new Set(ALL_MOBILE_SCREENS.map((s) => s.id));

    for (const reservedId of RESERVED_MOBILE_SCREEN_IDS) {
      expect(activeIds.has(reservedId)).toBe(false);
    }
  });

  it("distinguishes Host Owner-only mobile screens from Host Staff operational screens", () => {
    const ownerOnlyIds = HOST_MOBILE_SCREENS.filter(
      (s) => s.actorScope === "Host Owner"
    ).map((s) => s.id);

    expect(ownerOnlyIds).toEqual(
      expect.arrayContaining([
        "HM-003",
        "HM-004",
        "HM-005",
        "HM-009",
        "HM-010",
        "HM-011",
        "HM-013",
        "HM-014",
        "HM-029",
        "HM-030",
        "HM-031",
        "HM-033",
        "HM-034",
        "HM-037"
      ])
    );

    const staffAccessibleIds = HOST_MOBILE_SCREENS.filter(
      (s) => s.actorScope === "Host / Staff"
    ).map((s) => s.id);

    expect(staffAccessibleIds).toEqual(
      expect.arrayContaining([
        "HM-006",
        "HM-007",
        "HM-018",
        "HM-019",
        "HM-020",
        "HM-021",
        "HM-022",
        "HM-023",
        "HM-024",
        "HM-025",
        "HM-026",
        "HM-027",
        "HM-028"
      ])
    );
  });

  it("aligns mobile screen descriptions with OQ-014 (QR/PIN fallback, configurable photo evidence) and OQ-015 (configurable grace & decoupled custody)", () => {
    for (const screen of ALL_MOBILE_SCREENS) {
      expect(screen.summary.toLowerCase()).not.toContain("dual-factor");
    }

    const hm021 = HOST_MOBILE_SCREENS.find((s) => s.id === "HM-021");
    const hm023 = HOST_MOBILE_SCREENS.find((s) => s.id === "HM-023");
    const hm026 = HOST_MOBILE_SCREENS.find((s) => s.id === "HM-026");
    const hm028 = HOST_MOBILE_SCREENS.find((s) => s.id === "HM-028");

    expect(hm021?.summary).toContain("PIN fallback");
    expect(hm023?.summary).toContain("optional by default");
    expect(hm026?.summary).toContain("configurable");
    expect(hm028?.summary).toContain("BR-035");
  });
});

