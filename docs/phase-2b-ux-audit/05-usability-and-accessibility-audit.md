# Phase 2B — Product UI/UX Audit & Redesign Planning
## Document 05: Usability, Accessibility & Terminology Audit

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Audit Document:** `DOC-UX-P2B-005`  
**Reference Standards:** WCAG 2.2 Level AA, Apple Human Interface Guidelines, Android Material 3  
**Date:** November 9, 2026

---

### 1. Usability & User Interaction Audit

#### 1.1 Task-Oriented Navigation vs. Developer Switcher Pattern
The most severe usability failure across the applications is that **user journeys do not function as natural sequential tasks**:
- **Mobile Navigation Paralysis:** On both mobile surfaces (`apps/mobile`), a user cannot simply search for a location and transition seamlessly into booking. The user is presented with a developer "hub" where they must select screen cards (`TM-011`, `TM-012`, `TM-017`) from a bottom grid. This completely breaks mental models and renders the mobile application unusable for end-consumers.
- **Web Navigation Clutter:** The global navigation bar presents 10 competing options without clear grouping. Diagnostic utilities (`Health`), developer count pills (`Traveller Web (11)`), and role switchers (`Host Hub (14)`, `Admin Hub (18)`) sit adjacent to core consumer links (`Find Storage`, `How It Works`), confusing first-time visitors.

#### 1.2 Form Usability & Input Validation
- **Lack of Inline Formatting:** Pricing and currency fields accept arbitrary text strings without dynamic `LKR` masking or number sanitization.
- **Inadequate Form Feedback:** In forms like `PW-009` (Contact Us), `HD-003` (Location Profile), and `TM-040` (Support Ticket), submitting a form does not produce persistent feedback or clear redirect confirmation; it triggers an ephemeral toast that disappears in 3 seconds.
- **Lack of Multi-Step State Preservation:** If a user navigates between `PW-004` (Checkout) and `PW-002` (Search), previously selected dates, hours, and bag counts are completely wiped from state because state is held in ephemeral React component memory rather than an active checkout store.

#### 1.3 Destructive Action Safeguards
- In `AD-003` (Host Directory), the "Suspend Host" button triggers an immediate state mutation without a modal confirmation dialog requiring the administrator to enter a mandatory suspension reason.
- In `TM-031` (Cancellation Flow), selecting a cancellation reason immediately marks the booking cancelled without a double-confirmation review displaying the exact penalty or non-refundable commission deduction.

---

### 2. User-Facing Terminology & Implementation Leakage Audit

A comprehensive codebase audit reveals that internal engineering codes, database invariant keys, and sprint tracking labels have leaked into normal user interfaces.

#### 2.1 Leaked Terminology Inventory

| Leakage Category | Offending User-Facing String | Where Observed in UI | Recommended Consumer-Facing Replacement |
|---|---|---|---|
| **Screen Tracking IDs** | `PW-001`, `PW-002`, `TM-011`, `HD-001`, `AD-001` | ScreenHeaderBadge on all 113 screens; hero cards; sidebar navigation | **Remove completely** from user interfaces. |
| **Screen ID in Button Labels** | `Find Storage (PW-002)` | Web Global Navigation Bar | `Find Storage` |
| **Screen ID in Action Buttons** | `Details (PW-003)`, `Book Now (PW-004)` | Location listing cards on `PW-002` & `TM-012` | `View Details`, `Book Storage` |
| **Screen ID in Checkout CTAs** | `Proceed to Payment & Custody Token (PW-005)` | Checkout summary on `PW-004` & `TM-019` | `Proceed to Payment` |
| **Screen ID in Modal Triggers** | `Investigate (HD-008)` | Every table row on `HD-007` Bookings Hub | `View Details` or `Audit Trail` |
| **Workflow Tracking Codes** | `WF-007`, `WF-008`, `WF-017`, `WF-018`, `WF-044` | Header metadata chips on every web and mobile screen | **Remove completely** from consumer/partner views. |
| **Engineering Phase Labels** | `Demo Simulation (Phase 4 Payment & Booking Engine)` | Notice banners on `PW-004`, `PW-005`, `HD-001` | **Remove from production.** If demo mode is active, show subtle badge. |
| **Architecture Decision Codes**| `OQ-014`, `OQ-015`, `BR-035` | Titles, subtitles, and alert boxes on `PW-004`, `PW-005`, `HD-006`, `AD-013` | Natural text: "Late collection policy", "Guaranteed bag release". |
| **Database & Engine Terms** | `Atomic Capacity Lock`, `Custody Token Generation` | Subtitles and section headers on `PW-004`, `PW-005` | "Reserve your spot", "Confirm your booking". |
| **Developer Sitemap Footers** | `PUBLIC WEBSITE (PW-001..011)`, `HOST DASHBOARD (HD-001..014)` | Public website footer across all web pages | Standard sitemap: "Cities", "Company", "Support", "Legal". |
| **Debug State Switchers** | `State: GATEWAY`, `State: POLLING`, `State: CONFIRMED` | Top right of `PW-005` Payment Confirmation | **Remove completely** from user view (confine to dev drawer). |

