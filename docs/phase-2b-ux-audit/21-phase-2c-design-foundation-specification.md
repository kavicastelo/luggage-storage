# Phase 2C.0 — Design Foundation Specification
## Document 21: Design System & Foundation Specification

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Document ID:** `DOC-UX-P2C-021`  
**Phase:** Phase 2C.0 — Baseline Reconciliation  
**Design System Name:** **Ceylon Warmth & Coastal Precision (CWCP Design System)**  
**Target Environments:** React Web (Tailwind CSS) & React Native Mobile (Expo / Nativewind)  
**Date:** November 9, 2026  
**Auditor / Architect:** Principal UX Engineer & Design Systems Architect  

---

### 1. Architectural Status & Governance

This document establishes the **authoritative shared design system specification** for Phase 2C. In strict compliance with project governance rules, all specifications are categorized into:
- **`CONFIRMED_DECISION`**: Approved ergonomic, accessibility, and visual requirements:
  - **`DEC-008` (Mascot Asset Protection & Bounded Roles):** Adopted for Sprint 1 / WS-1. Original 20 PNGs are immutable. WebP derivatives are generated via script in a dedicated directory. Mascot is restricted to friendly guidance and empty states; excluded from payment, security, dispute, and admin surfaces.
  - **`DEC-009` (Accessible Terracotta Re-tune):** Adopted for Sprint 1 / WS-1. Primary Terracotta token tuned to `#C85316` ensuring 4.62:1 contrast against white text `#FFFFFF` (WCAG 2.2 AA compliant).
  - **Developer Diagnostics Boundary:** Development-only guard (`import.meta.env.DEV` on Web, `__DEV__` on Mobile) ensures complete exclusion of developer drawers, switchers, and internal IDs (`PW-xxx`, `HD-xxx`, `WF-xxx`) from production bundles and customer-facing DOM.
  - Touch targets $\ge 44\times 44$px, WCAG 2.2 AA compliance across all components.
- **`PROVISIONAL_RECOMMENDATION`**: Extended multi-currency token definitions and advanced motion curves subject to ongoing iteration.

> [!IMPORTANT]
> **WS-1 Foundation Authorization:** Implementation of the foundation tokens, primitives, WebP derivative pipeline, and developer boundary is authorized under `WS-1-FOUNDATION`. Individual marketplace screen redesigns remain scheduled for subsequent workstreams (WS-2 through WS-6).

---

### 2. The Eighteen Design Foundation Specifications

---

#### 2.1 Color Tokens & Semantic Roles
The CWCP palette balances institutional trust (Coastal Navy) with welcoming warmth (Ceylon Terracotta) and a clean, sand-tinted canvas:

```css
/* Core Primary — Institutional Security & Grounding */
--color-navy-950: #070E1A;  /* Deepest canvas & primary high-contrast text */
--color-navy-900: #0A192F;  /* Primary headers, navigation bars, elevated containers */
--color-navy-800: #132742;  /* Secondary containers, interactive hover states */
--color-navy-600: #1B3675;  /* Accent navy, icons, secondary badges */

/* Brand Accent — Ceylon Spices (Accessible Re-tune per DEC-009) */
--color-terracotta-700: #9E3708; /* Active / pressed button states */
--color-terracotta-600: #B8460A; /* Primary CTA button hover state */
--color-terracotta-500: #C85316; /* Primary CTA background (Contrast 4.62:1 with #FFFFFF) */
--color-terracotta-400: #E86F2C; /* Graphic accents, focus rings, and non-text borders */
--color-terracotta-100: #FEE8D8; /* Soft terracotta badge background */
--color-terracotta-50:  #FFF5EF; /* Subtle active card / container background tint */

/* Surface Neutrals — Sunlit Sand & Clean Canvas */
--color-sand-50:  #FAF8F5;  /* Warm page background canvas (replaces cold slate-50) */
--color-sand-100: #F3EFEA;  /* Light container background, inactive tab strips */
--color-sand-200: #E5DFD7;  /* Structural 1px dividers and borders */
--color-sand-300: #D1C7BB;  /* Disabled control borders */
--color-white:    #FFFFFF;  /* Elevated cards, modals, sheets, and popovers */

/* Semantic Status Tokens */
--color-emerald-600: #059669; /* Confirmed bookings, active custody, verified badges */
--color-emerald-50:  #ECFDF5;
--color-amber-500:   #D97706; /* 30-minute SLA warnings, capacity warnings */
--color-amber-50:    #FFFBEB;
--color-rose-600:    #E11D48; /* Overdue bags, cancellations, errors */
--color-rose-50:     #FFF1F2;
```

---

#### 2.2 Typography & Type Scale
- **Primary Font Family:** `Plus Jakarta Sans` or `Inter` (sans-serif, variable font weights: 400, 500, 600, 700, 800).
- **Monospace Font Family:** `JetBrains Mono` or `Roboto Mono` strictly reserved for booking references (`#LS-2026-8841`), custody PINs (`482 910`), and security seal serial numbers (`#SL-88410`).

