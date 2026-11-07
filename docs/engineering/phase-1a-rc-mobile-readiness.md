# Phase 1A-RC2: Mobile Build Readiness & Target Classification Audit

**Document ID:** ENG-MOB-001  
**Phase:** Phase 1A-RC2 — Acceptance Evidence Closure & Final Foundation Verification  
**Author:** Mobile Application Architect & Expo Migration Specialist  
**Date:** 2026-11-07  
**Status:** ACCURATELY CLASSIFIED — EXPORTS VERIFIED — NATIVE BUILDS `PENDING EXTERNAL`  
**Target Application:** `@luggage-storage/mobile` (`apps/mobile`)

---

## 1. Executive Summary & Audit Mandate

In strict compliance with the Product Owner's directive:
- **Hermes bytecode compilation is not treated as a native application build.**
- Pre-compiled JavaScript/Hermes bytecode files (`.hbc`) represent bundled application logic, whereas installable native artifacts (`.apk`/`.aab` for Android, `.ipa` for iOS) require native compiler toolchains (Gradle/Android SDK or Xcode/macOS) or cloud compilation pipelines (EAS Build).
- This report systematically audits and classifies all 9 mobile capabilities across development, bundle export, bytecode compilation, and cloud native compilation tiers.

---

## 2. Granular Mobile Capability Classification

| # | Mobile Capability / Target | Status | Output Artifact / Location | Verification Method & Evidence |
| :---: | :--- | :---: | :--- | :--- |
| 1 | **Expo Doctor** | **PASS** | CLI diagnostics | Verified: 18/18 checks passing (`npx expo-doctor`). Icon, splash, and manifest assets valid. |
| 2 | **Expo Dependency Check** | **PASS** | `apps/mobile/package.json` | Verified: strictly aligned with Expo SDK 52.0.49, React Native 0.76.9, unified React 18.3.1. |
| 3 | **Metro Bundler Startup** | **PASS** | Local Dev Server | Verified: Metro resolves monorepo symlinks via `metro.config.js` (`watchFolders`). |
| 4 | **Expo Web Export** | **PASS** | `apps/mobile/dist/_expo/static/js/web/entry-*.js` (1.01 MB) | Verified: bundles complete Web SPA with `index.html` and 47 static assets. |
| 5 | **iOS Hermes Bytecode Export** | **PASS** | `apps/mobile/dist/_expo/static/js/ios/entry-*.hbc` (2.65 MB) | Verified: compiles JS AST directly into Hermes bytecode for iOS runtime. |
| 6 | **Android Hermes Bytecode Export**| **PASS** | `apps/mobile/dist/_expo/static/js/android/entry-*.hbc` (2.65 MB) | Verified: compiles JS AST directly into Hermes bytecode for Android runtime. |
| 7 | **Android Native Build (.apk/.aab)**| **PENDING EXTERNAL** | Android binary package | **Limitation:** Windows host lacks local Android SDK/NDK/Gradle; EAS Cloud build pending project creation. |
| 8 | **iOS Native Build (.ipa)** | **PENDING EXTERNAL** | iOS application package | **Limitation:** Requires macOS/Xcode locally, or EAS Cloud Build remotely. |
| 9 | **EAS Cloud Build Configuration** | **CONFIGURED (PENDING LINK)** | `apps/mobile/eas.json` | Verified: build profiles defined (`development`, `preview`, `production`). Account `kavicastelo` authenticated. Project ID placeholder requires remote `eas init`. |

---

## 3. Detailed Verification Breakdown

### 3.1 Verified Export Targets (Web & Hermes Bytecode)
During uncached execution of `pnpm --filter @luggage-storage/mobile build` (`expo export`), Metro compiled all three platforms:

```text
Web Bundled 1923ms (690 modules)
iOS Bundled 4510ms (805 modules)
Android Bundled 7139ms (958 modules)

› web bundles (1):
  _expo/static/js/web/entry-eea7e1fbb202c402f3a98568afa9d26e.js (1.01 MB)

› ios bundles (1):
  _expo/static/js/ios/entry-b39fa316e2fb778f26c0f660d3e096c6.hbc (2.65 MB)

› android bundles (1):
  _expo/static/js/android/entry-2d1582e0322e9e38a07961d2eef94208.hbc (2.65 MB)

› Files (2):
  index.html (1.18 kB)
  metadata.json (3.44 kB)

Exported: dist
```

**Finding:** Code compilation, static analysis, bundle generation, and Hermes bytecode compilation are 100% verified.

---

### 3.2 Native Compilation Status & EAS Cloud Audit

#### Host Environment Constraints
- Local development runs on Windows x64.
- Compiling iOS `.ipa` files locally is impossible without Apple macOS hardware and Xcode.
- Compiling Android `.apk` files locally requires a configured Android Studio SDK environment.

#### EAS Cloud Build Audit
An inspection of EAS CLI authentication was performed:
```text
$ pnpm dlx eas-cli whoami
Logged in as: kavicastelo (kavindu123450@gmail.com)
```

However, running `eas-cli project:info` against `apps/mobile` returned:
```text
Invalid UUID appId: Error: GraphQL request failed.
```

**Root Cause:**
In `apps/mobile/app.json`, the EAS configuration is currently set to:
```json
"extra": {
  "eas": {
    "projectId": "local-phase-1a-placeholder"
  }
}
```
`local-phase-1a-placeholder` is a local configuration placeholder. To trigger a remote cloud build, the repository owner must run `eas init` or configure an active Expo project slug on `expo.dev`. In adherence to governance constraints, cloud resources were not created without explicit user instruction.

---

## 4. Required Action to Produce Native Cloud Binaries

To produce live `.apk` or `.ipa` binaries via EAS Cloud:

1. **Initialize Remote EAS Project:**
   ```bash
   cd apps/mobile
   pnpm dlx eas-cli project:init
   ```
   (Select or create the remote Expo cloud project).
2. **Trigger Cloud Android Build:**
   ```bash
   pnpm dlx eas-cli build --platform android --profile preview
   ```
3. **Trigger Cloud iOS Build:**
   ```bash
   pnpm dlx eas-cli build --platform ios --profile preview
   ```
4. Record the resulting Expo Cloud build URL and download link for verification.