---

### 3. Accessibility Evaluation (WCAG 2.2 Level AA)

#### 3.1 Color Contrast Deficits
- **Low-Contrast Secondary Text:**
  - `text-slate-400` on white: contrast ratio $2.8:1$ (Fails WCAG AA minimum of $4.5:1$ for normal text).
  - Amber metadata pills (`text-amber-800` on `bg-amber-100`): contrast ratio $3.7:1$ (Fails WCAG AA).
- **Interactive Button Contrast:**
  - Secondary buttons with light gray backgrounds (`bg-slate-100` with `text-slate-500`) fail contrast thresholds in bright sunlight conditions, a critical flaw for travellers using mobile web outdoors.

#### 3.2 Keyboard Navigation & Focus Indicators (Web)
- **Missing Visible Focus Rings:** Many interactive buttons and card selectors lack explicit `:focus-visible` styling, relying on default browser outlines that disappear against dark card backgrounds.
- **Keyboard Traps:** The date and time selectors in `PW-004` trap tab focus, requiring users to press Escape or click away with a mouse to continue tabbing through the form.
- **Skip Links:** The web application lacks a "Skip to Main Content" link, forcing screen reader and keyboard users to tab through 10 global navbar items on every single page navigation.

#### 3.3 Screen Reader Attributes & Semantic Structure
- **Missing Landmark Roles:** Pages rely heavily on generic `<div>` tags instead of semantic HTML5 landmarks (`<main>`, `<nav>`, `<aside>`, `<header>`, `<footer>`).
- **Mascot Accessibility:**
  - Web `MascotIllustration` provides descriptive `alt` text.
  - However, in mobile `MascotIllustration.tsx`, the mascot images lack `accessibilityRole="image"` and meaningful `accessibilityLabel` attributes, causing screen readers to announce them as unlabelled graphic elements.
- **Form Label Association:** Multiple form fields in `PublicMarketplacePages.tsx` lack explicit `id` attributes linked to corresponding `<label htmlFor="...">` elements.

#### 3.4 Mobile Touch Targets
- **Undersized Interactive Elements:** In mobile index switchers (`TM-004`, `HM-013`), category pill buttons have tap targets of $28\times 28$ pixels with tight 4px margins, falling far short of the minimum $44\times 44$ pixel standard mandated by Apple Human Interface Guidelines and WCAG 2.2 Target Size (Minimum) Criterion 2.5.8.

---

### 4. Trust & Marketplace Readiness Assessment

A luggage storage marketplace requires an exceptionally high level of perceived trust: travellers are handing their personal belongings, passports, and valuables to third-party business operators in unfamiliar cities.

| Trust Dimension | Current State in Application | Impact on User Perception & Conversion |
|---|---|---|
| **Storage Security & Custody** | Technical explanations of "Cryptographic QR" and "OQ-014 PIN fallbacks". No actual photos of secure storage rooms, vaults, or lockers. | Travellers feel confused by technical terms rather than reassured about physical luggage safety. |
| **Host Credibility** | Shows generic names (e.g. "Ceylon Transit Hospitality") without verified partner badges, physical storefront photos, or Google Maps integrations. | High anxiety for tourists; fear of fraudulent or nonexistent locations. |
| **Pricing & Hidden Fees** | Warning banners warn about "late fee policies" and "escrow calculations" before booking is completed. | Users suspect hidden fees or punitive charges; creates hesitation at checkout. |
| **Payment Security** | Displays simulated PayHere gateway buttons with debug state toggles (`State: GATEWAY`). | Destroys payment credibility; users assume the site is an unverified staging test. |
| **Customer Protection & Guarantee**| Legal text mentions Luggage Guarantee on `PW-010`, but no trust badges or coverage caps (e.g. "$1,000 Bag Protection Guarantee") appear in checkout. | Travellers lack confidence that lost or damaged items will be reimbursed. |
