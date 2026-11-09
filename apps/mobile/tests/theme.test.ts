import { describe, it, expect } from "vitest";
import { mobileColors, mobileSpacing, mobileRadius, mobileTypography } from "../src/lib/theme";

describe("Mobile CWCP Theme Tokens", () => {
  it("exports Ceylon Terracotta CTA color #C55013 with white text", () => {
    expect(mobileColors.ctaBg).toBe("#C55013");
    expect(mobileColors.ctaText).toBe("#FFFFFF");
    expect(mobileColors.terracotta[500]).toBe("#C55013");
    expect(mobileColors.terracotta[600]).toBe("#B8460A");
  });


  it("exports Coastal Navy grounding tokens", () => {
    expect(mobileColors.navy[900]).toBe("#0A192F");
    expect(mobileColors.navy[950]).toBe("#070E1A");
  });

  it("exports Sunlit Sand canvas surface token", () => {
    expect(mobileColors.canvas).toBe("#FAF8F5");
    expect(mobileColors.sand[50]).toBe("#FAF8F5");
  });

  it("exports 4px spatial baseline spacing", () => {
    expect(mobileSpacing[1]).toBe(4);
    expect(mobileSpacing[2]).toBe(8);
    expect(mobileSpacing[4]).toBe(16);
    expect(mobileSpacing[6]).toBe(24);
  });

  it("exports mobile typography scale", () => {
    expect(mobileTypography.displayLg.fontSize).toBe(32);
    expect(mobileTypography.headingLg.fontSize).toBe(22);
    expect(mobileTypography.bodyMd.fontSize).toBe(14);
  });

  it("exports mobile radius scale", () => {
    expect(mobileRadius.md).toBe(8);
    expect(mobileRadius.lg).toBe(12);
    expect(mobileRadius.xl).toBe(16);
  });

});
