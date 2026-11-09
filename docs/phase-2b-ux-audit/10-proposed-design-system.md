# Phase 2B — Product UI/UX Audit & Redesign Planning
## Document 10: Proposed Design System & Visual Direction

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Audit Document:** `DOC-UX-P2B-010`  
**Design System Name:** **"Ceylon Warmth & Coastal Precision" (CWCP Design System)**  
**Target Clients:** React Web (Tailwind CSS) & React Native Mobile (Expo / Tamagui or Nativewind Tokens)  
**Date:** November 9, 2026

---

### 1. Brand Personality & Core Design Philosophy

> [!IMPORTANT]
> **Status Disclaimer:** The "Ceylon Warmth & Coastal Precision" (CWCP) design system presented in this document is a **proposed visual direction and design recommendation** prepared during the Phase 2B audit. It is **not** an approved customer-contracted product requirement baseline. Final adoption of brand tokens, palette nomenclature, amenity badges, and wallet integrations requires explicit Product Owner sign-off (see `16-product-decisions-required.md`).

The Global Luggage Storage Marketplace operates at the intersection of **hospitality, physical security, and travel convenience**. The proposed design system projects two complementary attributes:

1. **Coastal Precision (Trust & Security):** Crisp lines, institutional navy tones, clear data hierarchy, and unambiguous status feedback that give travellers complete confidence their valuables are in safe hands.
2. **Ceylon Warmth (Hospitality & Energy):** Welcoming terracotta accents, sunlit sand surfaces, approachable human typography, and delightful, contextual guidance from "Kiri the Palm Squirrel".

---

### 1.1 Architectural Classification of Design System Elements

To avoid conflating UX research recommendations with mandatory product requirements or premature scope commitments, all elements of this design system are categorized across four strict governance tiers:

| Tier | Category | Scope Elements Included | Governance Authority |
|---|---|---|---|
| **Tier 1** | **Evidence-Backed Requirements** | • Elimination of internal tracking IDs (`PW-001`, `HD-008`, `WF-xxx`) from all end-user UI.<br>• Minimum $44\times 44$px touch targets across mobile and web touch interfaces.<br>• WCAG 2.2 Level AA color contrast compliance ($\ge 4.5:1$ normal text, $\ge 3:1$ large text).<br>• Replacement of card-grid screen switcher prototypes with standard navigation (tab bar, stack navigation).<br>• Fully responsive mobile-first layouts (375px–1440px viewports).<br>• Clear visual hierarchy distinguishing primary CTAs from secondary/destructive actions. | Non-negotiable UX/QA baseline for Phase 2C. |
| **Tier 2** | **Reasonable Design Recommendations** | • "Ceylon Warmth & Coastal Precision" color tokens (`navy-900`, `terracotta-500`, `sand-50`) derived from existing Kiri mascot assets.<br>• Geometric sans-serif typography (`Plus Jakarta Sans` or `Inter`) with monospace accent font (`JetBrains Mono`) for booking references and PINs.<br>• Standardized 4px spatial baseline and 16px container border radius with soft ambient shadows replacing nested hard 1px borders.<br>• Contextual mascot placement guidelines (supportive in empty states/success, silent in checkout/disputes).<br>• High-density operational tables with sticky headers and dot-status badges for Host and Superadmin dashboards. | Recommended default for Phase 2C design token implementation. |
| **Tier 3** | **Product Assumptions Requiring Validation** | • "Verified Hotel Vault" / "Verified Luggage Partner" trust badge iconography and verification criteria.<br>• Specific amenity taxonomy (e.g., CCTV, 24/7 Access, Climate Controlled, Free WiFi).<br>• Apple Wallet and Google Wallet digital pass integration hooks.<br>• Automated mobile display brightness boost upon rendering digital custody QR code.<br>• Emergency 1-tap host dial button on mobile pass.<br>• Counter check-in photo evidence workflow enforcement. | Subject to Product Owner confirmation in `16-product-decisions-required.md`. |
| **Tier 4** | **Out-of-Scope Functionality (Excluded)** | • Native hardware PassKit / Google Pay wallet pass generation backend services.<br>• IoT / Bluetooth / RFID smart luggage tracking integrations.<br>• Thermal barcode printer hardware integration for physical luggage tags.<br>• In-app video/voice calling between traveller and host.<br>• Biometric authentication at partner storage counter. | Strictly excluded from Phase 2C scope. |

