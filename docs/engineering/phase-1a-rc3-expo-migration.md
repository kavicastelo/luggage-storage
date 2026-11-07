# Phase 1A-RC3: Expo SDK Lifecycle Assessment & SDK 58 Migration Report

**Document ID:** ENG-EXP-001  
**Phase:** Phase 1A-RC3 — Runtime, Framework Lifecycle & Database Verification Closure  
**Author:** Mobile Application Architect & Expo Migration Specialist  
**Date:** 2026-11-07  
**Status:** MIGRATED & VERIFIED (EXIT 0)  
**Authoritative Mobile Baseline:** Expo SDK 58 (Latest Stable Release: `58.0.23`)

---

## 1. Executive Summary & Lifecycle Reassessment

In accordance with Section 4 (WP-03), a lifecycle evaluation of the mobile client framework was conducted:
- **Expo SDK 52:** Released in November 2024. While operational, it represents a legacy SDK baseline that tied the project to older React Native 0.76 and React 18 toolchains.
- **Expo SDK 57:** Stable interim release (`57.0.32`).
- **Expo SDK 58:** The **latest official stable release (`58.0.23`)**, featuring React Native 0.88.1, React 19.3.0, and Expo Router 58.0.30.

Following risk evaluation against official release documentation, the mobile workspace (`apps/mobile`) has executed a controlled migration to **Expo SDK 58**. All TypeScript types, store tests, Metro bundling, and multi-platform Hermes bytecode export have passed with zero errors.

---

## 2. Dependency Manifest Migration Delta (`apps/mobile/package.json`)

| Module | Pre-Migration (SDK 52 Baseline) | Post-Migration (SDK 58 Stable Baseline) | Compatibility Role |
| :--- | :---: | :---: | :--- |
| `expo` | `~52.0.49` | **`~58.0.23`** | Core Expo Application Framework |
| `react-native` | `0.76.9` | **`0.88.1`** | Native Mobile Engine (New Architecture) |
| `react` | `18.3.1` | **`19.3.0`** | Unified Mobile UI Engine |
| `react-dom` | `18.3.1` | **`19.3.0`** | Web DOM Rendering Engine |
| `expo-router` | `~4.0.22` | **`~58.0.30`** | File-based Navigation Engine |
| `expo-constants` | `~17.0.8` | **`~58.0.15`** | Environment & App Configuration |
| `expo-linking` | `~7.0.5` | **`~58.0.16`** | Deep Linking & Routing Interop |
| `expo-status-bar` | `~2.0.1` | **`~58.0.4`** | Native Status Bar Controller |
| `expo-splash-screen`| — | **`~58.0.13`** | Native Splash Controller |
| `react-native-safe-area-context` | `4.12.0` | **`~5.11.1`** | Safe Area Inset Management |
| `react-native-screens` | `~4.4.0` | **`~4.30.1`** | Native Screen Container Management |
| `react-native-web` | `~0.19.13` | **`~0.21.4`** | React Native for Web Polyfills |

---

## 3. Platform & Architectural Support Audit

### 3.1 Minimum Operating System Requirements
- **iOS:** iOS 15.1+ minimum deployment target.
- **Android:** Android 7.0+ (API Level 24+) minimum SDK. Target SDK: Android 15 (API Level 35).

### 3.2 Dual-Role File-Based Navigation Architecture
The single-codebase dual-role navigation architecture is fully preserved under Expo Router 58:
- `apps/mobile/app/index.tsx`: Role selector entrypoint.
- `apps/mobile/app/(traveller)/`: Traveller tab layouts (`index.tsx`, `explore.tsx`).
- `apps/mobile/app/(host)/`: Host tab layouts (`index.tsx`, `scanner.tsx`).

### 3.3 Metro Bundler & Workspace Symlink Resolution
The configuration in `apps/mobile/metro.config.js` properly configures:
```javascript
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules")
];
```
Resolves `@luggage-storage/contracts` and monorepo workspace packages seamlessly.

---

## 4. Verification Evidence

### 4.1 TypeScript Compilation (`pnpm --filter @luggage-storage/mobile typecheck`)
```text
$ tsc --noEmit
Exit Code: 0 (Zero type errors)
```

### 4.2 Application Tests (`pnpm --filter @luggage-storage/mobile test`)
```text
$ vitest run

 RUN  v3.2.7 D:/luggage-storage/luggage-storage/apps/mobile

 ✓ tests/store.test.ts (2 tests) 4ms
   ✓ initial active role defaults to traveller
   ✓ setActiveRole toggles between traveller and host

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Duration  658ms
```

### 4.3 Multi-Platform Production Export (`pnpm --filter @luggage-storage/mobile build`)
```text
$ expo export
Expo Autolinking module resolution enabled
Starting Metro Bundler

Web Bundled 1491ms (775 modules)
Android Bundled 8511ms (1022 modules)
iOS Bundled 15465ms (1210 modules)

› web bundles (11):
  _expo/static/js/web/__common-*.js (18KB)
  _expo/static/js/web/entry-*.js (1.1MB)
  ... and 9 sub-route chunks

› android bundles (1):
  _expo/static/js/android/entry-dbf5ed380a3b0c7fd36cf5366767d0c4.hbc (2.6MB)

› ios bundles (1):
  _expo/static/js/ios/entry-3345e9518b6c4638c24d1c333d464d3e.hbc (2.6MB)

› Files (2):
  index.html (1.4KB)
  metadata.json (3.4KB)

Exported: dist
Exit Code: 0
```

---

## 5. Conclusion & Baseline Adoption

Expo SDK 58 is officially adopted as the verified, stable mobile baseline. Hermes bytecode generation is fully proven across both Android and iOS targets.

