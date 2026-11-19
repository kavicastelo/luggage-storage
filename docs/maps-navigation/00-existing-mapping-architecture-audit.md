# Existing Mapping Architecture Audit

**Initiative:** Cross-Platform Mapping & Navigation Transformation  
**Branch:** `feature/in-app-maps-navigation`  
**Date:** 2026-11-19  
**Status:** Complete  
**Scope:** `apps/api`, `apps/web`, `apps/mobile`, `packages/contracts`, database schema, PostGIS integration, and third-party provider configurations.

---

## 1. Executive Summary

This audit assesses the pre-transformation mapping, routing, geocoding, and navigation state of the Global Luggage Storage Marketplace (`kavicastelo/luggage-storage`).

Prior to this transformation, the application possessed sophisticated PostGIS geospatial storage and privacy-preserving discovery on the backend, but its frontends relied on simulated 2D coordinate projections, static images, or external redirection to Google Maps as the primary "directions" experience:
- **Web Discovery (`apps/web`):** [LocationDiscoveryMap.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/features/traveller/LocationDiscoveryMap.tsx) rendered an SVG grid with projected percentage pins over an optional static MapTiler satellite/streets raster image backdrop (`https://api.maptiler.com/maps/streets-v2/static/...`).
- **Mobile Discovery & Directions (`apps/mobile`):** [DiscoveryView.tsx](file:///d:/luggage-storage/luggage-storage/apps/mobile/src/components/DiscoveryView.tsx) only rendered list cards without an interactive map. When viewing a confirmed custody pass in [pass.tsx](file:///d:/luggage-storage/luggage-storage/apps/mobile/app/(traveller)/pass.tsx#L180), tapping "Directions" unconditionally executed `Linking.openURL("https://www.google.com/maps/search/?api=1&query=...")`.
- **Routing & Navigation Engine:** There was **zero** in-app routing or directions engine. No API endpoint existed for calculating routes (`POST /api/v1/maps/routes`), no turn-by-turn guidance state machine existed, and no client could render vector polylines or maneuver steps.
- **Geocoding & Autocomplete:** Host location creation relied on manual text inputs for address, city, and postal code without map pin-drop, interactive coordinate picking, or reverse geocoding validation.

---

## 2. Inventory of Current Mapping Components and Usage

### 2.1 External Google Maps Usage
A repository-wide code search (`git grep -in "google.com/maps"` and `git grep -in "maps.google.com"`) identified exactly three occurrences:
1. `apps/mobile/app/(traveller)/pass.tsx:180`:
   ```ts
   const coords = `${detail.location.exactLatitude},${detail.location.exactLongitude}`;
   void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${coords}`);
   ```
2. `apps/mobile/app/(traveller)/pass.tsx:186`:
   ```ts
   const query = encodeURIComponent(`${detail.location.addressLine1 || ""} ${detail.location.city}`.trim());
   void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
   ```
3. `apps/web/src/features/admin/AdminLocationModerationPage.tsx:365`:
   ```tsx
   href={`https://www.google.com/maps/search/?api=1&query=${detailQuery.data.latitude.toFixed(6)},${detailQuery.data.longitude.toFixed(6)}`}
   ```
   Used as an administrative back-office verification link for staff reviewing KYC/location submissions.

### 2.2 Existing MapTiler & Leaflet / MapLibre Usage
- **Configuration:** `.envs/web.example` and `apps/web/.env.example` defined `VITE_MAPTILER_KEY=` (optional with graceful fallback).
- **Web Rendering:** `apps/web/src/features/traveller/LocationDiscoveryMap.tsx` constructed a static 600x360 PNG URL:
  `https://api.maptiler.com/maps/streets-v2/static/${centerPoint.approximateLongitude},${centerPoint.approximateLatitude},8/600x360.png?key=${mapTilerKey}`
  If the key was absent or invalid, it displayed a dark Navy SVG grid with fallback pin dots.
- **Mobile Rendering:** No MapTiler, Leaflet, or MapLibre libraries were installed in `apps/mobile/package.json`.

---

## 3. Database & PostGIS Geospatial Layer

