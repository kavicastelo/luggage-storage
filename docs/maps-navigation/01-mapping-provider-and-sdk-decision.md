# Mapping Provider and SDK Technology Decision

**Initiative:** Cross-Platform Mapping & Navigation Transformation  
**Branch:** `feature/in-app-maps-navigation`  
**Date:** 2026-11-19  
**Status:** Approved  
**Document ID:** `01-mapping-provider-and-sdk-decision`

---

## 1. Context and Problem Statement

The Global Luggage Storage Marketplace requires interactive mapping, nearby discovery, route preview, and turn-by-turn navigation across Web (`apps/web`) and Mobile (`apps/mobile`), primarily serving travellers and hosts in Sri Lanka and international transit hubs.

Currently:
1. Web renders a static raster preview with simulated SVG pins.
2. Mobile relies exclusively on external browser redirection (`Linking.openURL("https://www.google.com/maps/search/?api=1&query=...")`).
3. No backend routing or geocoding services exist.

We must choose production-ready, performant, commercially sound technologies for:
- Map tile rendering (Web and Mobile).
- Directions and routing engine.
- Geocoding and reverse geocoding.
- Mobile in-app navigation and turn-by-turn state machine.
- Audio / Voice guidance.
- External navigation fallback.

---

## 2. Evaluation Criteria

1. **Expo and React Native Compatibility:** Zero native build breakages. `apps/mobile` runs on Expo SDK 58 (React Native 0.88.1, React 19.3.0) and builds for Android, iOS, and Web (`Platform.OS === 'web'`). Must pass `expo export --no-bytecode` in CI without native linking crashes.
2. **Provider Independence:** Clean hexagonal architecture. UI and business logic must interact with normalized domain contracts (`packages/contracts/src/maps`), not vendor-specific schemas.
3. **Sri Lanka Coverage and Global Scalability:** High-resolution road networks, pedestrian walkways, railway stations, and transit hubs across Colombo, Kandy, Galle, Ella, Negombo, etc.
4. **Offline and Network Resilience:** Seamless fallback to cached routes or deterministic offline routing if internet connection degrades.
5. **Cost and Licensing:** Clear commercial terms, predictable request pricing, and generous free/development tiers.

---

## 3. Technology Evaluation and Decisions

### 3.1 Map Tile Provider: MapTiler Cloud (Primary)
- **Selected Provider:** **MapTiler Cloud** (Streets-v2 and Outdoor styles).
- **Rationale:**
  - Existing project decision (`OQ-018`) already provisioned `VITE_MAPTILER_KEY` environment variables.
  - Native MapLibre vector style specification compliance (`https://api.maptiler.com/maps/streets-v2/style.json?key=...`).
  - High-performance global CDN with detailed OpenStreetMap data for Sri Lanka.
- **Attribution:** Requires `© MapTiler © OpenStreetMap contributors` attribution displayed on map viewports.
- **Fallback:** Standard OpenStreetMap raster tile server (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) if `MAPTILER_KEY` is not provisioned.

---

### 3.2 Web Map Rendering: MapLibre GL & Leaflet Vector Engine
- **Web (`apps/web`):**
  - Interactive map container with dynamic zoom, pan, marker clustering, and GeoJSON route line rendering.
  - Smooth camera transitions (`fitBounds` to route or location clusters).
  - High responsiveness across mobile browsers, tablets, and desktop displays.
  - Fully testable in Vitest and Playwright E2E without requiring hardware-accelerated GPU in headless CI runners.

---

### 3.3 Mobile Map Rendering (`apps/mobile`): Cross-Platform Interactive Map Engine
- **Mobile (`apps/mobile`):**
  - **Constraint:** React Native 0.88.1 / React 19.3.0 with the New Architecture enabled by default in Expo SDK 58. Heavy native map wrappers (such as unmaintained native forks) frequently break `expo export` or require custom native dev-clients incompatible with standard web/mobile CI pipelines.
  - **Selected Approach:** High-performance cross-platform interactive map component utilizing vector tile rendering with touch gestures, smooth pan/zoom, interactive marker pins, and dynamic route polylines.
  - **Benefits:**
    - Identical behavioral parity across iOS, Android, and Expo Mobile Web (`Platform.OS === 'web'`).
    - 100% CI export compatibility with zero native compile errors.
    - Zero dependency on external binary pods or ndk compilation.

---

### 3.4 Routing & Directions Engine: MapTiler Routing API v2 + Sandbox Adapter
- **Selected API:** **MapTiler Routing API v2** (`https://api.maptiler.com/routing/v2/route`).
- **Profiles Supported:**
  1. `walking` (pedestrian paths, alleys, sidewalks — default for urban luggage drop-off).
  2. `driving` (automobile transit roads, parking access).
  3. `cycling` (bicycle paths and secondary roads).
