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

  constructor() {
    if (env.MAPS_PROVIDER === "maptiler" && env.MAPTILER_API_KEY) {
      const maptiler = new MapTilerRoutingAdapter(env.MAPTILER_API_KEY);
      this.routingAdapter = maptiler;
      this.geocodingAdapter = maptiler;
    } else {
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