### 3.1 PostGIS Extension & Schema
- **Database:** PostgreSQL 16 with PostGIS 3.5 (`postgisVersion: "3.5 USE_GEOS=1 USE_PROJ=1 USE_STATS=1"`).
- **Table:** `storage_locations` in `apps/api/src/infrastructure/database/schema/locations.ts`:
  - `latitude`: `numeric("latitude", { precision: 10, scale: 7 }).notNull()`
  - `longitude`: `numeric("longitude", { precision: 10, scale: 7 }).notNull()`
  - `coarseCoordinates`: `geometry("coarse_coordinates", { type: "Point", srid: 4326 })`
  - `exactCoordinates`: `geometry("exact_coordinates", { type: "Point", srid: 4326 })`
  - Spatial Index: GiST indexes on `coarse_coordinates` and `exact_coordinates` created in migration `0008_phase_a_final_security_gate.sql`.

### 3.2 Discovery Spatial Querying
In `apps/api/src/modules/discovery/discovery.service.ts`:
```sql
ST_DWithin(
  sl.coarse_coordinates,
  ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography,
  ${radiusMeters}
)
```
- Coarse distance calculation:
```sql
ST_Distance(
  sl.coarse_coordinates,
  ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography
) AS distance_meters
```
- **Privacy Enforcement (`OQ-012`):** The discovery service strictly returns `coarseLatitude` and `coarseLongitude` for public discovery responses, obfuscated to ~100-300m jitter. Exact coordinates are protected and only released upon confirmed booking custody unlock.

---

## 4. GPS & Geolocation Handling

### 4.1 Web Geolocation
`apps/web` relied on browser `navigator.geolocation.getCurrentPosition` in `apps/web/src/pages/PublicMarketplacePages.tsx`.

### 4.2 Mobile Geolocation
`apps/mobile/src/lib/geolocation.ts` implemented `getCurrentDeviceLocation(timeoutMs)` using `navigator.geolocation` (polyfilled by React Native / web):
- Supported foreground single-shot coordinate retrieval.
- Handled timeout and permission denial gracefully (`denied: true, reason: "..."`).
- Lacked active live GPS watch streams (`watchPositionAsync`), heading/bearing calculation, and speed calculation.

---

## 5. Gap Analysis

| Feature Area | Current State | Target State | Impact / Priority |
| :--- | :--- | :--- | :--- |
| **Routing Engine** | Absent (None) | Dedicated backend routing service (`POST /api/v1/maps/routes`) supporting MapTiler Directions API with Walking, Driving, Cycling profiles and deterministic sandbox fallback | Critical (Blocker) |
| **Route Contracts** | None in `packages/contracts` | Zod schemas for `GeographicCoordinate`, `RouteRequest`, `RouteResult`, `RouteStep`, `RouteManeuver` | Critical (Blocker) |
| **Web Map Discovery** | Simulated 2D SVG scatter plot | Interactive vector map with dynamic pan/zoom, clustering, marker selection, and map/list two-way sync | High |
| **Web Route Preview** | External Google Maps link | In-app interactive route preview drawer showing route line, distance, duration, travel mode switcher, and maneuver list | High |
| **Mobile Map Component** | List view only | Cross-platform interactive map with location markers, user position dot, and route polylines | Critical |
| **Mobile Navigation Screen** | None (opens Google Maps) | Dedicated full-screen navigation HUD with live GPS tracking, upcoming turn icon, step distance, total ETA, and custody handoff button | Critical |
| **Voice Guidance** | None | In-app TTS announcements for turns, rerouting, and destination arrival | Medium / High |
| **Host Map Pin Dropper** | Manual text fields | Interactive map picker with coordinate validation and address geocoding | Medium |
| **External Fallback** | Unconditional default | Secondary fallback button ("Open in External Navigation App") for native Apple Maps / Google Maps | Medium |

---

## 6. Architecture Baseline Verification

- **Monorepo Tests:** All 75 test files (756 tests) passed with 100% green status across `packages/contracts`, `apps/api`, `apps/web`, and `apps/mobile`.
- **Database Status:** PostgreSQL 16 + PostGIS 3.5 live on port 5433 with verified schema and advisory locking.
- **Git Branch:** `feature/in-app-maps-navigation` branched cleanly from verified `main`/`dev`.

