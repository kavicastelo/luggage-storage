# Target Mapping Architecture

**Initiative:** Cross-Platform Mapping & Navigation Transformation  
**Branch:** `feature/in-app-maps-navigation`  
**Date:** 2026-11-19  
**Status:** Approved  
**Document ID:** `02-target-mapping-architecture`

---

## 1. System Topology

The target mapping and navigation architecture decouples map rendering, route calculation, geocoding, and mobile navigation into distinct layers connected by shared TypeScript domain contracts:

```text
                     +---------------------------------------+
                     |         PACKAGES / CONTRACTS          |
                     |  @luggage-storage/contracts/src/maps  |
                     +-------------------+-------------------+
                                         |
                +------------------------+------------------------+
                |                                                 |
                v                                                 v
+-------------------------------+               +---------------------------------+
|       APPS / API (FASTIFY)    |               |      CLIENT APPLICATIONS        |
|  - POST /api/v1/maps/routes   |               |  - apps/web (React + Vite)      |
|  - GET /api/v1/maps/geocoding |               |  - apps/mobile (Expo / RN)      |
+---------------+---------------+               +----------------+----------------+
                |                                                |
                | (Hexagonal Ports)                              | (Interactive UI & Engine)
                v                                                v
+-------------------------------+               +---------------------------------+
|     ROUTING & GEO SERVICES    |               |   IN-APP NAVIGATION ENGINE      |
|  - MapTilerRoutingAdapter     |               |  - Live GPS Watch Stream        |
|  - SandboxRoutingAdapter      |               |  - Cross-Track Deviation (>40m) |
|  - MapTilerGeocodingAdapter   |               |  - Dynamic Reroute Trigger      |
|  - PostGIS Proximity Service  |               |  - Arrival Detection (<25m)     |
+---------------+---------------+               |  - Maneuver HUD & TTS Voice     |
                |                               +----------------+----------------+
                v                                                |
+-------------------------------+                                v
|       POSTGRESQL 16           |               +---------------------------------+
|  - PostGIS 3.5 Spatials       |               |  SECONDARY EXTERNAL FALLBACK    |
|  - ST_DWithin / ST_Distance   |               |  - Native Maps Intent           |
|  - GiST spatial indexing      |               |  - Apple Maps / Google Maps     |
+-------------------------------+               +---------------------------------+
```

---

## 2. Core Architectural Principles

### 2.1 Complete Provider Independence
1. Neither the Web nor Mobile clients contain private MapTiler or routing secrets.
2. Route calculations are requested through the API gateway (`POST /api/v1/maps/routes`).
3. Switching routing providers from MapTiler to GraphHopper, OSRM, or Mapbox requires changing only the backend adapter implementation, with zero changes to client components.

### 2.2 Strict Location Privacy Compliance (`OQ-012`, `OQ-018`)
1. **Public Discovery:** Returns `coarseLatitude` and `coarseLongitude` (~100-300m randomized offset) and general neighborhood/city.
2. **Pre-Booking Route Preview:** Calculates route between user origin and the coarse coordinates, protecting the host's exact physical home/shop address prior to booking commitment.
3. **Confirmed Custody Navigation:** Once a booking is confirmed (`isCustodyUnlocked`), the API unlocks exact coordinates and building addresses to the authorized traveller. Navigation guides the traveller to the exact front door.

### 2.3 Single Source of Truth for Coordinates
- Coordinate objects strictly conform to:
  ```ts
  export interface GeographicCoordinate {
    latitude: number;
    longitude: number;
  }
  ```
- GeoJSON arrays are strictly `[longitude, latitude]` per the RFC 7946 GeoJSON standard, and are clearly converted via normalized adapter helpers (`toGeoJsonCoordinate` and `fromGeoJsonCoordinate`).

---

## 3. Component Breakdown

### 3.1 `packages/contracts/src/maps`
Exports Zod schemas and TypeScript interfaces:
- `GeographicCoordinateSchema`
- `MapViewportSchema`
- `MapMarkerSchema`
- `TravelModeSchema` (`walking` | `driving` | `cycling`)
- `RouteManeuverTypeSchema` (`CONTINUE`, `TURN_LEFT`, `TURN_RIGHT`, `SLIGHT_LEFT`, `SLIGHT_RIGHT`, `U_TURN`, `ARRIVE`, `DEPART`)
- `RouteStepSchema`
- `RouteLegSchema`
- `RouteRequestSchema`
- `RouteResultSchema`
- `NavigationSessionSchema`
- `GeocodingResultSchema`

### 3.2 `apps/api/src/modules/maps`
- `maps.routes.ts`: Exposes `/routes`, `/geocoding`, `/reverse-geocoding`.
- `maps.service.ts`: Orchestrates route calculation, geocoding lookups, caching, and rate limiting.
- `routing.port.ts`: Interface defining `calculateRoute(req: RouteRequest): Promise<RouteResult>`.
- `maptiler-routing.adapter.ts`: Calls MapTiler Routing API v2 using server API key.
- `sandbox-routing.adapter.ts`: Deterministic calculation using Haversine intermediate points, providing high realism in local development, offline runs, and CI test suites.

### 3.3 `apps/web/src/features/maps`
- `InteractiveDiscoveryMap.tsx`: Vector map with cluster markers, interactive pins, pan/zoom, and map/list synchronization.
- `RoutePreviewDrawer.tsx`: Route summary card with travel mode switcher (Walking / Driving / Cycling), total distance & ETA, turn-by-turn maneuver list, and external navigation button.

### 3.4 `apps/mobile/src/components/maps` & `apps/mobile/app/(traveller)/navigation.tsx`
- `InteractiveMobileMap.tsx`: Vector interactive map with location markers, user dot, route line, and fit-to-route bounds.
- `navigation.tsx`: Dedicated full-screen navigation HUD:
  - Top maneuver card with direction icon, next step text, and distance to turn.
  - Bottom summary sheet with ETA, remaining distance, voice mute toggle, and End Navigation button.
  - Active tracking hook with deviation detection and automatic rerouting.
  - Arrival modal with direct transition to Custody Pass.

