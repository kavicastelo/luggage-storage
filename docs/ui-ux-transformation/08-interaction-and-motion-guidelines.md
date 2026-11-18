# 08 — Interaction, Animation & Micro-Interaction Guidelines (`WS-UX-08`)

**Objective:** Make every user interaction feel crisp, responsive, and trustworthy without adding distracting bounce, blocking counter operations, or violating `prefers-reduced-motion`.

---

## 1. Core Motion Principles

1. **Purposeful State Continuity:** Motion signals state transitions (drawer slide-over, modal fade-scale, accordion reveal, copy checkmark feedback, skeleton pulse).
2. **Speed Over Ornamentation:**
   - Micro-interactions (buttons, inputs, focus rings, chip toggles): `150ms` cubic-bezier `(0.4, 0, 0.2, 1)`.
   - Overlays (Modal, SlideOverDrawer, Mobile Nav Drawer): `200ms` enter / `150ms` exit.
   - Counter operations (`HostOperationsDeskPage`, `scanner.tsx`, `intake.tsx`): **Zero** decorative entrance animations that delay input or button clicks.
3. **Honest Confirmation:** Never display celebratory mascots, green checkmarks, or `"Confirmed"` UI before the API mutation resolves with confirmed backend state.
4. **Reduced-Motion Compliance:**
   - Web (`apps/web/src/index.css`): Global `@media (prefers-reduced-motion: reduce)` rule disabling CSS transitions/animations (`animation-duration: 0.01ms !important`, `transition-duration: 0.01ms !important`).
   - Mobile (`apps/mobile`): Respect `AccessibilityInfo.isReduceMotionEnabled()` in animated components (`LoadingSkeleton`, transitions) and avoid jarring spring oscillations.

---

## 2. Standard Interaction Patterns

| Pattern | Web Implementation | Mobile Implementation |
|---|---|---|
| **Pressed / Hover Feedback** | `active:scale-[0.98]` on primary/secondary buttons, crisp hover elevation on location cards (`hover:-translate-y-0.5 hover:shadow-md`) | `Pressable` / `TouchableOpacity` `activeOpacity={0.78}` + subtle scale/opacity feedback |
| **Dialogs & Drawers** | `Modal` & `SlideOverDrawer` support `Escape` key close, backdrop click close, scroll lock, and `animate-fade-in` / `animate-slide-in-right` | `BottomSheet` & `ConfirmDialog` support backdrop tap close, internal `KeyboardAvoidingView`, and hardware back |
| **Loading States** | Surface-matched `LoadingSkeleton` (KPI grids, table rows, card grids) instead of flashing `0` or empty-state placeholders | Pulse-animated `LoadingSkeleton` variants (`card`, `list`, `detail`, `kpi`) respecting reduced motion |
| **Copy-to-Clipboard** | Toggle `Copy` -> `Check` icon with `aria-live="polite"` status text (`"Copied"`) for QR tokens, Booking IDs, Audit Event IDs | Explicit toast/inline confirmation pill on copy |
| **Destructive Actions** | Always gated behind explicit confirmation `<Modal>` (Location Disable, Zone/Pool Delete, Staff Removal, Role Revoke, Sign Out All Devices) | Always gated behind `ConfirmDialog` (Staff Remove, Cancel Booking, Sign Out All) |
| **Form Validation & Keyboard Flow** | `htmlFor` + `aria-invalid` + `aria-describedby` + `role="alert"`; `<form>` wraps search/lookup bars so `Enter` submits | `returnKeyType="next"` -> `ref.focus()` chaining; `keyboardDismissMode="on-drag"` |

