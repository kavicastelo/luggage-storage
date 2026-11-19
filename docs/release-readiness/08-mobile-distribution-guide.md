# Phase 8 — Mobile Distribution & Build Guide

**Document:** `docs/release-readiness/08-mobile-distribution-guide.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8 — Workstream 4: Mobile Build & Distribution Readiness  
**Status:** COMPLETED & VERIFIED  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Auditor  

---

## 1. Executive Summary

The Luggage Storage mobile application (`apps/mobile`) is built on Expo SDK 58 and React Native 0.88 with file-system routing powered by Expo Router. It serves dual personas:
1. **Traveller:** Location discovery, GPS in-app turn-by-turn route navigation, booking reservation, and custody pass QR presentation.
2. **Host Staff:** QR code camera scanning, luggage intake tagging, seal verification, and collection handover.

This guide provides technical specifications, build configurations, and distribution procedures for generating direct installable Android APKs for internal testing and preparing iOS TestFlight distribution.

---

## 2. Application Identity & Permissions Matrix

### 2.1 Identifiers & Configuration (`apps/mobile/app.json`)
- **App Name:** `LuggageStorage`
- **Slug:** `luggage-storage`
- **Version:** `0.1.0`
- **Android Package Name:** `com.luggagestorage.app`
- **iOS Bundle Identifier:** `com.luggagestorage.app`
- **Deep Linking Scheme:** `luggagestorage://`

### 2.2 Permissions Manifest
| Platform | Permission | Justification / Usage |
|---|---|---|
| **Android** | `android.permission.CAMERA` | Luggage custody pass QR scanning by host attendants |
| **Android** | `android.permission.ACCESS_FINE_LOCATION` | Accurate street navigation to storage facilities |
| **Android** | `android.permission.ACCESS_COARSE_LOCATION` | City-level location discovery fallback |
| **iOS** | `NSCameraUsageDescription` | "Luggage Storage requires camera access to scan luggage QR custody passes." |
| **iOS** | `NSLocationWhenInUseUsageDescription` | "Luggage Storage uses your location to discover nearby storage facilities and navigate to luggage drop-off locations." |

---

## 3. EAS Build Configuration (`apps/mobile/eas.json`)

The `eas.json` configuration is structured with three dedicated build profiles:

```json
{
  "$schema": "https://openapi.expo.dev/eas-json.schema.json",
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  }
}
```

- **`development` Profile:** Generates a custom development client embedding native camera and geolocation runtime binaries for hot reloading.
- **`preview` Profile (Internal Demo):** Configures `android.buildType: "apk"`. Rather than creating an `.aab` (Google Play App Bundle), it compiles a standalone `.apk` that can be directly downloaded and sideloaded on any physical Android phone without Google Play Store approval.
- **`production` Profile:** Generates production release artifacts (`.aab` for Google Play and `.ipa` for Apple App Store).

---

## 4. Building the Android Demo APK

### 4.1 Prerequisites
Install the EAS CLI globally (or run via npx):
```bash
npm install -g eas-cli
```

### 4.2 Cloud Build via Expo Application Services
1. Log in to your Expo account:
   ```bash
   eas login
   ```
2. Initialize EAS project binding (if not already bound):
   ```bash
   cd apps/mobile
   eas project:init
   ```
3. Trigger the internal preview APK build:
   ```bash
   eas build --platform android --profile preview
   ```
4. Upon completion, EAS CLI prints a direct download link and QR code to download `LuggageStorage-preview.apk`.

### 4.3 Local Build (Without Expo Cloud Queues)
For environments with the Android NDK and JDK 17 installed locally:
```bash
cd apps/mobile
eas build --platform android --profile preview --local
```
The output APK is generated in the workspace root directory.

---

## 5. Sideloading & Tester Installation Instructions

### Android Tester Instructions:
1. Open the EAS download URL on your Android device (or transfer the `.apk` file via USB).
2. Tap the `.apk` file to install.
3. If prompted:
   - Tap **Settings** when warned "For your security, your phone is not allowed to install unknown apps from this source".
   - Toggle **Allow from this source** to ON.
   - Return and tap **Install**.
4. Launch **LuggageStorage**.
5. Grant camera and location permissions when prompted to enable in-app directions and baggage pass scanning.

---

## 6. Running Local Development & Web Emulation

### 6.1 Metro Development Server
```bash
pnpm --filter @luggage-storage/mobile start
```
- Press `a` to open in connected Android emulator / device.
- Press `i` to open in iOS simulator.
- Press `w` to open in mobile web browser (`http://localhost:8081`).

### 6.2 Standalone Bundle Verification
To verify that all JavaScript bundles export without native errors:
```bash
$env:EXPO_NO_TELEMETRY="1"; $env:CI="true"; pnpm --filter @luggage-storage/mobile build
```
*Result:* Exports clean Android (5.1MB), iOS (5.1MB), and Web (1.1MB) bundles into `apps/mobile/dist`.

---

## 7. iOS TestFlight Roadmap

For iOS device distribution:
1. **Apple Developer Account:** Enrollment in the Apple Developer Program ($99/year) is required.
2. **Certificates & Provisioning:** Run `eas credentials` to automatically manage Apple Distribution Certificates and Provisioning Profiles.
3. **Build Command:**
   ```bash
   eas build --platform ios --profile preview
   ```
4. **Distribution:** Upload the resulting build to Apple App Store Connect TestFlight for internal and external group testing.

