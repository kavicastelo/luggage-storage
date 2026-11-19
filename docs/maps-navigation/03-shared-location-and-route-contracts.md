# Shared Location and Route Contracts

**Initiative:** Cross-Platform Mapping & Navigation Transformation  
**Branch:** `feature/in-app-maps-navigation`  
**Date:** 2026-11-19  
**Status:** Approved  
**Package:** `@luggage-storage/contracts` (`src/maps/index.ts`)

---

## 1. Overview

To prevent coordinate confusion, vendor lock-in, and mismatched payloads across Web (`apps/web`), Mobile (`apps/mobile`), and Backend (`apps/api`), all mapping, routing, geocoding, and navigation models are centralized in `@luggage-storage/contracts`.

---

## 2. Coordinate System and Invariant Standards

### 2.1 The Coordinate Ordering Standard
A critical source of bugs in geospatial applications is swapping latitude and longitude. The repository enforces explicit standards:

1. **Object Representation (Domain / API):**
   ```ts
   export interface GeographicCoordinate {
     latitude: number;   // Range: -90 to 90
     longitude: number;  // Range: -180 to 180
   }
   ```
2. **GeoJSON Standard (RFC 7946):**
   When encoding coordinates as arrays for vector polylines or PostGIS `geometry`, the order is **`[longitude, latitude]`**:
   ```ts
   type GeoJsonPoint = [number, number]; // [lng, lat]
   ```
3. **Database Representation (PostGIS):**
   PostGIS functions use `ST_MakePoint(longitude, latitude)` with SRID 4326.

---

## 3. Contract Definitions

### 3.1 Geographic Coordinate and Viewport
```ts
export const GeographicCoordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

export const MapBoundsSchema = z.object({
  minLat: z.number().min(-90).max(90),
  maxLat: z.number().min(-90).max(90),
  minLng: z.number().min(-180).max(180),
  maxLng: z.number().min(-180).max(180)
});

export const MapViewportSchema = z.object({
  center: GeographicCoordinateSchema,
  zoom: z.number().min(0).max(22),
  bounds: MapBoundsSchema.optional()
});
```

### 3.2 Route Request & Response
```ts
export const TRAVEL_MODES = ["walking", "driving", "cycling"] as const;

export const RouteRequestSchema = z.object({
  origin: GeographicCoordinateSchema,
  destination: GeographicCoordinateSchema,
  travelMode: TravelModeSchema.default("walking"),
  alternatives: z.boolean().default(false)
});

export const RouteManeuverSchema = z.object({
  type: RouteManeuverTypeSchema,
  instruction: z.string(),
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  location: GeographicCoordinateSchema,
  modifier: z.string().optional()
});

export const RouteStepSchema = z.object({
  index: z.number().int().nonnegative(),
  instruction: z.string(),
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  maneuver: RouteManeuverSchema,
  geometry: z.array(GeographicCoordinateSchema).optional()
});

export const RouteResultSchema = z.object({
  routeId: z.string(),
  travelMode: TravelModeSchema,
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  geometry: z.array(GeographicCoordinateSchema),
  legs: z.array(RouteLegSchema),
  alternatives: z.array(RouteAlternativeSchema).default([]),
  provider: z.string().optional(),
  summary: z.string().optional()
});
```

### 3.3 Geocoding Contracts
```ts
export const GeocodingQuerySchema = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().positive().max(10).default(5)
});

export const ReverseGeocodingQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180)
});

export const GeocodingResultSchema = z.object({
  id: z.string(),
  placeName: z.string(),
  address: z.string(),
  city: z.string().optional(),
  coordinate: GeographicCoordinateSchema,
  relevance: z.number().optional()
});
```

### 3.4 In-App Navigation State Machine
```ts
export const NAVIGATION_STATES = [
  "IDLE",
  "CALCULATING_ROUTE",
  "NAVIGATING",
  "OFF_ROUTE",
  "REROUTING",
  "ARRIVED",
  "ENDED"
] as const;

export const NavigationSessionSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
  destinationTitle: z.string(),
  destinationCoordinate: GeographicCoordinateSchema,
  travelMode: TravelModeSchema,
  state: NavigationStateSchema,
  currentStepIndex: z.number().int().nonnegative(),
  remainingDistanceMeters: z.number().nonnegative(),
  remainingDurationSeconds: z.number().nonnegative(),
  isVoiceMuted: z.boolean().default(false)
});
```