---

### 2. Design Tokens: Color, Typography & Spatial Rhythm

#### 2.1 Authoritative Color Palette

```
/* Primary Core — Institutional Trust & Grounding */
--color-navy-950: #070E1A;  /* Deepest canvas and text color */
--color-navy-900: #0A192F;  /* Primary headers, app bars, and high-trust surfaces */
--color-navy-800: #132742;  /* Secondary containers and cards */
--color-navy-600: #1B3675;  /* Signature brand navy (from Kiri's luggage satchel) */

/* Accent Warmth — Ceylon Terracotta & Spices */
--color-terracotta-600: #D05A1E; /* Primary active button hover */
--color-terracotta-500: #E86F2C; /* Primary CTA button & focus accent (from Kiri's fur) */
--color-terracotta-400: #F38C51; /* Highlights, interactive badges */
--color-terracotta-50:  #FFF5EF; /* Subtle active card tint */

/* Surface Neutrals — Sunlit Sand & Clean Canvas */
--color-sand-50:  #FAF8F5;  /* Warm page background (replaces cold gray-50) */
--color-sand-100: #F3EFEA;  /* Light container background */
--color-sand-200: #E5DFD7;  /* Subtle 1px structural dividers */
--color-white:    #FFFFFF;  /* Elevated card and modal background */

/* Semantic Feedback */
--color-emerald-600: #059669; /* Confirmed bookings, live check-ins */
--color-emerald-50:  #ECFDF5;
--color-amber-500:   #D97706; /* 15-minute SLA timers, warnings */
--color-amber-50:    #FFFBEB;
--color-rose-600:    #E11D48; /* Cancellations, overdue bags, disputes */
--color-rose-50:     #FFF1F2;
```

#### 2.2 Typography Scale & Font Architecture
- **Primary Typeface:** `Plus Jakarta Sans` or `Inter` (geometric, highly readable, variable font weights 400, 500, 600, 700, 800).
- **Monospace Typeface:** `JetBrains Mono` or `Roboto Mono` (strictly reserved for booking references `#LS-2026-8841` and verification PINs `482 910`).

| Token | Size | Line Height | Weight | Intended Purpose |
|---|---|---|---|---|
| `display-lg` | 40px (2.5rem) | 48px | 800 (Bold) | Web Landing Hero Headings only |
| `display-sm` | 32px (2.0rem) | 40px | 700 (Bold) | Major Page Titles |
| `heading-lg` | 24px (1.5rem) | 32px | 700 (Bold) | Section Titles, Modal Headers |
| `heading-md` | 20px (1.25rem) | 28px | 600 (Semibold)| Location Card Titles, Card Headers |
| `heading-sm` | 16px (1.0rem) | 24px | 600 (Semibold)| Fieldset Labels, Sub-headers |
| `body-lg` | 16px (1.0rem) | 24px | 400 (Regular) | Primary Body Prose, Descriptions |
| `body-md` | 14px (0.875rem)| 20px | 400 (Regular) | Form Inputs, Table Cells, Metadata |
| `body-sm` | 12px (0.75rem) | 16px | 500 (Medium)  | Badges, Footnotes, Micro-copy |
| `code-mono`| 14px (0.875rem)| 20px | 600 (Semibold)| References, PINs, Seal numbers |

#### 2.3 Spatial Scale & Border Radius Principles
- **Grid Baseline:** Standard 4px spatial baseline (`4px, 8px, 12px, 16px, 20px, 24px, 32px, 48px, 64px`).
- **Elimination of Nested Borders:** Instead of stacking 1px borders, elevate content using:
  - Surface separation (`bg-sand-50` background with `bg-white` cards).
  - Soft, multi-layered ambient shadows: `box-shadow: 0 4px 20px -2px rgba(10, 25, 47, 0.06), 0 2px 6px -1px rgba(10, 25, 47, 0.04)`.
- **Border Radii:**
  - Micro components (tags, badges, chips): `rounded-md` (6px).
  - Buttons and input fields: `rounded-xl` (12px).
  - Cards and container panels: `rounded-2xl` (16px).
  - Modals and mobile bottom sheets: `rounded-3xl` (24px).

