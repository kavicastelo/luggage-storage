/**
 * Ceylon Warmth & Coastal Precision (CWCP) Design Foundation Tokens
 * Governing Document: DOC-UX-P2C-021 (Design Foundation Specification)
 * 
 * Strict Single Source of Truth for Web, Mobile, and Test Suites.
 */

export interface TokenColorScale {
  readonly 50?: string;
  readonly 100?: string;
  readonly 200?: string;
  readonly 300?: string;
  readonly 400?: string;
  readonly 500: string;
  readonly 600?: string;
  readonly 700?: string;
  readonly 800?: string;
  readonly 900?: string;
  readonly 950?: string;
}

/**
 * 1. CWCP Raw Palette Tokens
 */
export const cwcpPalette = {
  // Coastal Navy — Institutional Security & Grounding
  navy: {
    50: '#F2F5FA',
    100: '#E8EEF8',
    500: '#234694',
    600: '#1B3675', // Accent navy, icons, secondary badges
    700: '#173054',
    800: '#132742', // Secondary containers, interactive hover
    900: '#0A192F', // Primary headers, navigation bars, elevated containers
    950: '#070E1A', // Deepest canvas & primary high-contrast text
  },
  // Ceylon Terracotta — Warmth & Hospitality (DEC-009 Accessible Retune)
  terracotta: {
    50: '#FFF5EF',  // Subtle active card / container background tint
    100: '#FEE8D8', // Soft terracotta badge background
    200: '#FBB78E',
    300: '#F28D52',
    400: '#E86F2C', // Graphic accents, focus rings, and non-text borders (>= 3.0:1 for UI elements)
    500: '#C55013', // Primary CTA background (Strict WCAG 2.2 AA compliant >= 4.50:1 unrounded with #FFFFFF: 4.63:1)
    600: '#B8460A', // Primary CTA button hover state (5.36:1 contrast with #FFFFFF)

    700: '#9E3708', // Active / pressed button states
    800: '#7D2B06',
    900: '#5A1E04',
  },
  // Sunlit Sand — Warm Page Surfaces & Clean Canvas (replaces cold slate)
  sand: {
    50: '#FAF8F5',  // Warm page background canvas
    100: '#F3EFEA', // Light container background, inactive tab strips
    200: '#E5DFD7', // Structural 1px dividers and borders
    300: '#D1C7BB', // Disabled control borders
    400: '#BFB6AA',
    500: '#ABA296', // Placeholder text, subtle icons
    600: '#8C8377',
    700: '#6B635A', // Secondary helper text
    800: '#4B453E',
    900: '#2E2A25',
  },
  white: '#FFFFFF',
  // Semantic Status Tokens
  emerald: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    500: '#10B981',
    600: '#059669', // Confirmed bookings, active custody, verified badges
    700: '#047857',
  },
  amber: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    500: '#F59E0B',
    600: '#D97706', // 30-minute SLA warnings, capacity warnings
    700: '#B45309',
  },
  rose: {
    50: '#FFF1F2',
    100: '#FFE4E6',
    500: '#F43F5E',
    600: '#E11D48', // Overdue bags, cancellations, errors
    700: '#BE123C',
  },
  sky: {
    50: '#F0F9FF',
    100: '#E0F2FE',
    500: '#0EA5E9',
    600: '#0284C7', // Informational notices
    700: '#0369A1',
  },
} as const;

/**
 * 2. Semantic Roles & Intent Mappings
 */
export const cwcpSemanticRoles = {
  surface: {
    canvas: cwcpPalette.sand[50],
    container: cwcpPalette.sand[100],
    card: cwcpPalette.white,
    elevated: cwcpPalette.white,
    divider: cwcpPalette.sand[200],
    border: cwcpPalette.sand[200],
    borderFocus: cwcpPalette.terracotta[400],
    borderDisabled: cwcpPalette.sand[300],
  },
  text: {
    primary: cwcpPalette.navy[950],
    secondary: cwcpPalette.sand[700],
    muted: cwcpPalette.sand[500],
    inverse: cwcpPalette.white,
    brand: cwcpPalette.terracotta[600],
  },
  action: {
    primaryBg: cwcpPalette.terracotta[500],
    primaryHover: cwcpPalette.terracotta[600],
    primaryActive: cwcpPalette.terracotta[700],
    primaryText: cwcpPalette.white,
    secondaryBg: cwcpPalette.navy[900],
    secondaryHover: cwcpPalette.navy[800],
    secondaryActive: cwcpPalette.navy[950],
    secondaryText: cwcpPalette.white,
    ghostHover: cwcpPalette.sand[100],
    ghostText: cwcpPalette.navy[900],
  },
  status: {
    success: cwcpPalette.emerald[600],
    successBg: cwcpPalette.emerald[50],
    successBorder: cwcpPalette.emerald[100],
    warning: cwcpPalette.amber[600],
    warningBg: cwcpPalette.amber[50],
    warningBorder: cwcpPalette.amber[100],
    danger: cwcpPalette.rose[600],
    dangerBg: cwcpPalette.rose[50],
    dangerBorder: cwcpPalette.rose[100],
    info: cwcpPalette.sky[600],
    infoBg: cwcpPalette.sky[50],
    infoBorder: cwcpPalette.sky[100],
  },
} as const;

/**
 * 3. Typography Scale
 */
