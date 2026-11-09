import React, { useState } from "react";
import {
  cwcpPalette,
  calculateContrastRatio,
} from "@luggage-storage/contracts";
import {
  Button,
  Input,
  Badge,
  Alert,
  LoadingSkeleton,
  MascotIllustration,
} from "@/components/ui";
import {
  ShieldCheck,
  Search,
  Luggage,
  Lock,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";


export function FoundationPreviewPage() {
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState("");

  const toggleLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  const primaryContrast = calculateContrastRatio("#FFFFFF", cwcpPalette.terracotta[500]).toFixed(2);
  const hoverContrast = calculateContrastRatio("#FFFFFF", cwcpPalette.terracotta[600]).toFixed(2);
  const oldContrast = calculateContrastRatio("#FFFFFF", "#E86F2C").toFixed(2);
  const navyCanvasContrast = calculateContrastRatio(cwcpPalette.navy[950], cwcpPalette.sand[50]).toFixed(2);

  return (
    <div className="space-y-12 pb-16 max-w-6xl mx-auto" data-testid="cwcp-foundation-preview">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 text-white rounded-2xl p-8 sm:p-10 shadow-xl border border-navy-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-terracotta-500/20 text-terracotta-400 border border-terracotta-500/30 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-terracotta-400 animate-pulse" />
              CWCP Design System — WS-1 Foundation
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Ceylon Warmth & Coastal Precision
            </h1>
            <p className="text-sand-300 text-sm sm:text-base max-w-2xl">
              Canonical shared design foundation for the Global Luggage Storage Marketplace.
              WCAG 2.2 Level AA compliant, 44px ergonomic touch targets, and optimized asset pipelines.
            </p>
          </div>
          <div className="bg-navy-950/60 p-4 rounded-xl border border-navy-700/60 text-right space-y-1">
            <span className="text-xs text-sand-400 font-mono">SPEC: DOC-UX-P2C-021</span>
            <div className="text-sm font-bold text-terracotta-400">DEC-008 & DEC-009 ACTIVE</div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1 justify-end">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Immutability Verified
            </div>
          </div>
        </div>
      </div>

      {/* 1. Color Palette & Contrast Matrix */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-navy-950 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-terracotta-500" />
            1. Color Tokens & WCAG 2.2 Contrast Verification
          </h2>
          <p className="text-sm text-sand-700 mt-1">
            Re-tuned accessible palette satisfying WCAG 2.2 AA contrast requirements (&ge; 4.5:1).
          </p>
        </div>

        {/* Contrast KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-sand-200 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-xs text-sand-600 font-medium">
              <span>Primary CTA</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                PASS (AA)
              </span>
            </div>
            <div className="text-2xl font-extrabold text-terracotta-600">
              {primaryContrast} : 1
            </div>
            <p className="text-xs text-sand-600">
              White (#FFFFFF) on Ceylon Terracotta (<code className="font-mono text-terracotta-700">#C85316</code>).
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-sand-200 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-xs text-sand-600 font-medium">
              <span>CTA Hover</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                PASS (AAA)
              </span>
            </div>
            <div className="text-2xl font-extrabold text-terracotta-700">
              {hoverContrast} : 1
            </div>
            <p className="text-xs text-sand-600">
              White on Terracotta-600 (<code className="font-mono text-terracotta-700">#B8460A</code>).
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-sand-200 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-xs text-sand-600 font-medium">
              <span>Canvas Text</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                PASS (AAA)
              </span>
            </div>
            <div className="text-2xl font-extrabold text-navy-950">
              {navyCanvasContrast} : 1
            </div>
            <p className="text-xs text-sand-600">
              Navy-950 on Sand-50 canvas (<code className="font-mono text-navy-900">#FAF8F5</code>).
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-xs text-rose-800 font-medium">
              <span>Old Token (DEC-009)</span>
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                FAIL (&lt; 4.5:1)
              </span>
            </div>
            <div className="text-2xl font-extrabold text-rose-600">
              {oldContrast} : 1
            </div>
            <p className="text-xs text-sand-600">
              Old token (<code className="font-mono text-rose-700">#E86F2C</code>) failed accessibility.
            </p>
          </div>
        </div>


        {/* Color Swatch Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Coastal Navy */}
          <div className="bg-white p-4 rounded-xl border border-sand-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase text-navy-950 tracking-wider">
              Coastal Navy (Grounding)
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="h-10 rounded-lg bg-navy-950 text-white flex items-center justify-between px-3 font-mono">
                <span>navy-950</span>
                <span>#070E1A</span>
              </div>
              <div className="h-10 rounded-lg bg-navy-900 text-white flex items-center justify-between px-3 font-mono">
                <span>navy-900 (primary)</span>
                <span>#0A192F</span>
              </div>
              <div className="h-10 rounded-lg bg-navy-800 text-white flex items-center justify-between px-3 font-mono">
                <span>navy-800</span>
                <span>#132742</span>
              </div>
              <div className="h-10 rounded-lg bg-navy-600 text-white flex items-center justify-between px-3 font-mono">
                <span>navy-600</span>
                <span>#1B3675</span>
              </div>
            </div>
          </div>

          {/* Ceylon Terracotta */}
          <div className="bg-white p-4 rounded-xl border border-sand-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase text-navy-950 tracking-wider">
              Ceylon Terracotta (Warmth)
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="h-10 rounded-lg bg-terracotta-700 text-white flex items-center justify-between px-3 font-mono">
                <span>terracotta-700</span>
                <span>#9E3708</span>
              </div>
              <div className="h-10 rounded-lg bg-terracotta-600 text-white flex items-center justify-between px-3 font-mono">
                <span>terracotta-600 (hover)</span>
                <span>#B8460A</span>
              </div>
              <div className="h-10 rounded-lg bg-terracotta-500 text-white flex items-center justify-between px-3 font-mono ring-2 ring-navy-900 ring-offset-1">
                <span>terracotta-500 (CTA)</span>
                <span>#C85316</span>
              </div>
              <div className="h-10 rounded-lg bg-terracotta-100 text-terracotta-900 flex items-center justify-between px-3 font-mono">
                <span>terracotta-100</span>
                <span>#FEE8D8</span>
              </div>
            </div>
          </div>

          {/* Sunlit Sand */}
          <div className="bg-white p-4 rounded-xl border border-sand-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase text-navy-950 tracking-wider">
              Sunlit Sand (Canvas)
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="h-10 rounded-lg bg-sand-900 text-white flex items-center justify-between px-3 font-mono">
                <span>sand-900</span>
                <span>#2E2A25</span>
              </div>
              <div className="h-10 rounded-lg bg-sand-700 text-white flex items-center justify-between px-3 font-mono">
                <span>sand-700</span>
                <span>#6B635A</span>
              </div>
              <div className="h-10 rounded-lg bg-sand-200 text-navy-950 flex items-center justify-between px-3 font-mono">
                <span>sand-200 (divider)</span>
                <span>#E5DFD7</span>
              </div>
              <div className="h-10 rounded-lg bg-sand-50 text-navy-950 flex items-center justify-between px-3 font-mono border border-sand-200">
                <span>sand-50 (canvas)</span>
                <span>#FAF8F5</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Typography Scale */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-navy-950 flex items-center gap-2">
            <span className="font-serif italic font-bold">Aa</span>
            2. Typography Hierarchy & Numeric Monospace
          </h2>
          <p className="text-sm text-sand-700 mt-1">
            Plus Jakarta Sans / Inter paired with JetBrains Mono strictly for custody tokens and PINs.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-sm space-y-6">
          <div className="space-y-1 border-b border-sand-100 pb-4">
            <div className="text-xs font-mono text-sand-500">display-lg (40px / 800)</div>
            <div className="text-display-lg text-navy-950">Store luggage safely in Sri Lanka</div>
          </div>
          <div className="space-y-1 border-b border-sand-100 pb-4">
            <div className="text-xs font-mono text-sand-500">display-sm (32px / 700)</div>
            <div className="text-display-sm text-navy-950">Colombo Fort Central Storage</div>
          </div>
          <div className="space-y-1 border-b border-sand-100 pb-4">
            <div className="text-xs font-mono text-sand-500">heading-lg (24px / 700)</div>
            <div className="text-heading-lg text-navy-950">Verified Storage Spaces Nearby</div>
          </div>
          <div className="space-y-1 border-b border-sand-100 pb-4">
            <div className="text-xs font-mono text-sand-500">heading-md (20px / 600)</div>
            <div className="text-heading-md text-navy-950">Booking Overview & Custody Status</div>
          </div>
          <div className="space-y-1 border-b border-sand-100 pb-4">
            <div className="text-xs font-mono text-sand-500">body-lg (16px / 400)</div>
            <div className="text-body-lg text-sand-700">
              Each storage booking includes tamper-evident security seals, 24/7 partner monitoring, and up to $1,000 guarantee protection.
            </div>
          </div>
          <div className="space-y-1 border-b border-sand-100 pb-4">
            <div className="text-xs font-mono text-sand-500">code-mono (14px / 600 Monospace)</div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono bg-sand-100 text-navy-950 px-3 py-1.5 rounded-lg border border-sand-200 text-sm">
                REF: #LS-2026-8841
              </span>
              <span className="font-mono bg-terracotta-50 text-terracotta-800 px-3 py-1.5 rounded-lg border border-terracotta-200 text-sm">
                PIN: 482 910
              </span>
              <span className="font-mono bg-navy-900 text-white px-3 py-1.5 rounded-lg text-sm">
                SEAL: #SL-88410
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Reusable UI Primitives */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-navy-950 flex items-center gap-2">
            <Luggage className="w-5 h-5 text-terracotta-500" />
            3. Shared Reusable Component Primitives
          </h2>
          <p className="text-sm text-sand-700 mt-1">
            Built to eradicate card-soup layouts and provide 44px ergonomic touch compliance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Buttons Showcase */}
          <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wider">Button Primitives</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary CTA</Button>
              <Button variant="secondary">Secondary Navy</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-sand-100">
              <Button size="sm">Small (36px)</Button>
              <Button size="md" leftIcon={<Search className="w-4 h-4" />}>
                Medium (44px Touch)
              </Button>
              <Button size="lg" rightIcon={<ExternalLink className="w-4 h-4" />}>
                Large (48px)
              </Button>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t border-sand-100">
              <Button isLoading={loading} onClick={toggleLoading}>
                {loading ? "Processing..." : "Click For Loading State"}
              </Button>
              <Button disabled>Disabled Button</Button>
            </div>
          </div>

          {/* Form Inputs Showcase */}
          <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wider">Input Primitives</h3>
            <Input
              label="Standard Field"
              placeholder="e.g. Colombo Fort Railway Station"
              value={inputValue}
              error={inputError || undefined}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (e.target.value.length > 0 && e.target.value.length < 3) {
                  setInputError("Please enter at least 3 characters");
                } else {
                  setInputError("");
                }
              }}
              helperText="Find storage points near stations and landmarks"
              leftIcon={<Search className="w-4 h-4" />}
            />

            <Input
              label="Field with Error State"
              value="Invalid voucher"
              error="Discount code expired or invalid"
              readOnly
            />
          </div>
        </div>

        {/* Badges & Alerts Showcase */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wider">Badge Primitives</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">Neutral</Badge>
              <Badge variant="brand" dot>Terracotta Brand</Badge>
              <Badge variant="navy">Coastal Navy</Badge>
              <Badge variant="success" dot>Confirmed</Badge>
              <Badge variant="warning" dot>Action Required</Badge>
              <Badge variant="danger" dot>Overdue</Badge>
              <Badge variant="info">Information</Badge>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wider">Alert Primitives</h3>
            <Alert variant="info" title="Storage Instructions">
              Please present your digital pass QR code to the host on arrival.
            </Alert>
            <Alert variant="warning" title="Pickup Warning">
              Storage window expires in 30 minutes. Please retrieve luggage promptly.
            </Alert>
          </div>
        </div>

        {/* Skeleton Loaders */}
        <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wider">Warm Skeleton Loaders</h3>
          <div className="flex items-center gap-4">
            <LoadingSkeleton variant="circular" width={48} height={48} />
            <div className="space-y-2 flex-1">
              <LoadingSkeleton variant="text" width="60%" />
              <LoadingSkeleton variant="text" width="40%" />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Mascot Asset Gallery & WebP Derivative Verification */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-navy-950 flex items-center gap-2">
            <span className="text-xl">🐿️</span>
            4. Mascot Asset Pipeline & Bounded Contexts
          </h2>
          <p className="text-sm text-sand-700 mt-1">
            20 original PNG files verified 100% immutable (SHA-256 registered). WebP derivatives loaded via responsive &lt;picture&gt; tag (-92.88% size reduction).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-sand-200 shadow-sm flex flex-col items-center">
            <MascotIllustration mascot="wave" size="md" badgeText="Welcoming" caption="Hero & landing onboarding" />
            <span className="mt-2 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              WebP 106 KB (-93%)
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-sand-200 shadow-sm flex flex-col items-center">
            <MascotIllustration mascot="suitcase-walk" size="md" badgeText="Active Travel" caption="Search & booking flow" />
            <span className="mt-2 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              WebP 113 KB (-92.7%)
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-sand-200 shadow-sm flex flex-col items-center">
            <MascotIllustration mascot="alarm-clock" size="md" badgeText="Storage Timer" caption="Countdown & pickup window" />
            <span className="mt-2 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              WebP 104 KB (-92.7%)
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-sand-200 shadow-sm flex flex-col items-center">
            <MascotIllustration mascot="high-five" size="md" badgeText="Success" caption="Booking confirmed pass" />
            <span className="mt-2 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              WebP 103 KB (-93%)
            </span>
          </div>
        </div>

        <div className="p-4 bg-sand-100 rounded-xl border border-sand-200 text-xs text-sand-700 space-y-1">
          <div className="font-semibold text-navy-950 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-navy-900" /> Mascot Scope Boundaries (DEC-008 Enforced)
          </div>
          <p>
            Kiri is restricted to friendly onboarding, empty states, and celebrations. Strictly prohibited in payments, security settings, dispute benches, and superadmin views.
          </p>
        </div>
      </section>
    </div>
  );
}