---

### 3. Core Component System Specification

#### 3.1 Buttons & Interactive Actions
- **Primary CTA:** Solid Terracotta (`bg-terracotta-500 hover:bg-terracotta-600 text-white font-semibold shadow-sm active:scale-[0.98]`). Used strictly for the single primary task on any screen (`Search`, `Book Now`, `Confirm & Pay`, `Release Bags`).
- **Secondary Action:** Outlined Navy (`border border-navy-900 text-navy-900 hover:bg-navy-900/5 font-semibold`). Used for supporting actions (`View Details`, `Download Receipt`, `Edit Hours`).
- **Tertiary / Ghost:** Borderless text button with hover highlight (`text-navy-700 hover:bg-navy-100/50`). Used for navigation links and cancellations.
- **Destructive:** Rose background or outline (`bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100`). Requires explicit modal confirmation.
- **Touch Target Rule:** Minimum dimensions of $44\times 44$ pixels on all platforms.

#### 3.2 Form Controls & Input Fields
- **Floating Labels:** Smooth transition from centered placeholder to top label on focus.
- **Clear Focus Outlines:** High-contrast 2px Terracotta outline with 2px offset (`focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-2`).
- **Inline Validation:** Instant feedback on blur with green checkmark for valid inputs and clear red icon with descriptive micro-copy for invalid values.
- **Custom Datetime Pickers:** Interactive popover calendar displaying real-time operating hours and closed-time disabling.

#### 3.3 Location & Listing Cards
- **Structure:**
  - Full-width hero photograph of the actual verified partner storefront/vault with aspect ratio $16:9$.
  - Verified Partner Badge: Pill with green shield and text "Verified Hotel Vault".
  - Proximity & Transit: Distance from main station entrance (e.g. "120m from Colombo Fort Railway Station").
  - Amenities Ribbon: Clean Lucide icons (CCTV, 24/7, Climate Controlled, Free WiFi).
  - Rating: Star rating with verified customer review count (e.g. `★ 4.9 (214 reviews)`).
  - Pricing Anchor: Large prominent price callout (e.g. `LKR 250 / day`) with single primary CTA button: `Book Now`.

#### 3.4 Digital Custody Pass & Vouchers (Mobile Pass)
- **High-Contrast Pass Card:** Clean white card styled with subtle perforated ticket cutouts on left and right edges.
- **Cryptographic QR:** Centered QR code ($220\times 220$px) with automated screen brightness boost upon opening.
- **PIN Fallback:** Large, spaced 6-digit monospace PIN (`482 910`) styled in Navy-900 for low-light legibility.
- **Emergency Host Dial:** Direct 1-tap telephone button to call the storage partner desk directly.
- **Wallet Integration Hooks:** "Add to Apple Wallet" and "Save to Google Wallet" CTA buttons.

#### 3.5 High-Density Operational Tables (Host & Admin Dashboards)
- **Dense Data Presentation:** Sticky header row with subtle gray background; alternating row tints (`hover:bg-sand-50/80`).
- **Status Badges:** Compact rounded pills with color-coded dot indicator:
  - `● Active In Storage` (Emerald)
  - `● Pending Approval` (Amber)
  - `● Overdue` (Rose)
  - `● Cancelled & Refunded` (Slate)
- **Direct Row Actions:** Hover-revealed quick actions (`View Audit Trail`, `Release`, `Message`) eliminating nested clicks.

---

### 4. Experience & Ergonomic Principles

1. **Task-First Screen Composition:**
   Every screen must have exactly **one clear primary purpose**. All visual elements must support that single purpose. Secondary options must be de-emphasized.
2. **Progressive Disclosure:**
   Do not overwhelm travellers with legal clauses, escrow explanations, and late-fee policies upfront. Reveal information naturally as the user advances through the booking stages.
3. **Contextual Mascot Guidance:**
   Use "Kiri" as an encouraging conversational assistant:
   - "Ready for your day in Colombo? Leave your heavy bags with us!" on search landing.
   - "All set! Show this pass at the counter" on booking confirmation.
   - Stepping back completely during payment processing, disputes, and incident reviews.
4. **Resilient Offline-First UX:**
   Ensure digital passes, QR codes, PINs, and host contact numbers remain viewable offline once generated.
