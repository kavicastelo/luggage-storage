import {
  cwcpPalette,
  cwcpSemanticRoles,
} from "@luggage-storage/contracts";

import { StyleSheet } from "react-native";

/**
 * Mobile-Optimized CWCP Theme System
 * Direct consumption of @luggage-storage/contracts tokens for React Native.
 */
export const mobileColors = {
  ...cwcpPalette,
  canvas: cwcpSemanticRoles.surface.canvas,
  card: cwcpSemanticRoles.surface.card,
  border: cwcpSemanticRoles.surface.border,
  primaryText: cwcpSemanticRoles.text.primary,
  secondaryText: cwcpSemanticRoles.text.secondary,
  ctaBg: cwcpPalette.terracotta[500], // #C85316
  ctaText: cwcpPalette.white,
};

export const mobileSpacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
};

export const mobileRadius = {
  none: 0,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 24,
  full: 9999,
};

export const mobileTypography = {
  displayLg: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "800" as const,
    color: mobileColors.navy[950],
  },
  displaySm: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "700" as const,
    color: mobileColors.navy[950],
  },
  headingLg: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700" as const,
    color: mobileColors.navy[900],
  },
  headingMd: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600" as const,
    color: mobileColors.navy[900],
  },
  headingSm: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600" as const,
    color: mobileColors.navy[900],
  },
  bodyLg: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400" as const,
    color: mobileColors.navy[950],
  },
  bodyMd: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
    color: mobileColors.sand[700],
  },
  bodySm: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
    color: mobileColors.sand[600],
  },
  codeMono: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600" as const,
    fontFamily: "monospace",
    color: mobileColors.navy[950],
  },
};

export const mobileShadows = StyleSheet.create({
  sm: {
    shadowColor: mobileColors.navy[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: mobileColors.navy[900],
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: mobileColors.navy[900],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
});
