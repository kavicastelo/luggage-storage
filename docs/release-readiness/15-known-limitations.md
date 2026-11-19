# Phase 8 — Known Limitations & Operational Constraints

**Document:** `docs/release-readiness/15-known-limitations.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8 — Governance & Release Candidate Evaluation  
**Status:** COMPLETED & VERIFIED  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Auditor  

---

## 1. Purpose

In accordance with strict release governance principles, this document transparently registers all known platform limitations, environmental boundaries, and deferred capabilities. None of the items listed below block Gate A (Demo Release) or Gate B (Production Release Candidate conditional on credentials). They represent documented boundaries for post-launch enhancement.

---

## 2. Inventory of Known Limitations

### 2.1 Navigation & Mapping Boundaries
- **Intermittent Network Requirement for Routing:** While the in-app SVG map renderer, deviation calculator, and arrival detector run locally on-device, calculating an initial route or recalculating upon significant route deviation requires a network round-trip to `/api/v1/maps/routes`. True offline MBTiles vector caching is deferred to Phase 9.
- **Speech Synthesis Voice Selection:** In-app turn-by-turn voice guidance utilizes the platform default TTS engine (`SpeechSynthesisUtterance` on web/Android). Specific accent selection (e.g. Sri Lankan English) depends on the host operating system's installed voice packs.

### 2.2 Mobile Application & Hardware Emulation Boundaries
- **Camera Scanning in Simulators:** Native camera hardware is unavailable in standard iOS Simulators and Android AVDs. Testers running on emulators must use the 6-digit numeric PIN fallback (`123456` in demo mode) to simulate baggage intake rather than QR scanning. Physical device testing functions as expected.
- **EAS Project ID Placeholder:** `apps/mobile/app.json` contains `extra.eas.projectId: "local-phase-1a-placeholder"`. Local APK compilation (`eas build --local`) works without cloud EAS binding. For cloud EAS builds, the engineering team must run `eas project:init` to link their organization's Expo dashboard.

### 2.3 Financial & Payout Operations
- **Batch / Offline Host Payouts:** The current finance module securely stores AES-256-GCM encrypted host bank account numbers and creates immutable double-entry ledger payable records. Payout disbursement is performed via batch bank transfers rather than instant automated Stripe Connect Custom/Express transfers. Automated Connect payout rails are scheduled for international expansion.
- **Single Currency Checkout per Booking Hold:** While the platform supports LKR, USD, EUR, and GBP, an individual booking hold locks its quote in a single currency at hold creation time to prevent currency fluctuation arbitrage.

### 2.4 Real-Time Communications & Localization
- **Polling vs WebSockets for Booking Status:** The checkout return flow (`/booking/confirm` and `/checkout-status`) polls the backend for authoritative payment gateway confirmation. WebSockets / Server-Sent Events (SSE) for instant webhook broadcast will be introduced in Phase 9.
- **Primary Language:** The UI and error taxonomies are currently in English. Sinhala and Tamil localization strings are architected in `@luggage-storage/contracts` but awaiting finalized community translations.

---

## 3. Risk Assessment Summary

All identified limitations have established fallbacks (e.g. numeric PIN for camera, batch bank transfers for payouts, polling for confirmation). No critical customer-facing failure modes exist within the documented operating boundaries.

