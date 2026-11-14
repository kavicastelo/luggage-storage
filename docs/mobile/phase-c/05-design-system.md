# Stage C1 — Mobile CWCP Design System

## 1. Unified Palette & Surfaces (`apps/mobile/src/lib/theme.ts`)
Aligned directly with `@luggage-storage/contracts` (`cwcpPalette`, `cwcpSemanticRoles`):
- **Primary Canvas:** `mobileColors.canvas` = `#FAF8F5` (Sunlit Sand)
- **Card / Elevated Surface:** `mobileColors.card` = `#FFFFFF` with `#E5DFD7` borders and Coastal Navy (`#0A192F`) subtle shadows (`mobileShadows.sm` / `md` / `lg`)
- **Primary CTA:** `mobileColors.ctaBg` = `#C55013` (Ceylon Terracotta 500) with `#FFFFFF` text (strict WCAG 2.2 AA contrast)
- **Secondary Grounding & Headers:** `mobileColors.navy[900]` (`#0A192F`) & `navy[950]` (`#070E1A`)
- **App Splash & Android Adaptive Icon (`app.json`):** Updated from legacy slate-blue `#2563eb` to `#0A192F` (`ocean.900`).

## 2. Ergonomics, Safe Areas & Accessibility
- **Root Wrapper (`app/_layout.tsx`):** Wrapped in `SafeAreaProvider` from `react-native-safe-area-context` + `QueryClientProvider`.
- **Touch Target Minimums (`mobileControlSizes`):**
  - `minTouchTarget`: `48pt`
  - `buttonSm`: `48pt`, `buttonMd`: `50pt`, `buttonLg`: `56pt`
  - `inputHeight`: `50pt`
  - `iconButton`: `48x48pt` with `hitSlop`
- **Contrast-Safe Text (`mobileTextColors`):** High-contrast `#070E1A` headings, `#4B453E` secondary copy, `#6B635A` muted labels, zero raw `#2563eb` defaults.

## 3. Shared Component Kit (`apps/mobile/src/components/index.ts`)
| Component | Path | Purpose |
| :--- | :--- | :--- |
| `Button` | `src/components/Button.tsx` | Accessible CTA button (`primary`, `secondary`, `ocean`, `outline`, `ghost`, `danger`; min height `>= 48pt`) |
| `Badge` | `src/components/Badge.tsx` | Pill status/metadata badge with optional `MobileIcon` |
| `Card` | `src/components/Card.tsx` | Surface container (`default`, `elevated`, `outlined`, `accent`, `navy`) |
| `IconButton` | `src/components/ui/IconButton.tsx` | `>= 48x48` vector icon button with mandatory `accessibilityLabel` |
| `ScreenContainer` | `src/components/ui/ScreenContainer.tsx` | Safe-area wrapper with optional `ScrollView`, `RefreshControl`, `KeyboardAvoidingView`, and responsive max width (`640px`) |
| `SafeHeader` | `src/components/ui/SafeHeader.tsx` | Top-inset header bar with accessible back `IconButton` and `light`/`navy` variants |
| `BottomNavigation` | `src/components/ui/BottomNavigation.tsx` | Bottom tab strip using `useSafeAreaInsets().bottom`, badge counts, and active pill indicator |
| `TextInput` | `src/components/ui/TextInput.tsx` | Labelled CWCP text field with error/helper messaging, leading icon, and show/hide password toggle |
| `SearchInput` | `src/components/ui/SearchInput.tsx` | Search input with vector icon and `>= 48x48` clear button |
| `DateTimeSelector` | `src/components/ui/DateTimeSelector.tsx` | `@react-native-community/datetimepicker` native picker on iOS/Android + web quick-adjust modal, `Asia/Colombo` formatting |
| `SelectionCard` | `src/components/ui/SelectionCard.tsx` | Accessible radio/checkbox option card |
| `StatusBadge` | `src/components/ui/StatusBadge.tsx` | Authoritative mapping of Booking, Payment, Custody, Host Business, Location, Verification & Payable statuses |
| `LocationCard` | `src/components/ui/LocationCard.tsx` | Privacy-safe discovery card (`approximateArea`, `distanceMeters`, LKR rate via `formatCurrencyMinorUnits`, honest review status) |
| `PriceSummary` | `src/components/ui/PriceSummary.tsx` | Server-quoted LKR price breakdown & cancellation policy notice |
| `EmptyState` | `src/components/ui/EmptyState.tsx` | Mascot or vector icon empty state with optional CTA |
| `LoadingSkeleton` | `src/components/ui/LoadingSkeleton.tsx` | Structured loading card placeholders |
| `ErrorState` | `src/components/ui/ErrorState.tsx` | Accessible error banner with retry action |
| `ConfirmDialog` | `src/components/ui/ConfirmDialog.tsx` | Cross-platform modal dialog replacing native `Alert.alert` |
| `BottomSheet` | `src/components/ui/BottomSheet.tsx` | Safe-area bottom sheet modal |
| `FormSection` | `src/components/ui/FormSection.tsx` | Grouped form container with section header & inline errors |
| `ImageGallery` | `src/components/ui/ImageGallery.tsx` | Horizontal facility image carousel with honest empty state |
| `BookingSummary` | `src/components/ui/BookingSummary.tsx` | `OQ-012` privacy-aware booking summary card |
| `PaymentStatusPanel` | `src/components/ui/PaymentStatusPanel.tsx` | PayHere checkout/status panel with Re-open / Check Status / Retry buttons |
| `QrCodeMatrix` | `src/components/ui/QrCodeMatrix.tsx` | Real scannable ISO QR SVG matrix backed by `qrcode` + `react-native-svg` |

