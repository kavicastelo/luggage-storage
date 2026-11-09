import { cwcpPalette, cwcpRadius, cwcpElevation, cwcpSpacing } from "@luggage-storage/contracts";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // CWCP Canonical Color Palette
        navy: cwcpPalette.navy,
        terracotta: cwcpPalette.terracotta,
        sand: cwcpPalette.sand,
        emerald: cwcpPalette.emerald,
        amber: cwcpPalette.amber,
        rose: cwcpPalette.rose,
        sky: cwcpPalette.sky,

        // Backwards compatibility mappings re-tuned to CWCP
        brand: {
          50: cwcpPalette.sand[50],
          100: cwcpPalette.terracotta[100],
          500: cwcpPalette.terracotta[500], // #C85316 Accessible Ceylon Terracotta
          600: cwcpPalette.terracotta[600], // #B8460A
          700: cwcpPalette.terracotta[700], // #9E3708
          800: cwcpPalette.navy[800],
          900: cwcpPalette.navy[900],       // #0A192F Coastal Navy
        },
        kiri: {
          cream: cwcpPalette.sand[50],     // #FAF8F5 Warm Sand
          orange: cwcpPalette.terracotta[500], // #C85316 Accessible Terracotta (re-tuned from #E86F2C)
          amber: cwcpPalette.amber[500],
          maroon: "#5C0620",
          navy: cwcpPalette.navy[900],      // #0A192F
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Roboto Mono", "monospace"],
      },
      fontSize: {
        "display-lg": ["2.5rem", { lineHeight: "3rem", letterSpacing: "-0.02em", fontWeight: "800" }],
        "display-sm": ["2rem", { lineHeight: "2.5rem", letterSpacing: "-0.015em", fontWeight: "700" }],
        "heading-lg": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.01em", fontWeight: "700" }],
        "heading-md": ["1.25rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        "heading-sm": ["1rem", { lineHeight: "1.5rem", fontWeight: "600" }],
        "body-lg": ["1rem", { lineHeight: "1.5rem", fontWeight: "400" }],
        "body-md": ["0.875rem", { lineHeight: "1.25rem", fontWeight: "400" }],
        "body-sm": ["0.75rem", { lineHeight: "1rem", fontWeight: "500" }],
        "code-mono": ["0.875rem", { lineHeight: "1.25rem", fontWeight: "600" }],
      },
      borderRadius: {
        sm: cwcpRadius.sm,
        md: cwcpRadius.md,
        lg: cwcpRadius.lg,
        xl: cwcpRadius.xl,
        "2xl": cwcpRadius["2xl"],
        full: cwcpRadius.full,
      },
      boxShadow: {
        sm: cwcpElevation.sm,
        md: cwcpElevation.md,
        lg: cwcpElevation.lg,
        xl: cwcpElevation.xl,
      },
      minHeight: {
        touch: "44px",
      },
      minWidth: {
        touch: "44px",
      },
    },
  },
  plugins: [],
};