| Token Name | Font Size | Line Height | Weight | Intended Purpose |
|---|---|---|---|---|
| `font-display-lg` | 40px (2.5rem) | 48px | 800 | Public Web Landing Hero Heading |
| `font-display-sm` | 32px (2.0rem) | 40px | 700 | Primary Page Titles |
| `font-heading-lg` | 24px (1.5rem) | 32px | 700 | Major Section Titles, Modal Headers |
| `font-heading-md` | 20px (1.25rem)| 28px | 600 | Location Card Titles, Panel Headers |
| `font-heading-sm` | 16px (1.0rem) | 24px | 600 | Sub-headers, Fieldset Labels |
| `font-body-lg` | 16px (1.0rem) | 24px | 400 | Primary Prose, Descriptions |
| `font-body-md` | 14px (0.875rem)| 20px | 400 | Form Inputs, Table Cells, Metadata |
| `font-body-sm` | 12px (0.75rem) | 16px | 500 | Badges, Micro-copy, Timestamps |
| `font-code-mono`| 14px (0.875rem)| 20px | 600 | Monospace References & PINs |

---

#### 2.3 Spacing Scale & Spatial Rhythm
Standard 4px spatial baseline grid:
- `space-1`: 4px | `space-2`: 8px | `space-3`: 12px | `space-4`: 16px
- `space-5`: 20px | `space-6`: 24px | `space-8`: 32px | `space-10`: 40px
- `space-12`: 48px | `space-16`: 64px

---

#### 2.4 Border Radii
- `radius-sm`: 4px (Tags, micro-chips, tooltip bubbles).
- `radius-md`: 8px (Form inputs, table cells, secondary buttons).
- `radius-lg`: 12px (Primary CTA buttons, dropdown menus).
- `radius-xl`: 16px (Standard cards, panels, search widgets).
- `radius-2xl`: 24px (Modals, bottom sheets, mobile drawers).
- `radius-full`: 9999px (Status pills, avatar circles, icon buttons).

---

#### 2.5 Shadows & Elevation
Eliminate nested 1px hard borders by elevating content using ambient light shadows:
- `shadow-sm`: `0 1px 2px 0 rgba(10, 25, 47, 0.05)` (Form inputs, button hovers).
- `shadow-md`: `0 4px 6px -1px rgba(10, 25, 47, 0.07), 0 2px 4px -2px rgba(10, 25, 47, 0.04)` (Listing cards).
- `shadow-lg`: `0 10px 15px -3px rgba(10, 25, 47, 0.08), 0 4px 6px -4px rgba(10, 25, 47, 0.03)` (Elevated search bar).
- `shadow-modal`: `0 20px 25px -5px rgba(10, 25, 47, 0.12), 0 8px 10px -6px rgba(10, 25, 47, 0.06)` (Modals, drawers).

---

#### 2.6 Iconography Rules
- Use **Lucide Icons** (`lucide-react` on web, `lucide-react-native` on mobile) exclusively.
- Consistent 2px stroke width (`strokeWidth={2}`).
- Fixed bounding box sizes: 16px (micro/badge), 20px (form/button), 24px (navigation bar), 32px (feature highlight).

---

#### 2.7 Buttons & Interactive States
- **Primary CTA:** Accessible Terracotta (`bg-terracotta-500 hover:bg-terracotta-600 text-white font-semibold rounded-lg shadow-sm active:scale-[0.98]`). Minimum bounding touch target: $44\times 44$px.
- **Secondary Action:** Outlined Navy (`border border-navy-900 text-navy-900 hover:bg-navy-900/5 font-semibold rounded-lg`).
- **Ghost / Tertiary:** Borderless button with hover tint (`text-navy-800 hover:bg-sand-100 font-medium rounded-md`).
- **Destructive:** Rose button (`bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-medium`).
- **Focus Ring:** High-contrast 2px Terracotta outline (`focus-visible:ring-2 focus-visible:ring-terracotta-400 focus-visible:ring-offset-2`).

---

#### 2.8 Form Controls & Field Validation
- Inputs styled with `bg-white`, `border border-sand-200`, `rounded-lg`, `text-navy-950`.
- Real-time inline validation on blur: green checkmark for valid entries; red border and descriptive error text for invalid fields.
- Mandatory fields clearly marked; optional fields explicitly tagged `(Optional)`.

---

#### 2.9 Navigation Patterns
- **Web Consumer:** Sticky top navigation header with clean logo, destination search bar, currency selector, and auth profile avatar. Internal `/health` link strictly removed.
- **Web Operational (Host & Admin):** Collapsible persistent dark navy sidebar (`bg-navy-900`) with white/sand icon links. Zero developer screen IDs (`HD-001`, `AD-001`) in navigation text.
- **Mobile (Traveller & Host):** Standard Expo Router 5-tab bottom bar (`Explore`, `My Storage`, `Saved`, `Help`, `Profile` for Traveller; `Live Desk`, `Requests`, `Vault`, `Earnings`, `Settings` for Host) with native stack navigation.

