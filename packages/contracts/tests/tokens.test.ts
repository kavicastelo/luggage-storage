import { describe, it, expect } from 'vitest';
import {
  cwcpPalette,
  cwcpTypography,
  cwcpSpacing,
  cwcpRadius,
  cwcpElevation,
  cwcpInteraction,
  calculateContrastRatio,
  passesWcagAA,
} from '../src/tokens.js';


describe('CWCP Design Tokens & Accessibility Matrix', () => {
  describe('Color Palette & DEC-009 Re-tune', () => {
    it('defines institutional Coastal Navy grounding tokens', () => {
      expect(cwcpPalette.navy[900]).toBe('#0A192F');
      expect(cwcpPalette.navy[950]).toBe('#070E1A');
      expect(cwcpPalette.navy[800]).toBe('#132742');
      expect(cwcpPalette.navy[600]).toBe('#1B3675');
    });

    it('defines accessible Ceylon Terracotta with DEC-009 retune', () => {
      expect(cwcpPalette.terracotta[500]).toBe('#C55013');
      expect(cwcpPalette.terracotta[600]).toBe('#B8460A');
      expect(cwcpPalette.terracotta[700]).toBe('#9E3708');
      expect(cwcpPalette.terracotta[400]).toBe('#E86F2C');
      expect(cwcpPalette.terracotta[100]).toBe('#FEE8D8');
      expect(cwcpPalette.terracotta[50]).toBe('#FFF5EF');
    });


    it('defines warm Sunlit Sand surface neutrals replacing cold slate', () => {
      expect(cwcpPalette.sand[50]).toBe('#FAF8F5');
      expect(cwcpPalette.sand[100]).toBe('#F3EFEA');
      expect(cwcpPalette.sand[200]).toBe('#E5DFD7');
      expect(cwcpPalette.sand[300]).toBe('#D1C7BB');
      expect(cwcpPalette.white).toBe('#FFFFFF');
    });

    it('defines semantic status tokens', () => {
      expect(cwcpPalette.emerald[600]).toBe('#059669');
      expect(cwcpPalette.amber[600]).toBe('#D97706');
      expect(cwcpPalette.rose[600]).toBe('#E11D48');
      expect(cwcpPalette.sky[600]).toBe('#0284C7');
    });
  });

  describe('WCAG 2.2 AA Contrast Calculations', () => {
    it('verifies primary button white text on terracotta[500] strictly meets unrounded AA requirement', () => {
      const ratio = calculateContrastRatio('#FFFFFF', cwcpPalette.terracotta[500]);
      // Strict unrounded WCAG AA threshold is >= 4.5:1
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(ratio).toBeCloseTo(4.63, 1);
      expect(passesWcagAA('#FFFFFF', cwcpPalette.terracotta[500])).toBe(true);
    });

    it('verifies previous #C85316 was mathematically < 4.5:1 unrounded, validating the correction', () => {
      const c85316Ratio = calculateContrastRatio('#FFFFFF', '#C85316');
      expect(c85316Ratio).toBeLessThan(4.5);
      expect(passesWcagAA('#FFFFFF', '#C85316')).toBe(false);
    });

    it('verifies terracotta[600] provides enhanced contrast for hover/focus', () => {
      const ratio = calculateContrastRatio('#FFFFFF', cwcpPalette.terracotta[600]);
      expect(ratio).toBeGreaterThan(5.0);
      expect(passesWcagAA('#FFFFFF', cwcpPalette.terracotta[600])).toBe(true);
    });


    it('verifies old #E86F2C fails WCAG AA for normal text, validating DEC-009', () => {
      const oldRatio = calculateContrastRatio('#FFFFFF', '#E86F2C');
      expect(oldRatio).toBeLessThan(3.5); // ~3.11:1
      expect(passesWcagAA('#FFFFFF', '#E86F2C', false)).toBe(false);
    });

    it('verifies high-contrast navy text on sand canvas', () => {
      const ratio = calculateContrastRatio(cwcpPalette.navy[950], cwcpPalette.sand[50]);
      expect(ratio).toBeGreaterThan(15.0);
      expect(passesWcagAA(cwcpPalette.navy[950], cwcpPalette.sand[50])).toBe(true);
    });

    it('verifies high-contrast navy text on white background', () => {
      const ratio = calculateContrastRatio(cwcpPalette.navy[900], '#FFFFFF');
      expect(ratio).toBeGreaterThan(15.0);
      expect(passesWcagAA(cwcpPalette.navy[900], '#FFFFFF')).toBe(true);
    });

    it('verifies secondary text contrast meets AA requirement', () => {
      const ratio = calculateContrastRatio(cwcpPalette.sand[700], cwcpPalette.sand[50]);
      expect(ratio).toBeGreaterThan(4.5);
      expect(passesWcagAA(cwcpPalette.sand[700], cwcpPalette.sand[50])).toBe(true);
    });
  });

  describe('Typography Tokens', () => {
    it('exports complete typography scale with mobile/desktop sizes', () => {
      expect(cwcpTypography.displayLg.fontSize).toBe('2.5rem');
      expect(cwcpTypography.displaySm.fontSize).toBe('2rem');
      expect(cwcpTypography.headingLg.fontSize).toBe('1.5rem');
      expect(cwcpTypography.headingMd.fontSize).toBe('1.25rem');
      expect(cwcpTypography.headingSm.fontSize).toBe('1rem');
      expect(cwcpTypography.bodyLg.fontSize).toBe('1rem');
      expect(cwcpTypography.bodyMd.fontSize).toBe('0.875rem');
      expect(cwcpTypography.bodySm.fontSize).toBe('0.75rem');
      expect(cwcpTypography.codeMono.fontFamily).toContain('Mono');
    });
  });

  describe('Spatial Grid & Shapes', () => {
    it('adheres to 4px spatial baseline', () => {
      expect(cwcpSpacing[1]).toBe('4px');
      expect(cwcpSpacing[2]).toBe('8px');
      expect(cwcpSpacing[3]).toBe('12px');
      expect(cwcpSpacing[4]).toBe('16px');
      expect(cwcpSpacing[6]).toBe('24px');
      expect(cwcpSpacing[8]).toBe('32px');
      expect(cwcpSpacing[12]).toBe('48px');
    });

    it('defines radius scale from none to full pill', () => {
      expect(cwcpRadius.none).toBe('0px');
      expect(cwcpRadius.sm).toBe('6px');
      expect(cwcpRadius.md).toBe('8px');
      expect(cwcpRadius.lg).toBe('12px');
      expect(cwcpRadius.xl).toBe('16px');
      expect(cwcpRadius['2xl']).toBe('24px');
      expect(cwcpRadius.full).toBe('9999px');
    });

    it('defines elevation with coastal navy shadow tones', () => {
      expect(cwcpElevation.sm).toContain('rgba(10, 25, 47');
      expect(cwcpElevation.md).toContain('rgba(10, 25, 47');
      expect(cwcpElevation.lg).toContain('rgba(10, 25, 47');
    });

    it('enforces 44px ergonomic touch target minimum', () => {
      expect(cwcpInteraction.touchTargetMin).toBe('44px');
    });
  });
});
