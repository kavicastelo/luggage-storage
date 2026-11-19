import type {
  GeocodingQuery,
  GeocodingResponse,
  GeocodingResult,
  ReverseGeocodingQuery,
  RouteRequest,
  RouteResult
} from "@luggage-storage/contracts";
import { env } from "../../config/env.js";
import { MapTilerRoutingAdapter } from "./maptiler-routing.adapter.js";
import type { GeocodingPort, RoutingPort } from "./routing.port.js";
import { SandboxRoutingAdapter } from "./sandbox-routing.adapter.js";

export class MapsService {
  private readonly routingAdapter: RoutingPort;
  private readonly geocodingAdapter: GeocodingPort;

  constructor(configOverride?: { NODE_ENV?: string; APP_ENV?: string; MAPS_PROVIDER?: string; MAPTILER_API_KEY?: string }) {
    const activeEnv = configOverride ?? env;
    const isProduction =
      activeEnv.APP_ENV === "production" || (!activeEnv.APP_ENV && activeEnv.NODE_ENV === "production");
    if (activeEnv.MAPS_PROVIDER === "maptiler" && activeEnv.MAPTILER_API_KEY) {
      const maptiler = new MapTilerRoutingAdapter(activeEnv.MAPTILER_API_KEY);
      this.routingAdapter = maptiler;
      this.geocodingAdapter = maptiler;
    } else {
      if (isProduction) {
        throw new Error(
          "MAPS_PROVIDER_INVALID: In production, MAPS_PROVIDER must be 'maptiler' with a valid MAPTILER_API_KEY. Synthetic sandbox routing is strictly prohibited."
        );
      }
      const sandbox = new SandboxRoutingAdapter();
      this.routingAdapter = sandbox;
      this.geocodingAdapter = sandbox;
    }
  }

  async calculateRoute(request: RouteRequest): Promise<RouteResult> {
    return this.routingAdapter.calculateRoute(request);
  }

  async searchPlaces(query: GeocodingQuery): Promise<GeocodingResponse> {
    return this.geocodingAdapter.searchPlaces(query);
  }

  async reverseGeocode(query: ReverseGeocodingQuery): Promise<GeocodingResult | null> {
    return this.geocodingAdapter.reverseGeocode(query);
  }
}

export const mapsService = new MapsService();