---

#### 2.10 Operational Tables & Data Components (Host & Admin)
- Eliminate card grids for dense tabular data.
- Sticky table headers with subtle background tint (`bg-sand-100`); alternating row hover highlights (`hover:bg-sand-50`).
- Status pills with color-coded dot indicator: `● Active In Storage` (Emerald), `● Pending Review` (Amber), `● Overdue` (Rose).
- Action buttons placed in a fixed right-hand column with descriptive verbs (`View Details`, `Release Bags`).

---

#### 2.11 Anti-"Card-Soup" Rules: Information Containers Defined
To prevent visual monotony from wrapping every screen element in identical rounded cards:
- **Card Containers:** Use strictly for discrete clickable items in a grid (e.g. Location Search Results, Verified Partner Highlights).
- **Data Tables:** Use for dense operational records exceeding 5 items (Bookings Ledger, Payouts, Audit Events).
- **Slide-Over Drawers:** Use for deep inspection of an item without losing list context (KYC Document Review, Booking Details).
- **Page Sections:** Use flat alternating background bands (`bg-sand-50` vs `bg-white`) with clean typography for landing pages and FAQ guides.
- **Bottom Sheets:** Use for mobile map exploration overlays and quick action sheets.

---

#### 2.12 Modals & Drawers
- Backdrop: Soft dark overlay (`bg-navy-950/40 backdrop-blur-sm`).
- Modal positioning: Centered on desktop, full-width bottom sheet on mobile.
- Keyboard: Escape key dismisses modal; initial focus trapped within dialog.

---

#### 2.13 Alerts & Notification Banners
- **Success:** Emerald background tint (`bg-emerald-50 border-emerald-200 text-emerald-800`).
- **Warning / Timer:** Amber background tint (`bg-amber-50 border-amber-200 text-amber-800`).
- **Critical / Overdue:** Rose background tint (`bg-rose-50 border-rose-200 text-rose-800`).
- **Informational:** Navy tint (`bg-navy-50 border-navy-200 text-navy-800`).

---

#### 2.14 State Feedback: Empty, Loading, Error & Success
- **Empty States:** Clean layout with supportive illustration, friendly title, and single primary recovery CTA button.
- **Loading States:** Shimmer skeleton placeholders matching layout shape (never generic centered spinning wheel).
- **Error States:** Descriptive plain-language explanation with retry button and support hotline.
- **Success States:** Celebratory milestone with confirmation reference and receipt download action.

---

#### 2.15 Responsive Breakpoints
- `sm`: $640\text{px}$ (Large mobile phones in landscape).
- `md`: $768\text{px}$ (Tablets in portrait).
- `lg`: $1024\text{px}$ (Laptops / tablets in landscape).
- `xl`: $1280\text{px}$ (Desktop monitors).
- `2xl`: $1536\text{px}$ (Wide desktop monitors).

---

#### 2.16 Accessibility Requirements (WCAG 2.2 Level AA)
- Minimum contrast ratio of $4.5:1$ for all body copy and button text against backgrounds.
- Minimum contrast ratio of $3.0:1$ for large text ($\ge 18\text{pt}$) and graphical UI components.
- Minimum touch target dimension of $44\times 44$ CSS pixels on all touch surfaces.
- Complete keyboard navigation with visible focus indicators.
- Semantic HTML tags (`<nav>`, `<main>`, `<header>`, `<footer>`, `<aside>`, `<button>`).

---

#### 2.17 Web vs. Mobile Component Mapping

| Component Concept | React Web Implementation (`apps/web`) | React Native Mobile (`apps/mobile`) |
|---|---|---|
| **Buttons** | `<Button variant="primary">` (Tailwind) | `<Button variant="primary">` (Nativewind / Pressable) |
| **Icons** | `lucide-react` | `lucide-react-native` |
| **Interactive Map** | `maplibre-gl` + OpenStreetMap tiles | `@maplibre/maplibre-react-native` |
| **Drawer / Sheet** | Headless UI Dialog / Slide-Over Drawer | `@gorhom/bottom-sheet` / Modal Sheet |
| **QR Code** | `qrcode.react` (SVG) | `react-native-qrcode-svg` |
| **Camera Scanner** | Manual PIN / numeric keypad | `expo-camera` Barcode Scanner |
| **Haptics** | N/A | `expo-haptics` |

---

#### 2.18 Mascot Brand Voice Boundaries (Kiri the Palm Squirrel)
- **Approved Contexts:** Public landing welcome, how it works explainer, onboarding guidance, booking confirmed celebration, empty state encouragement.
- **Strictly Prohibited Contexts:** Customer dispute resolution (`AD-013`), baggage damage claims, payment failure dialogs, security settings, password resets, and superadmin governance consoles.
- **Asset Integrity:** Original 20 PNG files in `Assets/` and `apps/web/public/assets/mascot/` must remain untouched. Derivative WebP assets served via responsive `<picture>` tags.