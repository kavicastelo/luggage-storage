import { randomUUID } from "node:crypto";
import type {
  GeocodingQuery,
  GeocodingResponse,
  GeocodingResult,
  GeographicCoordinate,
  ReverseGeocodingQuery,
  RouteAlternative,
  RouteLeg,
  RouteManeuver,
  RouteRequest,
  RouteResult,
  RouteStep,
  TravelMode
} from "@luggage-storage/contracts";
import type { GeocodingPort, RoutingPort } from "./routing.port.js";

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function calculateHaversineDistanceMeters(
  start: GeographicCoordinate,
  end: GeographicCoordinate
): number {
  const dLat = toRadians(end.latitude - start.latitude);
  const dLng = toRadians(end.longitude - start.longitude);
  const lat1 = toRadians(start.latitude);
  const lat2 = toRadians(end.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

const SPEED_METERS_PER_SECOND: Record<TravelMode, number> = {
  walking: 1.3, // ~4.7 km/h
  cycling: 4.2, // ~15 km/h
  driving: 8.3  // ~30 km/h (urban average)
};

const SRI_LANKA_PRESET_PLACES: Array<{
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
}> = [
  {
    id: "lk-cmb-fort",
    name: "Colombo Fort Railway Station",
    address: "Olcott Mawatha, Colombo 01",
    city: "Colombo",
    lat: 6.9344,
    lng: 79.8519
  },
  {
    id: "lk-cmb-galleface",
    name: "Galle Face Green",
    address: "Galle Road, Colombo 03",
    city: "Colombo",
    lat: 6.9271,
    lng: 79.8458
  },
  {
    id: "lk-cmb-airport",
    name: "Bandaranaike International Airport (CMB)",
    address: "Canada Friendship Road, Katunayake",
    city: "Negombo",
    lat: 7.1808,
    lng: 79.8841
  },
  {
    id: "lk-kdy-temple",
    name: "Temple of the Sacred Tooth Relic",
    address: "Sri Dalada Veediya, Kandy",
    city: "Kandy",
    lat: 7.2936,
    lng: 80.6413
  },
  {
    id: "lk-gle-fort",
    name: "Galle Dutch Fort",
    address: "Church Street, Galle Fort",
    city: "Galle",
    lat: 6.0269,
    lng: 80.217
  },
  {
    id: "lk-ela-station",
    name: "Ella Railway Station",
    address: "Wellawaya-Ella-Kumbalwela Highway, Ella",
    city: "Ella",
    lat: 6.8667,
    lng: 81.0466
  },
  {
    id: "lk-ngb-beach",
    name: "Negombo Beach Park",
    address: "Porutota Road, Negombo",
    city: "Negombo",
    lat: 7.2341,
    lng: 79.8427
  }
];

export class SandboxRoutingAdapter implements RoutingPort, GeocodingPort {
  readonly providerName = "sandbox";

  async calculateRoute(request: RouteRequest): Promise<RouteResult> {
    const { origin, destination, travelMode = "walking", alternatives = false } = request;
    const directDistance = calculateHaversineDistanceMeters(origin, destination);

    // Urban street routing factor (~1.22x straight-line distance)
    const distanceMeters = Math.max(50, Math.round(directDistance * 1.22));
    const speed = SPEED_METERS_PER_SECOND[travelMode] || SPEED_METERS_PER_SECOND.walking;
    const durationSeconds = Math.max(30, Math.round(distanceMeters / speed));

    // Generate realistic multi-segment geometry with intermediate waypoint
    const midLat = (origin.latitude + destination.latitude) / 2;
    const midLng = (origin.longitude + destination.longitude) / 2;
    // Add small realistic street-angle offset to midpoint
    const deltaLat = (destination.latitude - origin.latitude) * 0.15;
    const deltaLng = -(destination.longitude - origin.longitude) * 0.15;

    const waypoint1: GeographicCoordinate = {
      latitude: Number((midLat + deltaLat).toFixed(6)),
      longitude: Number((midLng + deltaLng).toFixed(6))
    };

    const geometry: GeographicCoordinate[] = [
      { latitude: Number(origin.latitude.toFixed(6)), longitude: Number(origin.longitude.toFixed(6)) },
      waypoint1,
      { latitude: Number(destination.latitude.toFixed(6)), longitude: Number(destination.longitude.toFixed(6)) }
    ];

    const step1Dist = Math.round(distanceMeters * 0.45);
    const step2Dist = distanceMeters - step1Dist;
    const step1Dur = Math.round(durationSeconds * 0.45);
    const step2Dur = durationSeconds - step1Dur;

    const step1Maneuver: RouteManeuver = {
      type: "DEPART",
      instruction: `Head ${this.getBearingDirection(origin, waypoint1)} along transit corridor`,
      distanceMeters: step1Dist,
      durationSeconds: step1Dur,
      location: origin
    };

    const step2Maneuver: RouteManeuver = {
      type: destination.longitude > waypoint1.longitude ? "TURN_RIGHT" : "TURN_LEFT",
      instruction: `Turn ${destination.longitude > waypoint1.longitude ? "right" : "left"} toward storage facility`,
      distanceMeters: step2Dist,
      durationSeconds: step2Dur,
      location: waypoint1
    };

    const arriveManeuver: RouteManeuver = {
      type: "ARRIVE",
      instruction: "Arrive at luggage storage facility",
      distanceMeters: 0,
      durationSeconds: 0,
      location: destination
    };

    const steps: RouteStep[] = [
      {
        index: 0,
        instruction: step1Maneuver.instruction,
        distanceMeters: step1Dist,
        durationSeconds: step1Dur,
        maneuver: step1Maneuver,
        geometry: [origin, waypoint1]
      },
      {
        index: 1,
        instruction: step2Maneuver.instruction,
        distanceMeters: step2Dist,
        durationSeconds: step2Dur,
        maneuver: step2Maneuver,
        geometry: [waypoint1, destination]
      },
      {
        index: 2,
        instruction: arriveManeuver.instruction,
        distanceMeters: 0,
        durationSeconds: 0,
        maneuver: arriveManeuver,
        geometry: [destination]
      }
    ];

    const leg: RouteLeg = {
      distanceMeters,
      durationSeconds,
      startLocation: origin,
      endLocation: destination,
      steps
    };

    const altRoutes: RouteAlternative[] = [];
    if (alternatives) {
      const altDist = Math.round(distanceMeters * 1.12);
      const altDur = Math.round(durationSeconds * 1.15);
      const altMidLat = (origin.latitude + destination.latitude) / 2 - deltaLat;
      const altMidLng = (origin.longitude + destination.longitude) / 2 - deltaLng;
      altRoutes.push({
        id: `alt-${randomUUID().slice(0, 8)}`,
        summary: "Via coastal avenue alternative",
        distanceMeters: altDist,
        durationSeconds: altDur,
        geometry: [
          origin,
          { latitude: Number(altMidLat.toFixed(6)), longitude: Number(altMidLng.toFixed(6)) },
          destination
        ]
      });
    }

    return {
      routeId: `route-${randomUUID()}`,
      travelMode,
      distanceMeters,
      durationSeconds,
      geometry,
      legs: [leg],
      alternatives: altRoutes,
      provider: "sandbox",
      summary: `Standard ${travelMode} route (${Math.round(distanceMeters / 100) / 10} km)`
    };
  }

  async searchPlaces(query: GeocodingQuery): Promise<GeocodingResponse> {
    const rawSearch = query.query.toLowerCase().trim();
    const limit = query.limit || 5;

    const matched = SRI_LANKA_PRESET_PLACES.filter(
      (p) =>
        p.name.toLowerCase().includes(rawSearch) ||
        p.city.toLowerCase().includes(rawSearch) ||
        p.address.toLowerCase().includes(rawSearch)
    );

    const results: GeocodingResult[] = matched.slice(0, limit).map((p) => ({
      id: p.id,
      placeName: p.name,
      address: p.address,
      city: p.city,
      coordinate: { latitude: p.lat, longitude: p.lng },
      relevance: 1.0
    }));

    // If no direct preset matched, synthesize a localized result around Sri Lanka centroid
    if (results.length === 0) {
      results.push({
        id: `geo-${randomUUID().slice(0, 8)}`,
        placeName: query.query,
        address: `${query.query}, Western Province, Sri Lanka`,
        city: "Colombo",
        coordinate: { latitude: 6.9271, longitude: 79.8612 },
        relevance: 0.75
      });
    }

    return { results };
  }

  async reverseGeocode(query: ReverseGeocodingQuery): Promise<GeocodingResult | null> {
    const coord: GeographicCoordinate = { latitude: query.latitude, longitude: query.longitude };

    let closest = SRI_LANKA_PRESET_PLACES[0];
    let minDistance = calculateHaversineDistanceMeters(coord, {
      latitude: closest.lat,
      longitude: closest.lng
    });

    for (const place of SRI_LANKA_PRESET_PLACES) {
      const dist = calculateHaversineDistanceMeters(coord, {
        latitude: place.lat,
        longitude: place.lng
      });
      if (dist < minDistance) {
        minDistance = dist;
        closest = place;
      }
    }

    return {
      id: `rev-${closest.id}`,
      placeName: closest.name,
      address: closest.address,
      city: closest.city,
      coordinate: coord,
      relevance: minDistance < 500 ? 1.0 : 0.8
    };
  }

  private getBearingDirection(start: GeographicCoordinate, end: GeographicCoordinate): string {
    const dLat = end.latitude - start.latitude;
    const dLng = end.longitude - start.longitude;
    if (Math.abs(dLat) > Math.abs(dLng)) {
      return dLat > 0 ? "north" : "south";
    }
    return dLng > 0 ? "east" : "west";
  }
}

