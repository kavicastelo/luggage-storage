import type {
  GeocodingQuery,
  GeocodingResponse,
  GeocodingResult,
  GeographicCoordinate,
  ReverseGeocodingQuery,
  RouteAlternative,
  RouteLeg,
  RouteManeuver,
  RouteManeuverType,
  RouteRequest,
  RouteResult,
  RouteStep,
  TravelMode
} from "@luggage-storage/contracts";
import type { GeocodingPort, RoutingPort } from "./routing.port.js";
import { SandboxRoutingAdapter } from "./sandbox-routing.adapter.js";

interface MapTilerManeuverRaw {
  type?: string;
  modifier?: string;
  instruction?: string;
  location?: [number, number]; // [lng, lat]
}

interface MapTilerStepRaw {
  distance?: number;
  duration?: number;
  name?: string;
  maneuver?: MapTilerManeuverRaw;
  geometry?: {
    coordinates?: Array<[number, number]>;
  };
}

interface MapTilerLegRaw {
  distance?: number;
  duration?: number;
  steps?: MapTilerStepRaw[];
}

interface MapTilerRouteRaw {
  distance?: number;
  duration?: number;
  geometry?: {
    coordinates?: Array<[number, number]>;
  };
  legs?: MapTilerLegRaw[];
}

interface MapTilerResponseRaw {
  routes?: MapTilerRouteRaw[];
  error?: string;
  message?: string;
}

const MAPTILER_MODE_MAP: Record<TravelMode, string> = {
  walking: "pedestrian",
  driving: "car",
  cycling: "bicycle"
};

export class MapTilerRoutingAdapter implements RoutingPort, GeocodingPort {
  readonly providerName = "maptiler";
  private readonly sandbox = new SandboxRoutingAdapter();

  constructor(private readonly apiKey?: string) {}

