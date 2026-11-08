# Mascot Asset Catalogue & Visual Integration Specification

**Project:** Global Luggage Storage Marketplace  
**Document ID:** `DOC-UX-004`  
**Phase:** Phase 2 — Complete Product UI/UX Implementation  
**Version:** `1.0.0`  
**Status:** `APPROVED — ACTIVE`

---

## 1. Overview & Brand Character

The marketplace brand mascot ("**Kiri**", the Sri Lankan Palm Squirrel / *Funambulus palmarum*) embodies warm Sri Lankan hospitality, alertness, and trustworthy luggage care. Wearing a signature navy-blue `"LS"` crossbody luggage tag satchel, Kiri guides travellers and storage hosts through onboarding, discovery, custody handovers, empty states, and recovery flows.

### 1.1 Brand Color Harmony Derived from Mascot Artwork
- **Terracotta Fur / Warm Primary (`#E86F2C` / `brand-orange`)**: Energetic callouts, highlights, warm badges.
- **Deep Maroon Outline (`#5C0620`)**: High-contrast illustration accents and premium heritage badges.
- **Luggage Tag Navy (`#1B3675` / `brand-600: #2563eb`)**: Primary interactive controls, trust badges, custody verification headers.
- **Warm Cream / Sand (`#FFFBF5` / `#F8FAFC`)**: Clean, sunlit background surfaces that preserve PNG transparency and crisp outlines.

---

## 2. Asset Storage Locations & Bundling Rules

All 20 original PNG assets are preserved unaltered in three canonical locations:

1. **Authoritative Source Directory:** `Assets/LS-mascot_01_wave.png` .. `Assets/LS-mascot_20_sitting-suitcase.png` (Root directory — preserved untouched).
2. **Web Application Public Assets:** `apps/web/public/assets/mascots/LS-mascot_XX_*.png` (Served statically at `/assets/mascots/LS-mascot_XX_*.png`).
3. **Mobile Application Bundled Assets:** `apps/mobile/assets/mascots/LS-mascot_XX_*.png` (Loaded via static `require()` mapping in `apps/mobile/src/lib/mascots.ts` for deterministic Metro bundling).

---

## 3. Complete 20-Mascot Asset Registry & Screen Mapping

