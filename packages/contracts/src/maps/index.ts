import { z } from "zod";

// ============================================================================
// Geographic Coordinates & Viewport
// ============================================================================

export const GeographicCoordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});
export type GeographicCoordinate = z.infer<typeof GeographicCoordinateSchema>;

export const MapBoundsSchema = z.object({
  minLat: z.number().min(-90).max(90),
  maxLat: z.number().min(-90).max(90),
  minLng: z.number().min(-180).max(180),
  maxLng: z.number().min(-180).max(180)
});
export type MapBounds = z.infer<typeof MapBoundsSchema>;

export const MapViewportSchema = z.object({
  center: GeographicCoordinateSchema,
  zoom: z.number().min(0).max(22),
  bounds: MapBoundsSchema.optional()
});
export type MapViewport = z.infer<typeof MapViewportSchema>;

export const MapMarkerSchema = z.object({
  id: z.string(),
  coordinate: GeographicCoordinateSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  priceLabel: z.string().optional(),
  isSelected: z.boolean().optional(),
  category: z.string().optional()
});
export type MapMarker = z.infer<typeof MapMarkerSchema>;

// ============================================================================
// Transportation Modes & Maneuvers
// ============================================================================

export const TRAVEL_MODES = ["walking", "driving", "cycling"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];
export const TravelModeSchema = z.enum(TRAVEL_MODES);

export const ROUTE_MANEUVER_TYPES = [
  "DEPART",
  "CONTINUE",
  "TURN_LEFT",
  "TURN_RIGHT",
  "SLIGHT_LEFT",
  "SLIGHT_RIGHT",
  "SHARP_LEFT",
  "SHARP_RIGHT",
  "U_TURN",
  "ROUNDABOUT",
  "ARRIVE",
  "UNKNOWN"
] as const;
export type RouteManeuverType = (typeof ROUTE_MANEUVER_TYPES)[number];
export const RouteManeuverTypeSchema = z.enum(ROUTE_MANEUVER_TYPES);

export const RouteManeuverSchema = z.object({
  type: RouteManeuverTypeSchema,
  instruction: z.string(),
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  location: GeographicCoordinateSchema,
  modifier: z.string().optional()
});
export type RouteManeuver = z.infer<typeof RouteManeuverSchema>;

export const RouteStepSchema = z.object({
  index: z.number().int().nonnegative(),
  instruction: z.string(),
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  maneuver: RouteManeuverSchema,
  geometry: z.array(GeographicCoordinateSchema).optional()
});
export type RouteStep = z.infer<typeof RouteStepSchema>;

export const RouteLegSchema = z.object({
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  steps: z.array(RouteStepSchema),
  startLocation: GeographicCoordinateSchema,
  endLocation: GeographicCoordinateSchema
});
export type RouteLeg = z.infer<typeof RouteLegSchema>;

export const RouteAlternativeSchema = z.object({
  id: z.string(),
  summary: z.string().optional(),
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  geometry: z.array(GeographicCoordinateSchema),
  legs: z.array(RouteLegSchema).optional()
});
export type RouteAlternative = z.infer<typeof RouteAlternativeSchema>;

// ============================================================================
// Route Calculation API Contracts
// ============================================================================

export const RouteRequestSchema = z.object({
  origin: GeographicCoordinateSchema,
  destination: GeographicCoordinateSchema,
  travelMode: TravelModeSchema.default("walking"),
  alternatives: z.boolean().default(false)
});
export type RouteRequest = z.infer<typeof RouteRequestSchema>;

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
export type RouteResult = z.infer<typeof RouteResultSchema>;

// ============================================================================
// Geocoding API Contracts
// ============================================================================

export const GeocodingQuerySchema = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().positive().max(10).default(5)
});
export type GeocodingQuery = z.infer<typeof GeocodingQuerySchema>;

export const ReverseGeocodingQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180)
});
export type ReverseGeocodingQuery = z.infer<typeof ReverseGeocodingQuerySchema>;

export const GeocodingResultSchema = z.object({
  id: z.string(),
  placeName: z.string(),
  address: z.string(),
  city: z.string().optional(),
  coordinate: GeographicCoordinateSchema,
  relevance: z.number().optional()
});
export type GeocodingResult = z.infer<typeof GeocodingResultSchema>;

export const GeocodingResponseSchema = z.object({
  results: z.array(GeocodingResultSchema)
});
export type GeocodingResponse = z.infer<typeof GeocodingResponseSchema>;

// ============================================================================
// Navigation Session & State Machine
// ============================================================================

export const NAVIGATION_STATES = [
  "IDLE",
  "CALCULATING_ROUTE",
  "NAVIGATING",
  "OFF_ROUTE",
  "REROUTING",
  "ARRIVED",
  "ENDED"
] as const;
export type NavigationState = (typeof NAVIGATION_STATES)[number];
export const NavigationStateSchema = z.enum(NAVIGATION_STATES);

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
export type NavigationSession = z.infer<typeof NavigationSessionSchema>;