export const cwcpTypography = {
  fontFamily: {
    sans: 'Plus Jakarta Sans, Inter, system-ui, -apple-system, sans-serif',
    mono: 'JetBrains Mono, Roboto Mono, monospace',
  },
  displayLg: {
    fontSize: '2.5rem', // 40px
    lineHeight: '3rem',  // 48px
    fontWeight: '800',
    letterSpacing: '-0.02em',
  },
  displaySm: {
    fontSize: '2rem',   // 32px
    lineHeight: '2.5rem',// 40px
    fontWeight: '700',
    letterSpacing: '-0.015em',
  },
  headingLg: {
    fontSize: '1.5rem', // 24px
    lineHeight: '2rem',  // 32px
    fontWeight: '700',
    letterSpacing: '-0.01em',
  },
  headingMd: {
    fontSize: '1.25rem',// 20px
    lineHeight: '1.75rem',// 28px
    fontWeight: '600',
  },
  headingSm: {
    fontSize: '1rem',   // 16px
    lineHeight: '1.5rem',// 24px
    fontWeight: '600',
  },
  bodyLg: {
    fontSize: '1rem',   // 16px
    lineHeight: '1.5rem',// 24px
    fontWeight: '400',
  },
  bodyMd: {
    fontSize: '0.875rem', // 14px
    lineHeight: '1.25rem',// 20px
    fontWeight: '400',
  },
  bodySm: {
    fontSize: '0.75rem',  // 12px
    lineHeight: '1rem',   // 16px
    fontWeight: '500',
  },
  codeMono: {
    fontSize: '0.875rem', // 14px
    lineHeight: '1.25rem',// 20px
    fontWeight: '600',
    fontFamily: 'JetBrains Mono, Roboto Mono, monospace',
  },
} as const;

/**
 * 4. Spacing Scale (4px Spatial Baseline)
 */
export const cwcpSpacing = {
  0: '0px',
  1: '4px',    // 0.25rem
  2: '8px',    // 0.5rem
  3: '12px',   // 0.75rem
  4: '16px',   // 1.0rem
  5: '20px',   // 1.25rem
  6: '24px',   // 1.5rem
  8: '32px',   // 2.0rem
  10: '40px',  // 2.5rem
  12: '48px',  // 3.0rem
  16: '64px',  // 4.0rem
  20: '80px',  // 5.0rem
  24: '96px',  // 6.0rem
} as const;

/**
 * 5. Shape & Border Radius Tokens
 */
export const cwcpRadius = {
  none: '0px',
  sm: '6px',      // badges, micro-tags
  md: '8px',      // input fields, buttons
  lg: '12px',     // cards, interactive panels
  xl: '16px',     // elevated modals, bottom sheets
  '2xl': '24px',  // hero card groupings
  full: '9999px', // round pills, avatar circles
} as const;

/**
 * 6. Elevation & Shadows (with Coastal Navy tint)
 */
export const cwcpElevation = {
  sm: '0 1px 2px 0 rgba(10, 25, 47, 0.05)',
  md: '0 4px 6px -1px rgba(10, 25, 47, 0.08), 0 2px 4px -2px rgba(10, 25, 47, 0.05)',
  lg: '0 10px 15px -3px rgba(10, 25, 47, 0.10), 0 4px 6px -4px rgba(10, 25, 47, 0.05)',
  xl: '0 20px 25px -5px rgba(10, 25, 47, 0.12), 0 8px 10px -6px rgba(10, 25, 47, 0.06)',
} as const;

/**
 * 7. Interaction States & Ergonomic Touch Minimums
 */
export const cwcpInteraction = {
  touchTargetMin: '44px',
  focusRing: '0 0 0 2px #FAF8F5, 0 0 0 4px #C55013',
  transitionDefault: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;


/**
 * Consolidated Design System Export
 */
export const cwcpTokens = {
  palette: cwcpPalette,
  roles: cwcpSemanticRoles,
  typography: cwcpTypography,
  spacing: cwcpSpacing,
  radius: cwcpRadius,
  elevation: cwcpElevation,
  interaction: cwcpInteraction,
} as const;

/**
 * Contrast Calculation & WCAG Validation Utilities
 * Formula per WCAG 2.2 Relative Luminance & Contrast Ratio
 */
export function srgbChannelToLinear(channel8Bit: number): number {
  const s = channel8Bit / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((char) => char + char).join('');
  }
  if (cleanHex.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(cleanHex.slice(0, 2), 16),
    g: parseInt(cleanHex.slice(2, 4), 16),
    b: parseInt(cleanHex.slice(4, 6), 16),
  };
}

export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = parseHexColor(hex);
  const rLinear = srgbChannelToLinear(r);
  const gLinear = srgbChannelToLinear(g);
  const bLinear = srgbChannelToLinear(b);
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

export function calculateContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const lum1 = getRelativeLuminance(foregroundHex);
  const lum2 = getRelativeLuminance(backgroundHex);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function passesWcagAA(
  foregroundHex: string,
  backgroundHex: string,
  isLargeText: boolean = false
): boolean {
  const ratio = calculateContrastRatio(foregroundHex, backgroundHex);
  const minimumRatio = isLargeText ? 3.0 : 4.5;
  // Strict unrounded threshold verification
  return ratio >= minimumRatio;
}

