# ADR-002: React Native + Expo with EAS Cloud Builds for Mobile Applications

- **Status:** Accepted
- **Date:** 2026-11-07
- **Phase:** Phase 0A — Product Architecture & System Foundation
- **Related Documents:** [System Architecture Overview](../system-architecture.md), [Application Architecture Boundaries](../application-boundaries.md), [ADR-003](ADR-003-shared-mobile-codebase-separate-identities.md)

---

## 1. Context

The platform requires full-featured iOS and Android mobile applications for both **Travellers** (`FR-1`–`FR-14`) and **Hosts** (`FR-15`–`FR-44`), including native capabilities such as interactive vector maps (`MapLibre React Native`), camera-based QR scanning and photo evidence capture (`expo-camera`), GPS location lookup (`expo-location`), and push notifications (`expo-notifications`).

Critically, the primary development environment is **Windows**, meaning the engineering workflow cannot depend on local macOS hardware or local Xcode installations to build and distribute iOS applications.

---

## 2. Decision

We will build the mobile applications using **React Native, Expo, and TypeScript**, using:
- **Expo Router** for file-based navigation.
- **Expo Development Builds (`expo-dev-client`)** rather than standard Expo Go to support custom native modules (`MapLibre React Native`).
- **Expo Application Services (EAS Build)** to compile both Android (`.apk` / `.aab`) and iOS (`.ipa`) development, preview, and production binaries in the cloud.
- **TanStack Query, Zustand, React Hook Form, and Zod** for data fetching, state management, and form validation.

---

## 3. Alternatives Considered

1. **Separate Native iOS (Swift) and Android (Kotlin) Codebases:**
   - *Rejected:* Doubles mobile development effort, requires macOS hardware for iOS development, and prevents sharing TypeScript validation/API contracts with the web and backend.
2. **Bare React Native CLI without Expo / EAS:**
   - *Rejected:* Requires manual maintenance of `ios/` and `android/` native project folders and cannot compile iOS builds directly from a Windows machine without third-party macOS CI configuration.
3. **Standard Expo Go Client without Development Builds:**
   - *Rejected:* `MapLibre React Native` includes custom native C++/Objective-C/Kotlin map rendering code that cannot run inside the pre-compiled Expo Go sandbox.

---

## 4. Consequences

### Positive
- **Full Windows-to-iOS Pipeline:** Developers on Windows can trigger iOS simulator/device development builds and App Store submissions via Expo EAS Cloud runners.
- **Code Sharing with Web & API:** 100% TypeScript compatibility with `@luggage/shared-types`, `@luggage/validation`, and `@luggage/api-client`.
- **Native Hardware Access:** First-class support for camera, QR scanning, GPS location, and push notifications via Continuous Native Generation (`CNG` / config plugins).

### Negative / Trade-offs
- Adding or upgrading a native library (such as MapLibre or camera plugins) requires triggering a new EAS Development Build rather than a JS-only reload.

---

## 5. Risks & Mitigations

- **Risk:** EAS Cloud build queue times or free-tier build limits could slow iteration if native dependencies are changed frequently.
  - **Mitigation:** Lock core native dependencies (`MapLibre`, `expo-camera`, `expo-location`, `expo-notifications`) early in Phase 1 so 99% of day-to-day UI and business logic changes run instantly via Metro Fast Refresh / OTA updates against an existing Development Build.

