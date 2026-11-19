import { describe, it, expect } from "vitest";
import {
  GeographicCoordinateSchema,
  MapViewportSchema,
  MapMarkerSchema,
  RouteRequestSchema,
  RouteResultSchema,
  GeocodingQuerySchema,
  ReverseGeocodingQuerySchema,
  NavigationSessionSchema
} from "../src/maps/index.js";

describe("Maps & Navigation Contracts", () => {
  it("validates geographic coordinates", () => {
    const validCoord = { latitude: 6.9271, longitude: 79.8612 };
    expect(GeographicCoordinateSchema.parse(validCoord)).toEqual(validCoord);

    // Invalid latitude (> 90)
    expect(() => GeographicCoordinateSchema.parse({ latitude: 95, longitude: 79.8612 })).toThrow();
    // Invalid longitude (< -180)
    expect(() => GeographicCoordinateSchema.parse({ latitude: 6.9271, longitude: -185 })).toThrow();
  });

  it("validates map viewport", () => {
    const viewport = {
      center: { latitude: 7.8731, longitude: 80.7718 },
      zoom: 12,
      bounds: {
        minLat: 6.0,
        maxLat: 8.0,
        minLng: 79.0,
        maxLng: 81.0
      }
    };
    expect(MapViewportSchema.parse(viewport)).toEqual(viewport);
  });

  it("validates map markers", () => {
    const marker = {
      id: "loc-123",
      coordinate: { latitude: 6.9271, longitude: 79.8612 },
      title: "Colombo Fort Station Storage",
      subtitle: "Open 24/7",
      priceLabel: "LKR 750 / day",
      isSelected: true
    };
    expect(MapMarkerSchema.parse(marker)).toEqual(marker);
  });

  it("validates route request and defaults travelMode to walking", () => {
    const rawReq = {
      origin: { latitude: 6.9271, longitude: 79.8612 },
      destination: { latitude: 6.9344, longitude: 79.8428 }
    };
    const parsed = RouteRequestSchema.parse(rawReq);
    expect(parsed.travelMode).toBe("walking");
    expect(parsed.alternatives).toBe(false);
  });

  it("validates complete route result with steps and maneuvers", () => {
    const route = {
      routeId: "route-abc-123",
      travelMode: "walking" as const,
      distanceMeters: 1450,
      durationSeconds: 1100,
      geometry: [
        { latitude: 6.9271, longitude: 79.8612 },
        { latitude: 6.929, longitude: 79.855 },
        { latitude: 6.9344, longitude: 79.8428 }
      ],
      legs: [
        {
          distanceMeters: 1450,
          durationSeconds: 1100,
          startLocation: { latitude: 6.9271, longitude: 79.8612 },
          endLocation: { latitude: 6.9344, longitude: 79.8428 },
          steps: [
            {
              index: 0,
              instruction: "Head west toward Main St",
              distanceMeters: 450,
              durationSeconds: 340,
              maneuver: {
                type: "DEPART" as const,
                instruction: "Head west on Olcott Mawatha",
                distanceMeters: 450,
                durationSeconds: 340,
                location: { latitude: 6.9271, longitude: 79.8612 }
              }
            },
            {
              index: 1,
              instruction: "Turn right onto York St",
              distanceMeters: 1000,
              durationSeconds: 760,
              maneuver: {
                type: "TURN_RIGHT" as const,
                instruction: "Turn right onto York St",
                distanceMeters: 1000,
                durationSeconds: 760,
                location: { latitude: 6.929, longitude: 79.855 }
              }
            }
          ]
        }
      ],
      alternatives: [],
      provider: "maptiler"
    };

    const parsed = RouteResultSchema.parse(route);
    expect(parsed.routeId).toBe("route-abc-123");
    expect(parsed.legs[0].steps).toHaveLength(2);
    expect(parsed.legs[0].steps[1].maneuver.type).toBe("TURN_RIGHT");
  });

  it("validates geocoding and reverse geocoding queries", () => {
    const query = GeocodingQuerySchema.parse({ query: " Colombo Fort ", limit: "3" });
    expect(query.query).toBe("Colombo Fort");
    expect(query.limit).toBe(3);

    const revQuery = ReverseGeocodingQuerySchema.parse({ latitude: "6.9271", longitude: "79.8612" });
    expect(revQuery.latitude).toBe(6.9271);
    expect(revQuery.longitude).toBe(79.8612);
  });

  it("validates navigation session schema", () => {
    const session = {
      id: "11111111-1111-4111-8111-111111111111",
      destinationTitle: "Galle Fort Hub",
      destinationCoordinate: { latitude: 6.0328, longitude: 80.217 },
      travelMode: "walking" as const,
      state: "NAVIGATING" as const,
      currentStepIndex: 1,
      remainingDistanceMeters: 850,
      remainingDurationSeconds: 620,
      isVoiceMuted: false
    };
    expect(NavigationSessionSchema.parse(session)).toEqual(session);
  });
});
