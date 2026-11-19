# 02 — Brand Identity & Unified Design System (`WS-UX-02`)

**Canonical Source of Truth:** `packages/contracts/src/tokens.ts` — **Ceylon Warmth & Coastal Precision (CWCP)**  
**Applies To:** `apps/web` (React + Tailwind CSS) and `apps/mobile` (Expo + React Native StyleSheet)

---

## 1. Brand Identity & Product Personality

- **Unified Brand Name:** **LuggageStorage** (replacing inconsistent `"BagBox Sri Lanka"` strings in Mobile while preserving `"LuggageStorage"` across Web & Mobile).
- **Voice & Tone:** Confident, warm, transparent, Sri Lankan coastal hospitality meets cryptographic custody precision.
  - **Traveller Surfaces:** Approachable, reassuring, discovery-led, plain-language security ("Encrypted QR pass + 6-digit backup PIN", never raw internal jargon like "non-escrow clearing").
  - **Host Workspace:** High-contrast, action-first hospitality operations; time-sensitive counter workflows prioritize speed and zero ambiguity.
  - **Superadmin & Support:** Crisp governance precision, structured hierarchy, real visual evidence (thumbnails/drawers), zero decorative clutter.

---

## 2. Design Tokens (Unified Across Web & Mobile)

### 2.1 Color System (`cwcpPalette`)
| Role | Token | Hex | Contrast / Usage Rule |
|---|---|---|---|
| **Primary Brand / CTA** | `terracotta[500]` / `600` / `700` | `#C55013` / `#B8460A` / `#9E3708` | Primary buttons, active highlights (`#C55013` on `#FFFFFF` = 4.63:1 WCAG AA) |
| **Warm Tint / Focus** | `terracotta[50]` / `100` / `400` | `#FFF5EF` / `#FEE8D8` / `#E86F2C` | Active selections, focus rings (`>=3.0:1` UI graphics) |
| **Grounding / Authority** | `navy[900]` / `950` / `800` | `#0A192F` / `#070E1A` / `#132742` | Primary headings, hero banners, dark mobile tab bars, secondary CTAs |
| **Canvas & Surfaces** | `sand[50]` / `100` / `200` / `white` | `#FAF8F5` / `#F3EFEA` / `#E5DFD7` / `#FFFFFF` | Page canvas (`sand[50]`), subtle containers (`sand[100]`), 1px structural borders (`sand[200]`), cards (`#FFFFFF`) |
| **Secondary Text** | `sand[700]` / `800` | `#6B635A` / `#4B453E` | Helper/metadata text (`sand[700]` on `#FFFFFF` >= 5.5:1 AA); avoid `sand[500]` (`#ABA296`) for readable text |
| **Semantic Status** | `emerald[600/50]`, `amber[600/50]`, `rose[600/50]`, `sky[600/50]` | Verified/In-Storage, Warning/Pending, Danger/Overdue, Info | Always pair color with clear text label & icon |

**Prohibition:** Legacy `slate-*` and `#2563eb` / `blue-600` classes are retired across all Auth, Account, Error, and UI primitives.

### 2.2 Typography Scale
- **Web Fonts (`apps/web/index.html`):** Load `Plus Jakarta Sans` (400, 500, 600, 700, 800) and `JetBrains Mono` (500, 600, 700).
- **Mobile Typography (`apps/mobile/src/lib/theme.ts`):** Align weights/hierarchy, enforce `fontVariant: ["tabular-nums"]` and monospace family (`codeMono`) on Booking References (`#LS-...`), 6-digit PINs, and LKR currency totals.
- **Scale:** `displayLg` (40px Web / 32px Mobile), `displaySm` (32px / 26px), `headingLg` (24px / 22px), `headingMd` (20px / 18px), `headingSm` (16px), `bodyLg` (16px), `bodyMd` (14px), `bodySm` (12px).

### 2.3 Spacing, Radii, Elevation & Touch Targets
- **4px Spatial Baseline:** `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
- **Shape:** `sm` (6px badges), `md` (8px inputs/buttons), `lg` (12px panels/buttons), `xl` (16px cards/modals), `2xl` (24px hero sections), `full` (pills).
- **Surface Variety Rule:** Avoid wrapping every section in identical bordered cards. Mix:
  - Full-bleed dark Navy hero anchors (`navy-900/950`)
  - Warm Sand editorial bands (`sand-100`)
  - Clean white elevated surfaces (`white` + `sand-200` border)
  - Perforated digital pass ticket styling (`CustodyQrPassCard`)
  - Tabular operational lists with slide-over detail drawers
- **Touch Targets:** Minimum `44px × 44px` on Web interactive controls and `48px` on Mobile primary controls.

---

## 3. Shared Component Architecture

### 3.1 Web Primitives (`apps/web/src/components/ui/`)
- Existing (retained & polished): `Button`, `Input`, `Badge`, `Alert`, `Card`, `LoadingSkeleton`, `MascotIllustration`.
- New Shared Primitives (eliminating raw ad-hoc `<div>` dialogs/drawers/forms):
  1. `Modal.tsx`: Accessible `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `Escape` close, backdrop click close, `max-h-[90vh] overflow-y-auto`, 44px close button.
  2. `SlideOverDrawer.tsx`: Accessible right-side drawer (`max-w-xl`/`max-w-2xl`) for Admin/Support inspection & action workflows without scrolling below tables.
  3. `EmptyState.tsx`: Consistent empty-state layout pairing `MascotIllustration` (`variant="bare"`), clear explanation, and actionable CTA.
  4. `Select.tsx` & `Textarea.tsx`: Unified CWCP border, focus ring, `htmlFor`, and `role="alert"` error support matching `Input.tsx`.
  5. `PageHeader.tsx`: Clean editorial header for workspaces (title, subtitle, optional breadcrumb, right action slot—never exposes internal tracking codes).

### 3.2 Mobile Primitives (`apps/mobile/src/components/ui/`)
- `ScreenContainer.tsx`: Android `behavior="height"`, `keyboardDismissMode="on-drag"`, safe-area awareness.
- `BottomSheet.tsx`: Backdrop `Pressable` dismiss, internal `KeyboardAvoidingView`, drag-handle affordance.
- `ConfirmDialog.tsx`: Internal `KeyboardAvoidingView` + `ScrollView` so embedded inputs never occlude action buttons.
- `DateTimeSelector.tsx`: iOS `BottomSheet` modal wrapper with explicit `Confirm` action (fixes premature close on wheel scroll).
- `TextInput.tsx`: `React.forwardRef` support for `next`/`done` keyboard focus chaining; accessible `sand[600]` placeholder contrast.
- `StatusBadge.tsx`: Explicit mappings for `INSTANT` and `HOST_APPROVAL` booking modes.
- `EmptyState.tsx` & `ErrorState.tsx`: Direct mascot integration without double-card borders; `shrug` mascot support in `ErrorState`.

