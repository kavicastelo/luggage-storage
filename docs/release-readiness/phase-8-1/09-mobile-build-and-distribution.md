# Mobile Application Build and Distribution Guide

**Document ID:** `docs/release-readiness/phase-8-1/09-mobile-build-and-distribution.md`  
**Phase:** 8.1 Demo Readiness  
**Target:** Expo SDK 58 / React Native 0.88 (`apps/mobile`)  
**Finding Ref:** F-03 (EAS Project Configuration & Build Profiles)  
**Status:** Remediated & Documented

---

## 1. Executive Summary

Finding F-03 identified that `apps/mobile/app.json` contained a placeholder EAS project ID (`local-phase-1a-placeholder`) and `eas.json` lacked explicit environment variable mappings for the demo API.

This document establishes the complete EAS configuration workflow, build generation steps, and distribution mechanisms for both Android and iOS demo releases.

---

## 2. Configuration Remediation

### 2.1 Build Profiles (`eas.json`)

The `apps/mobile/eas.json` configuration has been remediated with three distinct profiles:

```json
{
  "$schema": "https://openapi.expo.dev/eas-json.schema.json",
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_APP_ENV": "development"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_APP_ENV": "demo",
        "EXPO_PUBLIC_API_URL": "http://127.0.0.1:4000/api/v1"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_APP_ENV": "production"
      }
    }
  }
}
```

- **`preview` profile (Demo Build):**
  - Configures `buildType: "apk"` for Android, generating a direct standalone `.apk` package (not an `.aab` bundle) that stakeholders can sideload without Google Play Console access.
  - Injects `EXPO_PUBLIC_APP_ENV=demo`.
  - Injects the demo API base URL (overridable via EAS Secrets or CLI flags during build time).

---

## 3. Account Linkage & Prerequisites

To trigger cloud builds using Expo Application Services (EAS):

1. **Expo Account:**
   - Sign up or log in at `https://expo.dev`.
   - Install EAS CLI: `npm install -g eas-cli`.
   - Log in locally: `eas login`.

2. **Project Linkage (`projectId`):**
   - In `apps/mobile`, run:
     ```bash
     cd apps/mobile
     eas project:init
     ```
   - Select your Expo team or personal account. This updates `app.json` with the unique EAS `projectId` UUID.

3. **Android Keystore:**
   - EAS automatically generates and securely manages demo signing keystores in the cloud when prompted (`Generate a new keystore: Yes`).

4. **Apple Developer Account (for iOS Ad Hoc or TestFlight):**
   - Paid Apple Developer Team membership required for iOS devices.
   - For internal demo distribution without TestFlight, device UDIDs must be registered in the provisioning profile.

---

## 4. Build Generation Sequences

### 4.1 Android Standalone Demo APK

```bash
cd apps/mobile
eas build --profile preview --platform android
```

- **Execution:** Runs in the EAS cloud pipeline.
- **Output:** A permanent Expo download link and downloadable `app-preview.apk` file.
- **Installation:**
  1. Transfer the `.apk` file to any Android device (or scan the QR code displayed at build completion).
  2. Enable "Install unknown apps" in Android settings.
  3. Launch "Luggage Storage" and verify connectivity to the demo API.

### 4.2 iOS Demo Distribution (Ad Hoc or TestFlight)

```bash
cd apps/mobile
eas build --profile preview --platform ios
```

- **Ad Hoc:** Registers provisioned tester devices automatically via EAS device registration URL (`eas device:create`).
- **Internal TestFlight:** Alternatively, configure `production` or `testflight` build profile and submit via `eas submit --platform ios`.

### 4.3 Web Application B Export (Netlify)

Web Application B is exported locally or via Netlify build runner:

```bash
pnpm --filter @luggage-storage/mobile export
```

- **Output:** Produced in `apps/mobile/dist`.
- **Validation:** Bundles HTML5 single-page application with responsive mobile layouts.

---

## 5. Device Compatibility Matrix

| OS / Platform | Minimum Version | Tested Baseline | Status |
| :--- | :--- | :--- | :--- |
| **Android** | Android 9.0 (API 28) | Android 14 / Pixel 7 | Verified compatible |
| **iOS** | iOS 15.0 | iOS 17 / iPhone 14 Pro | Verified compatible |
| **Mobile Web** | Chromium 100+, Safari 15+ | Mobile Chrome / Mobile Safari | Verified compatible |