- **Backend Architecture (`apps/api`):**
  - All routing requests pass through the backend: `POST /api/v1/maps/routes`.
  - Client frontends NEVER call MapTiler with private API secrets.
  - Fastify service implements `RoutingService` with two pluggable adapters:
    1. `MapTilerRoutingAdapter`: Active in production/staging when `MAPTILER_API_KEY` is configured.
    2. `SandboxRoutingAdapter`: Active in development, CI, and test environments. Generates deterministic, geographically accurate route polylines and turn maneuvers using Haversine interpolation and realistic transit geometry.
- **Features:**
  - Full maneuver step instructions (`TURN_LEFT`, `TURN_RIGHT`, `CONTINUE`, `ARRIVE`, etc.).
  - Total distance (meters) and duration (seconds).
  - Encoded / GeoJSON coordinate polyline arrays `[longitude, latitude]`.

---

### 3.5 Geocoding & Address Autocomplete: MapTiler Geocoding API + PostGIS Fallback
- **Selected API:** **MapTiler Geocoding API** (`/geocoding/`).
- **Endpoint:** `GET /api/v1/maps/geocoding?query=...` and `GET /api/v1/maps/reverse-geocoding?lat=...&lng=...`.
- **Backend Architecture:**
  - Debounced address query resolution with bounding box bias to Sri Lanka (`[79.65, 5.90, 81.90, 9.85]`).
  - Cache layer for frequent place lookups (e.g. "Colombo Fort Station", "Galle Face", "Bandaranaike International Airport").
  - PostGIS reverse-geocoding fallback: matches coordinates to existing verified storage locations and city centroids.

---

### 3.6 Mobile Turn-by-Turn In-App Navigation Engine
- **In-App Navigation Screen:** `apps/mobile/app/(traveller)/navigation.tsx`.
- **Navigation State Machine:**
  - States: `IDLE` -> `CALCULATING_ROUTE` -> `NAVIGATING` -> `OFF_ROUTE` -> `REROUTING` -> `ARRIVED` -> `ENDED`.
- **Live Location Tracking:**
  - High-accuracy foreground GPS tracking via cross-platform geolocation watch stream.
  - Zero background battery drain: tracking automatically terminates when the user exits the navigation screen or taps "End Navigation".
- **Rerouting & Deviation Threshold:**
  - Calculates perpendicular cross-track distance from user position to current route segment.
  - If user is > 40 meters off-route for 2 consecutive location updates (debounced by 3 seconds), triggers automatic reroute recalculation.
- **Arrival Detection:**
  - If user distance to destination is < 25 meters, triggers `ARRIVED` state.
  - Automatically displays "You have arrived at your luggage storage location!" with direct action button to view Digital Custody Pass (`/pass`).
- **Voice Guidance (Audio Announcements):**
  - Web: `window.speechSynthesis` / `SpeechSynthesisUtterance`.
  - Mobile: Synthesized audio announcements for upcoming maneuvers at 100m, 30m, and turn execution.
  - User can toggle voice guidance mute at any time.

---

### 3.7 External Navigation Secondary Fallback
- In-app navigation is always the primary action.
- A secondary action button ("Open in External Navigation App") remains available on route preview and active navigation screens:
  - **Android:** `geo:0,0?q=lat,lng(Label)` or `google.navigation:q=lat,lng&mode=w`.
  - **iOS:** `maps://?daddr=lat,lng&dirflg=w`.
  - **Web / Fallback:** `https://www.google.com/maps/dir/?api=1&destination=lat,lng&travelmode=walking`.

---

## 4. Summary Matrix

| Capability | Selection | Primary Protocol | Offline / Sandbox Support |
| :--- | :--- | :--- | :--- |
| **Tile Engine** | MapTiler Cloud + OSM | Vector & Raster HTTP(S) | Cached tiles + OSM fallback |
| **Routing** | MapTiler Routing v2 | Server-side REST | `SandboxRoutingAdapter` (Deterministic geometry) |
| **Geocoding** | MapTiler Geocoding | Server-side REST | PostGIS city/district directory |
| **Web Map** | Interactive Vector Map | WebGL / Canvas / SVG | Full offline mock & Vitest/Playwright compatibility |
| **Mobile Map** | Cross-Platform Vector Map | React Native SVG / Canvas | 100% Expo New Architecture & CI export compatible |
| **Mobile Navigation** | Custom In-App HUD | Foreground GPS Stream | Step simulation & offline route lock |
| **Audio Guidance** | Web Speech API / TTS | System Audio Synthesis | Fully client-side (no network needed) |

