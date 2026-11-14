import { StyleSheet } from "react-native";
import {
  cwcpPalette,
  cwcpSemanticRoles
} from "@luggage-storage/contracts";

/**
 * Unified Coastal Warmth & Colonial Precision (CWCP) Design Tokens for Expo Mobile.
 */
export const mobileColors = {
  ...cwcpPalette,
  canvas: cwcpSemanticRoles.surface.canvas, // #FAF8F5 Sunlit Sand
  container: cwcpSemanticRoles.surface.container, // #F3EFEA
  card: cwcpSemanticRoles.surface.card, // #FFFFFF
  border: cwcpSemanticRoles.surface.border, // #E5DFD7
  borderFocus: cwcpSemanticRoles.surface.borderFocus, // #E86F2C
  borderDisabled: cwcpSemanticRoles.surface.borderDisabled, // #D1C7BB
  primaryText: cwcpSemanticRoles.text.primary, // #070E1A
  secondaryText: cwcpSemanticRoles.text.secondary, // #6B635A
  mutedText: cwcpSemanticRoles.text.muted, // #ABA296
  inverseText: cwcpSemanticRoles.text.inverse, // #FFFFFF
  brandText: cwcpSemanticRoles.text.brand, // #B8460A
  ctaBg: cwcpPalette.terracotta[500], // #C55013
  ctaPressedBg: cwcpPalette.terracotta[600], // #B8460A
  ctaText: cwcpPalette.white
} as const;

export const mobileSurfaces = {
  canvas: mobileColors.canvas,
  container: mobileColors.container,
  card: mobileColors.card,
  elevated: cwcpSemanticRoles.surface.elevated,
  subtle: cwcpPalette.sand[100],
  terracottaSoft: cwcpPalette.terracotta[50],
  navyHeader: cwcpPalette.navy[900],
  navyDeep: cwcpPalette.navy[950],
  divider: cwcpSemanticRoles.surface.divider,
  border: mobileColors.border,
  borderFocus: mobileColors.borderFocus,
  borderDisabled: mobileColors.borderDisabled,
  overlay: "rgba(7, 14, 26, 0.56)"
} as const;

export const mobileTextColors = {
  primary: cwcpPalette.navy[950],
  heading: cwcpPalette.navy[900],
  secondary: cwcpPalette.sand[800], // #4B453E — high contrast >= 8:1 on #FAF8F5/#FFF
  muted: cwcpPalette.sand[700], // #6B635A — WCAG AA >= 5.5:1 on #FFFFFF/#FAF8F5
  placeholder: cwcpPalette.sand[500],
  inverse: cwcpPalette.white,
  brand: cwcpPalette.terracotta[600],
  success: cwcpPalette.emerald[700],
  warning: cwcpPalette.amber[700],
  danger: cwcpPalette.rose[700],
  info: cwcpPalette.sky[700]
} as const;

export const mobileStatusTokens = {
  success: cwcpPalette.emerald[700],
  successIcon: cwcpPalette.emerald[600],
  successBg: cwcpPalette.emerald[50],
  successBorder: cwcpPalette.emerald[100],
  warning: cwcpPalette.amber[700],
  warningIcon: cwcpPalette.amber[600],
  warningBg: cwcpPalette.amber[50],
  warningBorder: cwcpPalette.amber[100],
  danger: cwcpPalette.rose[700],
  dangerIcon: cwcpPalette.rose[600],
  dangerBg: cwcpPalette.rose[50],
  dangerBorder: cwcpPalette.rose[100],
  info: cwcpPalette.sky[700],
  infoIcon: cwcpPalette.sky[600],
  infoBg: cwcpPalette.sky[50],
  infoBorder: cwcpPalette.sky[100],
  neutral: cwcpPalette.sand[800],
  neutralIcon: cwcpPalette.sand[700],
  neutralBg: cwcpPalette.sand[100],
  neutralBorder: cwcpPalette.sand[200]
} as const;

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
  16: 64
} as const;

export const mobileRadius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 24,
  full: 9999
} as const;

export const mobileControlSizes = {
  minTouchTarget: 48,
  buttonSm: 48,
  buttonMd: 50,
  buttonLg: 56,
  inputHeight: 50,
  iconButton: 48,
  headerBarHeight: 56,
  tabBarMinHeight: 62
} as const;

export const mobileIconSizes = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  "2xl": 36
} as const;

export const mobileIconStrokeWidths = {
  thin: 1.75,
  regular: 2,
  bold: 2.25
} as const;

export const mobileLayout = {
  screenPaddingHorizontal: 16,
  sectionGap: 16,
  cardPadding: 16,
  maxContentWidth: 640
} as const;

export const mobileTypography = {
  displayLg: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800" as const,
    letterSpacing: -0.6,
    color: mobileColors.navy[950]
  },
  displaySm: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700" as const,
    letterSpacing: -0.4,
    color: mobileColors.navy[950]
  },
  headingLg: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
    color: mobileColors.navy[900]
  },
  headingMd: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700" as const,
    color: mobileColors.navy[900]
  },
  headingSm: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600" as const,
    color: mobileColors.navy[900]
  },
  bodyLg: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
    color: mobileColors.navy[950]
  },
  bodyMd: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
    color: mobileTextColors.secondary
  },
  bodySm: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
    color: mobileTextColors.muted
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600" as const,
    color: mobileColors.navy[900]
  },
  codeMono: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600" as const,
    fontFamily: "monospace",
    color: mobileColors.navy[950]
  }
} as const;

export const mobileShadows = StyleSheet.create({
  sm: {
    shadowColor: mobileColors.navy[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2
  },
  md: {
    shadowColor: mobileColors.navy[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4
  },
  lg: {
    shadowColor: mobileColors.navy[900],
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8
  }
});

export const mobileElevation = {
  none: {},
  sm: mobileShadows.sm,
  md: mobileShadows.md,
  lg: mobileShadows.lg
} as const;
