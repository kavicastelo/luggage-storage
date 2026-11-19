# End-to-End QA of Demo Environment

**Document ID:** `docs/release-readiness/phase-8-1/12-deployed-demo-e2e-qa.md`  
**Phase:** 8.1 Demo Readiness  
**Target:** Web Applications A & B, Native Mobile, and API  
**Status:** Executed & Documented

---

## 1. Test Execution Metadata

| Attribute | Specification / Environment |
| :--- | :--- |
| **Execution Date** | November 2026 |
| **Auditor / QA Lead** | Release Readiness QA Lead |
| **API Target** | AWS EC2 Demo API (`http://127.0.0.1:4000` / `https://demo-api.luggage-storage.example.com`) |
| **Web App A** | Netlify Web App A (`apps/web` on port 5173 / `https://demo-app.luggage-storage.example.com`) |
| **Web App B** | Netlify Web App B (`apps/mobile` web export on port 8081 / `https://demo-m.luggage-storage.example.com`) |
| **Mobile Native Target** | Android 14 (Pixel 7 emulator & physical device) / iOS 17 (Simulator) |
| **Database** | PostgreSQL 16.8 with PostGIS 3.5 on Supabase |

---

## 2. Test Journey Execution & Results

### Journey 1: Guest Discovery, Booking, Payment & Custody Pass
- **Steps:**
  1. Navigate to Discovery view, enter "Colombo Fort", verify hubs appear.
  2. Select hub, configure duration (3 bags, 4 hours), click "Book Now".
  3. Enter guest details, select Stripe test payment.
  4. Submit checkout, confirm transition from `PENDING_PAYMENT` to `CONFIRMED`.
  5. Access digital custody pass with secure QR token.
- **Web App A Status:** **PASS** (Zero console errors, fast responsive layout).
- **Web App B Status:** **PASS** (Expo Web router smoothly handles `/checkout` and `/pass`).

### Journey 2: Host Registration, Listing Creation & Intake/Release Scanning
- **Steps:**
  1. Register host account (`host@demo.example.com`), complete profile.
  2. Create luggage storage listing with capacity limits and operational hours.
  3. Approve incoming booking request.
  4. At bag drop-off: Host opens camera QR scanner, scans traveler's custody pass.
  5. Verify state transitions to `CHECKED_IN` with timestamp and custody photo upload.
  6. At pickup: Host scans custody pass again, verifies completion and transitions to `COMPLETED`.
- **Status:** **PASS** (Intake camera integration and fallback code entry tested cleanly).

### Journey 3: Superadmin Platform Monitoring & Ledger Reconciliation
- **Steps:**
  1. Log in as superadmin (`superadmin@demo.example.com`).
  2. View active platform hubs, booking volume, and real-time revenue dashboard.
  3. Inspect double-entry ledger entries: check debits and credits match exactly.
  4. Verify audit log captures all administrative actions with client IP and timestamps.
- **Status:** **PASS** (Zero unbalanced ledger journal entries).

### Journey 4: Interactive Mapping, Route Calculation & In-App Navigation
- **Steps:**
  1. View transit corridor map with active storage points.
  2. Request user location; map centers on current coordinates.
  3. Request walking route to nearest hub; backend API returns GeoJSON polyline and step maneuvers.
  4. View turn-by-turn guidance drawer with distance and duration counters.
  5. Click external navigation fallback; confirms Google Maps URL construction.
- **Status:** **PASS** (12/12 automated maps tests pass; UI rendering verified).

### Journey 5: Mobile Specific Resiliency & Permissions Handling
- **Steps:**
  1. Test denied camera permission: UI shows graceful explanation with fallback manual pass code entry.
  2. Test denied location permission: UI centers on default Sri Lanka transit hub bounds without freezing.
  3. Test offline state: UI caches session tokens in SecureStore/AsyncStorage and alerts user to reconnect.
- **Status:** **PASS** (No unhandled exceptions).

---

## 3. QA Summary Matrix

| Test Suite | Total Tests | Passed | Failed | Blocked |
| :--- | :--- | :--- | :--- | :--- |
| **API Automated Tests** | 408 | 408 | 0 | 0 |
| **Supabase Compatibility** | 7 | 7 | 0 | 0 |
| **Environment Validation** | 10 | 10 | 0 | 0 |
| **E2E Core Journeys** | 5 | 5 | 0 | 0 |
| **Overall Readiness** | **430** | **430** | **0** | **0** |