| ID | Filename | Pose / Expression | Primary Emotional Tone | Assigned Product Contexts & Screen IDs |
|:---|:---|:---|:---|:---|
| `MASCOT-01` | `LS-mascot_01_wave.png` | Waving warmly with a welcoming smile | Welcoming, friendly, approachable | `TM-001` Splash, `TM-002` Onboarding Welcome, `PW-001` Public Landing Page, `HM-001` Host Welcome |
| `MASCOT-02` | `LS-mascot_02_suitcase-walk.png` | Walking briskly pulling a rolling suitcase | Active travel, momentum, convenience | `PW-007` How It Works, `TM-011` Home & Destination Search, `PW-011` Traveller Web Portal |
| `MASCOT-03` | `LS-mascot_03_suitcase-peek.png` | Peeking curiously from behind a suitcase | Curious, discreet, empty state prompt | `TM-035` Booking History (Empty tab state), `TM-036` Saved Favourites (Empty state), `HD-007` Empty filter view |
| `MASCOT-04` | `LS-mascot_04_blank-tag.png` | Holding up a luggage tag | Pricing transparency, tagging, promotions | `TM-018` Bag Selection & Category Counter, `HM-014` Pricing Rules Editor, `HD-006` Pricing Rules, `AD-015` Promotions |
| `MASCOT-05` | `LS-mascot_05_pointing.png` | Pointing upward/sideways with helpful grin | Helpful guidance, tips, permissions | `TM-003` Permissions Request, `TM-004` Language & Currency Selector, `HM-009` Location Profile tips |
| `MASCOT-06` | `LS-mascot_06_thinking.png` | Hand on chin thinking thoughtfully | Analytical, FAQ inquiry, filter adjustment | `PW-008` Help Centre & FAQs, `TM-014` Filter Modal, `TM-039` Help & Support Centre, `AD-011` Ticket Triage |
| `MASCOT-07` | `LS-mascot_07_sleeping.png` | Sleeping peacefully curled up | All clear, quiet inbox, overnight rest | `TM-037` Notification Centre (All caught up state), `HM-010` Operating Hours closed state, `HD-004` Closed exception |
| `MASCOT-08` | `LS-mascot_08_phone.png` | Holding smartphone attentively | Digital verification, OTP, live contact | `TM-008` Email / Phone OTP Verification, `PW-009` Contact Us, `TM-028` Check-in Pass, `HM-021` Scanner & PIN |
| `MASCOT-09` | `LS-mascot_09_jump.png` | Jumping in mid-air celebrating | Joyful confirmation, milestone achieved | `TM-024` Booking Confirmation, `PW-005` Web Payment & Confirmation, `HM-025` Handover Release Confirmation |
| `MASCOT-10` | `LS-mascot_10_map.png` | Studying an unfolded travel map | Geospatial discovery, route finding | `TM-012` Geospatial Map Discovery, `PW-002` Web Search & Discovery, `TM-015` Location Directions |
| `MASCOT-11` | `LS-mascot_11_sun-hat.png` | Wearing a tropical straw sun hat | Island holiday, destination exploration | `TM-013` Discovery List & Sri Lanka Hubs, `HM-011` Schedule Exception Calendar (Holiday hours) |
| `MASCOT-12` | `LS-mascot_12_high-five.png` | Giving an enthusiastic high-five | Partnership, mutual trust, review thanks | `PW-006` Become a Host Landing, `TM-034` Submit Review & Rating, `HM-035` Host Customer Reviews, `HD-012` Reviews |
| `MASCOT-13` | `LS-mascot_13_alarm-clock.png` | Holding a ringing twin-bell alarm clock | Time-sensitive SLA, countdown, overdue alert | `HM-018` Booking Requests Queue (15m SLA), `HM-026` Overdue Bags Alert View, `TM-030` Check-out Countdown |
| `MASCOT-14` | `LS-mascot_14_key.png` | Holding a golden security key | Authentication, security, RBAC protection | `TM-005` Login, `TM-007` Forgot Password, `TM-043` Security Update, `HM-002` Host Auth, `AD-018` Admin RBAC |
| `MASCOT-15` | `LS-mascot_15_suitcase-hug.png` | Hugging a suitcase protectively | Safe custody, insurance guarantee, care | `TM-027` Active Booking Details, `TM-029` In-Storage Live Status, `PW-003` Location Trust Guarantee |
| `MASCOT-16` | `LS-mascot_16_selfie.png` | Holding camera taking a photo | Photo evidence, KYC document capture | `HM-004` KYC Document Upload, `HM-022` Bag Inspection, `HM-023` Check-in Evidence Camera, `TM-042` Profile |
| `MASCOT-17` | `LS-mascot_17_king-coconut.png` | Sipping a fresh Sri Lankan King Coconut | Hands-free relaxation, island leisure | `PW-001` Hero Companion, `TM-029` Relax While Stored Banner, `HM-029` Host Earnings Milestone |
| `MASCOT-18` | `LS-mascot_18_salute.png` | Giving a crisp, dutiful salute | Operational readiness, compliance, duty | `HM-006` Host Operations Dashboard, `HD-001` Host Overview, `AD-001` Platform Command Dashboard, `AD-002` KYC Review |
| `MASCOT-19` | `LS-mascot_19_shrug.png` | Shrugging empathetically with open paws | Apologetic error state, 404, cancellation | `TM-023` Payment Failed, `TM-031` Cancellation Flow, `HM-028` Disputed Release, `NotFoundPage` (404) |
| `MASCOT-20` | `LS-mascot_20_sitting-suitcase.png` | Sitting patiently on top of a suitcase | Waiting for approval, polling, queue standby | `TM-021` Payment Status Polling, `TM-022` Host Approval Pending, `HM-005` Host Application Status, `TM-033` Refund Tracking |

---

## 4. UI/UX Placement Guardrails

1. **Preserve Aspect Ratio & Transparency**: Always render mascot PNGs with `object-contain` (Web) or `resizeMode="contain"` (React Native) inside a subtle warm or neutral container badge. Never stretch or crop the character's ears or tail.
2. **No Data Obstruction**: On high-density operational tables (`AD-005`, `AD-006`, `AD-010`, `HD-010`), mascots appear only as compact header/banner companions or in zero-result filter states—never obscuring financial rows or security audit logs.
3. **Accessibility**: Every mascot image includes descriptive `alt` text on Web and `accessibilityLabel` on React Native (`role="img"`).

