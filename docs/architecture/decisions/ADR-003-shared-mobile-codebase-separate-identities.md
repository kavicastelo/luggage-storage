# ADR-003: Shared Mobile Codebase with Separate Traveller and Host App Identities

- **Status:** Accepted
- **Date:** 2026-11-07
- **Phase:** Phase 0A — Product Architecture & System Foundation
- **Related Documents:** [Application Architecture Boundaries](../application-boundaries.md), [User Roles and Actor Model](../../product/user-roles-and-actors.md), [ADR-002](ADR-002-react-native-expo.md)

---

## 1. Context

The marketplace serves two distinct mobile audiences with very different daily workflows:
1. **Travellers (`FR-1`–`FR-14`):** Consumer discovery, map search, booking, online payment, directions, and QR/PIN display.
2. **Hosts (`FR-15`–`FR-44`):** Partner onboarding, KYC verification, multi-location management, capacity/pricing configuration, QR/PIN scanning, bag check-in photo evidence, and earnings tracking.

Maintaining two completely independent mobile projects (`apps/traveller-mobile` and `apps/host-mobile`) would duplicate authentication flows, UI components, MapLibre configurations, camera utilities, push notification logic, and native build setups. Conversely, shipping only a single combined store listing can clutter the consumer app experience with merchant tools.

---

## 2. Decision

We will maintain a **single shared Expo codebase at `apps/mobile`** that compiles into **two distinct application identities (app variants)** via dynamic Expo configuration (`app.config.ts`) and EAS build profiles (`eas.json`):

1. **Traveller Mobile Application** (`APP_VARIANT=traveller`, e.g., `com.<brand>.traveller`)
2. **Host Mobile Application** (`APP_VARIANT=host`, e.g., `com.<brand>.host`)

Both variants share common foundation modules (authentication, design system, API hooks, camera/map wrappers, localization) while mounting isolated Expo Router route groups (`(traveller)` vs. `(host)`) based on the build identity. Furthermore, the underlying user identity model supports users who hold both Traveller and Host roles (`OQ-007`).

---

## 3. Alternatives Considered

1. **Two Completely Separate Mobile Codebases (`apps/traveller-app` and `apps/host-app`):**
   - *Rejected:* Violates the approved application structure constraint and doubles dependency maintenance, native plugin configuration, and UI component work.
2. **Single App Binary Only (No Separate Store Identities):**
   - *Rejected:* Prevents dedicated App Store / Play Store positioning, app icons, and permission scopes tailored separately to consumers vs. commercial storage partners.

---

## 4. Consequences

### Positive
- **Zero Duplication of Infrastructure Code:** Auth, API client, design tokens, MapLibre setup, and camera/push utilities are written once in `apps/mobile`.
- **Independent Store Presence:** Separate Android package names and iOS bundle IDs allow independent App Store / Google Play listings and release cycles for Travellers and Hosts.
- **Role Flexibility:** A single user account can authenticate in either app variant according to their role.

### Negative / Trade-offs
- Requires discipline in dynamic configuration (`app.config.ts`) and route guarding so Host-only screens are not exposed in the Traveller build and vice versa.

---

## 5. Risks & Mitigations

- **Risk:** Unused screens from one variant could bloat the JS bundle of the other variant or expose unintended routes.
  - **Mitigation:** Entry-point routing explicitly gates route groups by `APP_VARIANT`, and backend RBAC independently enforces role permissions regardless of which client binary sends a request.