  async calculateRoute(request: RouteRequest): Promise<RouteResult> {
    if (!this.apiKey) {
      return this.sandbox.calculateRoute(request);
    }

    try {
      const mode = MAPTILER_MODE_MAP[request.travelMode] || "pedestrian";
      const coords = `${request.origin.longitude},${request.origin.latitude};${request.destination.longitude},${request.destination.latitude}`;
      const url = `https://api.maptiler.com/routing/v2/route/${coords}?key=${encodeURIComponent(
        this.apiKey
      )}&profile=${mode}&geometries=geojson&steps=true&alternatives=${request.alternatives ? "true" : "false"}`;

      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        return this.sandbox.calculateRoute(request);
      }

      const data = (await res.json()) as MapTilerResponseRaw;
      if (!data.routes || data.routes.length === 0) {
        return this.sandbox.calculateRoute(request);
      }

      const primary = data.routes[0];
      const geometry: GeographicCoordinate[] = (primary.geometry?.coordinates || []).map(
        ([lng, lat]) => ({ latitude: lat, longitude: lng })
      );

      const legs: RouteLeg[] = (primary.legs || []).map((leg) => {
        const steps: RouteStep[] = (leg.steps || []).map((step, idx) => {
          const maneuverType = this.mapManeuverType(step.maneuver?.type, step.maneuver?.modifier);
          const maneuverLocation: GeographicCoordinate = step.maneuver?.location
            ? { latitude: step.maneuver.location[1], longitude: step.maneuver.location[0] }
            : request.origin;

          const maneuver: RouteManeuver = {
            type: maneuverType,
            instruction: step.maneuver?.instruction || step.name || "Proceed",
            distanceMeters: Math.round(step.distance || 0),
            durationSeconds: Math.round(step.duration || 0),
            location: maneuverLocation,
            modifier: step.maneuver?.modifier
          };

          return {
            index: idx,
            instruction: maneuver.instruction,
            distanceMeters: Math.round(step.distance || 0),
            durationSeconds: Math.round(step.duration || 0),
            maneuver,
            geometry: step.geometry?.coordinates?.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
          };
        });

        return {
          distanceMeters: Math.round(leg.distance || 0),
          durationSeconds: Math.round(leg.duration || 0),
          steps,
          startLocation: request.origin,
          endLocation: request.destination
        };
      });

      const alternatives: RouteAlternative[] = data.routes.slice(1).map((alt, idx) => ({
        id: `alt-${idx + 1}`,
        summary: `Alternative route ${idx + 1}`,
        distanceMeters: Math.round(alt.distance || 0),
        durationSeconds: Math.round(alt.duration || 0),
        geometry: (alt.geometry?.coordinates || []).map(([lng, lat]) => ({
          latitude: lat,
          longitude: lng
        }))
      }));

      return {
        routeId: `maptiler-${Date.now()}`,
        travelMode: request.travelMode,
        distanceMeters: Math.round(primary.distance || 0),
        durationSeconds: Math.round(primary.duration || 0),
        geometry: geometry.length > 0 ? geometry : [request.origin, request.destination],
        legs,
        alternatives,
        provider: "maptiler",
        summary: `MapTiler ${request.travelMode} route (${Math.round((primary.distance || 0) / 100) / 10} km)`
      };
    } catch {
      return this.sandbox.calculateRoute(request);
    }
  }

  async searchPlaces(query: GeocodingQuery): Promise<GeocodingResponse> {
    if (!this.apiKey) {
      return this.sandbox.searchPlaces(query);
    }

    try {
      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query.query)}.json?key=${encodeURIComponent(
        this.apiKey
      )}&limit=${query.limit}&country=lk`;

      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        return this.sandbox.searchPlaces(query);
      }

      const data = (await res.json()) as {
        features?: Array<{
          id: string;
          place_name: string;
          text: string;
          center: [number, number]; // [lng, lat]
          relevance?: number;
          context?: Array<{ id: string; text: string }>;
        }>;
      };

      if (!data.features || data.features.length === 0) {
        return this.sandbox.searchPlaces(query);
      }

      const results: GeocodingResult[] = data.features.map((f) => {
        const cityContext = f.context?.find((c) => c.id.startsWith("place.") || c.id.startsWith("municipality."));
        return {
          id: f.id,
          placeName: f.text,
          address: f.place_name,
          city: cityContext?.text,
          coordinate: { latitude: f.center[1], longitude: f.center[0] },
          relevance: f.relevance
        };
      });

      return { results };
    } catch {
      return this.sandbox.searchPlaces(query);
    }
  }

  async reverseGeocode(query: ReverseGeocodingQuery): Promise<GeocodingResult | null> {
    if (!this.apiKey) {
      return this.sandbox.reverseGeocode(query);
    }

    try {
      const url = `https://api.maptiler.com/geocoding/${query.longitude},${query.latitude}.json?key=${encodeURIComponent(
        this.apiKey
      )}&limit=1`;

      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        return this.sandbox.reverseGeocode(query);
      }

      const data = (await res.json()) as {
        features?: Array<{
          id: string;
          place_name: string;
          text: string;
          center: [number, number];
          relevance?: number;
          context?: Array<{ id: string; text: string }>;
        }>;
      };

      if (!data.features || data.features.length === 0) {
        return this.sandbox.reverseGeocode(query);
      }

      const f = data.features[0];
      const cityContext = f.context?.find((c) => c.id.startsWith("place.") || c.id.startsWith("municipality."));
      return {
        id: f.id,
        placeName: f.text,
        address: f.place_name,
        city: cityContext?.text,
        coordinate: { latitude: f.center[1], longitude: f.center[0] },
        relevance: f.relevance
      };
    } catch {
      return this.sandbox.reverseGeocode(query);
    }
  }

  private mapManeuverType(type?: string, modifier?: string): RouteManeuverType {
    if (!type) return "CONTINUE";
    const t = type.toLowerCase();
    const m = (modifier || "").toLowerCase();

    if (t === "depart") return "DEPART";
    if (t === "arrive") return "ARRIVE";
    if (t === "turn" || t === "end of road") {
      if (m.includes("left")) return "TURN_LEFT";
      if (m.includes("right")) return "TURN_RIGHT";
      if (m.includes("uturn")) return "U_TURN";
    }
    if (t === "fork" || t === "new name") {
      if (m.includes("left")) return "SLIGHT_LEFT";
      if (m.includes("right")) return "SLIGHT_RIGHT";
    }
    if (t === "roundabout" || t === "rotary") return "ROUNDABOUT";
    return "CONTINUE";
  }
}

