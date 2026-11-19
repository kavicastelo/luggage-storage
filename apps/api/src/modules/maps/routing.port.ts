import type {
  GeocodingQuery,
  GeocodingResponse,
  GeocodingResult,
  ReverseGeocodingQuery,
  RouteRequest,
  RouteResult
} from "@luggage-storage/contracts";

export interface RoutingPort {
  readonly providerName: string;
  calculateRoute(request: RouteRequest): Promise<RouteResult>;
}

export interface GeocodingPort {
  readonly providerName: string;
  searchPlaces(query: GeocodingQuery): Promise<GeocodingResponse>;
  reverseGeocode(query: ReverseGeocodingQuery): Promise<GeocodingResult | null>;
}

