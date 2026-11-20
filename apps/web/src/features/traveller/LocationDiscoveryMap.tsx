import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  Compass,
  Navigation,
  Footprints,
  Car,
  Bike,
  Plus,
  Minus,
  Maximize2,
  X,
  ExternalLink,
  ChevronRight,
  Clock,
  Route as RouteIcon
} from "lucide-react";
import type { RouteResult, TravelMode } from "@luggage-storage/contracts";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { marketplaceApi } from "@/services/marketplace-api";

export interface DiscoveryMapPoint {
  id: string;
  name: string;
  city: string;
  approximateArea: string;
  approximateLatitude: number;
  approximateLongitude: number;
  priceLabel: string;
  bookingMode?: "INSTANT" | "HOST_APPROVAL" | string;
  href: string;
}

export interface LocationDiscoveryMapProps {
  locations: DiscoveryMapPoint[];
  selectedLocationId?: string | null;
  onSelectLocation?: (locationId: string) => void;
}

const SRI_LANKA_BOUNDS = {
  minLat: 5.9,
  maxLat: 9.85,
  minLng: 79.65,
  maxLng: 81.9
};

interface MapTileInfo {
  key: string;
  url: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}

function lng2tile(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

function tile2lng(x: number, zoom: number): number {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

function tile2lat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function computeBaseZoom(lngSpan: number): number {
  if (lngSpan > 2.0) return 8;
  if (lngSpan > 0.8) return 9;
  if (lngSpan > 0.3) return 11;
  if (lngSpan > 0.08) return 13;
  return 15;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} mins`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs} hr ${remMins > 0 ? `${remMins} min` : ""}`.trim();
}

export const LocationDiscoveryMap: React.FC<LocationDiscoveryMapProps> = ({
  locations,
  selectedLocationId,
  onSelectLocation
}) => {
  const mapTilerKey = (
    (import.meta.env.VITE_MAPTILER_KEY as string | undefined) ||
    (import.meta.env.VITE_MAPTILER_API_KEY as string | undefined)
  )?.trim();

  // Failed tiles cache to fallback gracefully to CARTO raster tiles
  const [failedTiles, setFailedTiles] = useState<Record<string, boolean>>({});

  // Map viewport state (zoom and center offset)
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Geolocation & Route Preview State
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [routePreviewOpen, setRoutePreviewOpen] = useState<boolean>(false);
  const [travelMode, setTravelMode] = useState<TravelMode>("walking");
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const validLocations = useMemo(
    () =>
      locations.filter(
        (loc) => Number.isFinite(loc.approximateLatitude) && Number.isFinite(loc.approximateLongitude)
      ),
    [locations]
  );

  const activePoint = useMemo(
    () => validLocations.find((loc) => loc.id === selectedLocationId) ?? null,
    [validLocations, selectedLocationId]
  );

  // Compute map bounds encompassing active locations or Sri Lanka default
  const bounds = useMemo(() => {
    const lats = validLocations.map((l) => l.approximateLatitude);
    const lngs = validLocations.map((l) => l.approximateLongitude);
    if (userLocation) {
      lats.push(userLocation.latitude);
      lngs.push(userLocation.longitude);
    }
    if (activeRoute) {
      for (const pt of activeRoute.geometry) {
        lats.push(pt.latitude);
        lngs.push(pt.longitude);
      }
    }

    const minLat = lats.length > 0 ? Math.min(...lats) : SRI_LANKA_BOUNDS.minLat;
    const maxLat = lats.length > 0 ? Math.max(...lats) : SRI_LANKA_BOUNDS.maxLat;
    const minLng = lngs.length > 0 ? Math.min(...lngs) : SRI_LANKA_BOUNDS.minLng;
    const maxLng = lngs.length > 0 ? Math.max(...lngs) : SRI_LANKA_BOUNDS.maxLng;

    const latSpan = Math.max(maxLat - minLat, 0.08);
    const lngSpan = Math.max(maxLng - minLng, 0.08);
    const padLat = latSpan * 0.15;
    const padLng = lngSpan * 0.15;

    return {
      minLat: minLat - padLat,
      maxLat: maxLat + padLat,
      minLng: minLng - padLng,
      maxLng: maxLng + padLng
    };
  }, [validLocations, userLocation, activeRoute]);

  const project = useCallback(
    (lat: number, lng: number) => {
      const xNorm = (lng - bounds.minLng) / (bounds.maxLng - bounds.minLng);
      const yNorm = 1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
      const xPct = Math.min(96, Math.max(4, xNorm * 100));
      const yPct = Math.min(94, Math.max(6, yNorm * 100));
      return { xPct, yPct };
    },
    [bounds]
  );

  // Explicit demo origin setter when GPS is unavailable
  const handleUseDemoOrigin = useCallback(() => {
    setUserLocation({ latitude: 6.9344, longitude: 79.8519 });
    setLocationWarning(null);
  }, []);

  // Request user GPS
  const handleLocateMe = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationWarning("Geolocation is not supported by your browser. You can use Colombo Hub as a demo starting location.");
      return;
    }
    setIsLocating(true);
    setLocationWarning(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
        setLocationWarning(null);
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        const isDenied = err.code === 1;
        setLocationWarning(
          isDenied
            ? "Location permission was denied. Tap 'Use Colombo Hub' to simulate a starting location, or allow access in your browser settings."
            : "Location lookup timed out. Tap 'Use Colombo Hub' to simulate a starting location."
        );
      },
      { timeout: 8000 }
    );
  }, []);

  // Request Route Calculation
  const handleCalculateRoute = useCallback(
    async (mode: TravelMode) => {
      if (!activePoint) return;
      const originCoord = userLocation ?? { latitude: 6.9344, longitude: 79.8519 };
      const destCoord = {
        latitude: activePoint.approximateLatitude,
        longitude: activePoint.approximateLongitude
      };

      setIsCalculatingRoute(true);
      setRouteError(null);
      try {
        const result = await marketplaceApi.calculateRoute({
          origin: originCoord,
          destination: destCoord,
          travelMode: mode,
          alternatives: false
        });
        setActiveRoute(result);
        setRoutePreviewOpen(true);
      } catch (err: unknown) {
        setRouteError(err instanceof Error ? err.message : "Unable to calculate route");
      } finally {
        setIsCalculatingRoute(false);
      }
    },
    [activePoint, userLocation]
  );

  // Recalculate if travel mode changes while route preview is active
  useEffect(() => {
    if (routePreviewOpen && activePoint) {
      void handleCalculateRoute(travelMode);
    }
  }, [travelMode, routePreviewOpen, activePoint, handleCalculateRoute]);

  // Compute dynamic slippy raster tiles for visible bounding box
  const visibleTiles = useMemo<MapTileInfo[]>(() => {
    const lngSpan = bounds.maxLng - bounds.minLng;
    const baseZoom = computeBaseZoom(lngSpan);
    const z = Math.min(16, Math.max(5, baseZoom + Math.round(zoomLevel - 1)));

    const minX = lng2tile(bounds.minLng, z);
    const maxX = lng2tile(bounds.maxLng, z);
    const minY = lat2tile(bounds.maxLat, z);
    const maxY = lat2tile(bounds.minLat, z);

    // Limit tile count defensively to prevent excessive network requests
    if ((maxX - minX + 1) * (maxY - minY + 1) > 64) {
      return [];
    }

    const tiles: MapTileInfo[] = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const key = `${z}/${x}/${y}`;
        const lngLeft = tile2lng(x, z);
        const lngRight = tile2lng(x + 1, z);
        const latTop = tile2lat(y, z);
        const latBottom = tile2lat(y + 1, z);

        const leftPct = ((lngLeft - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
        const topPct = ((bounds.maxLat - latTop) / (bounds.maxLat - bounds.minLat)) * 100;
        const widthPct = ((lngRight - lngLeft) / (bounds.maxLng - bounds.minLng)) * 100;
        const heightPct = ((latTop - latBottom) / (bounds.maxLat - bounds.minLat)) * 100;

        const sub = ["a", "b", "c"][(x + y) % 3];
        const isFailed = failedTiles[key];
        const primaryUrl = mapTilerKey
          ? `https://api.maptiler.com/maps/streets-v2/256/${z}/${x}/${y}.png?key=${encodeURIComponent(mapTilerKey)}`
          : `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;
        const fallbackUrl = `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;

        tiles.push({
          key,
          url: isFailed ? fallbackUrl : primaryUrl,
          leftPct,
          topPct,
          widthPct,
          heightPct
        });
      }
    }
    return tiles;
  }, [bounds, zoomLevel, mapTilerKey, failedTiles]);

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(2.5, z + 0.3));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.8, z - 0.3));
  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  // SVG route path string
  const routePathD = useMemo(() => {
    if (!activeRoute || activeRoute.geometry.length < 2) return "";
    return activeRoute.geometry
      .map((pt, i) => {
        const { xPct, yPct } = project(pt.latitude, pt.longitude);
        return `${i === 0 ? "M" : "L"} ${xPct} ${yPct}`;
      })
      .join(" ");
  }, [activeRoute, project]);

  return (
    <Card className="overflow-hidden border border-sand-200 bg-white shadow-sm flex flex-col">
      {/* Header bar */}
      <div className="px-4 py-3 bg-navy-900 text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-terracotta-400" />
          <h3 className="text-sm font-bold">Sri Lanka Transit Corridor Map</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="navy" size="sm">
            {validLocations.length} {validLocations.length === 1 ? "hub" : "hubs"}
          </Badge>
          <span className="text-[10px] text-sand-300">© MapTiler © OSM</span>
        </div>
      </div>

      {/* Map Canvas Container */}
      <div
        className="relative h-80 sm:h-96 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        role="region"
        aria-label="Interactive Luggage Storage Map"
      >
        {/* Slippy Tile Raster Map Layer */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${
              panOffset.y / zoomLevel
            }px)`,
            transition: isDragging ? "none" : "transform 0.2s ease-out"
          }}
        >
          {visibleTiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              loading="lazy"
              onError={() => {
                setFailedTiles((prev) => ({ ...prev, [tile.key]: true }));
              }}
              className="absolute select-none pointer-events-none"
              style={{
                left: `${tile.leftPct}%`,
                top: `${tile.topPct}%`,
                width: `${tile.widthPct}%`,
                height: `${tile.heightPct}%`,
                objectFit: "fill",
                opacity: 0.88
              }}
            />
          ))}
          {/* Subtle translucent dark tint to enhance marker contrast */}
          <div className="absolute inset-0 bg-navy-950/20 pointer-events-none" />
        </div>

        {/* Vector SVG Layer for Grid, Route Polyline, and Connectors */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${
              panOffset.y / zoomLevel
            }px)`,
            transition: isDragging ? "none" : "transform 0.2s ease-out"
          }}
        >
          {/* Subtle grid lines */}
          <line x1="25" y1="0" x2="25" y2="100" stroke="#334155" strokeWidth="0.25" strokeDasharray="1 2" opacity="0.3" />
          <line x1="50" y1="0" x2="50" y2="100" stroke="#334155" strokeWidth="0.25" strokeDasharray="1 2" opacity="0.3" />
          <line x1="75" y1="0" x2="75" y2="100" stroke="#334155" strokeWidth="0.25" strokeDasharray="1 2" opacity="0.3" />
          <line x1="0" y1="33" x2="100" y2="33" stroke="#334155" strokeWidth="0.25" strokeDasharray="1 2" opacity="0.3" />
          <line x1="0" y1="66" x2="100" y2="66" stroke="#334155" strokeWidth="0.25" strokeDasharray="1 2" opacity="0.3" />

          {/* Active Navigation Route Polyline */}
          {routePathD && (
            <>
              {/* Outer glow */}
              <path d={routePathD} fill="none" stroke="#FF5A36" strokeWidth="2.5" opacity="0.4" strokeLinecap="round" strokeLinejoin="round" />
              {/* Core solid path */}
              <path d={routePathD} fill="none" stroke="#E05D38" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}

          {/* User Location Pulse Ring */}
          {userLocation && (
            <circle
              cx={project(userLocation.latitude, userLocation.longitude).xPct}
              cy={project(userLocation.latitude, userLocation.longitude).yPct}
              r="2.5"
              fill="none"
              stroke="#0EA5E9"
              strokeWidth="0.6"
              opacity="0.8"
            />
          )}
        </svg>

        {/* Floating Map Controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-20">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="Zoom in"
            className="h-8 w-8 rounded-lg bg-navy-900/90 text-white hover:bg-navy-800 border border-sand-400/30 flex items-center justify-center shadow-md transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="Zoom out"
            className="h-8 w-8 rounded-lg bg-navy-900/90 text-white hover:bg-navy-800 border border-sand-400/30 flex items-center justify-center shadow-md transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleResetView}
            aria-label="Reset map view"
            className="h-8 w-8 rounded-lg bg-navy-900/90 text-white hover:bg-navy-800 border border-sand-400/30 flex items-center justify-center shadow-md transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocating}
            aria-label="Find my current location"
            className={`h-8 w-8 rounded-lg ${
              userLocation ? "bg-teal-600 text-white" : "bg-navy-900/90 text-white hover:bg-navy-800"
            } border border-sand-400/30 flex items-center justify-center shadow-md transition-colors`}
          >
            <Navigation className={`h-3.5 w-3.5 ${isLocating ? "animate-spin text-terracotta-400" : ""}`} />
          </button>
        </div>

        {/* Interactive Location Markers Overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${
              panOffset.y / zoomLevel
            }px)`,
            transition: isDragging ? "none" : "transform 0.2s ease-out"
          }}
        >
          {validLocations.map((loc) => {
            const { xPct, yPct } = project(loc.approximateLatitude, loc.approximateLongitude);
            const isSelected = loc.id === selectedLocationId;

            return (
              <div
                key={loc.id}
                style={{ left: `${xPct}%`, top: `${yPct}%` }}
                className="absolute -translate-x-1/2 -translate-y-full pointer-events-auto"
              >
                <button
                  type="button"
                  onClick={() => onSelectLocation?.(loc.id)}
                  aria-label={`${loc.name} in ${loc.city}, ${loc.priceLabel}`}
                  className={`group relative flex flex-col items-center focus:outline-none transition-transform ${
                    isSelected ? "scale-110 z-30" : "hover:scale-105 z-10"
                  }`}
                >
                  {/* Price Tag Pill */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold whitespace-nowrap shadow-md border ${
                      isSelected
                        ? "bg-terracotta-500 text-white border-terracotta-400 ring-2 ring-white"
                        : "bg-navy-900 text-sand-100 border-sand-500/40 group-hover:bg-navy-800"
                    }`}
                  >
                    {loc.priceLabel}
                  </span>

                  {/* Marker Pin Icon */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shadow-lg -mt-1 border-2 ${
                      isSelected
                        ? "bg-terracotta-600 border-white text-white"
                        : "bg-navy-950 border-sand-400 text-terracotta-400"
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                  </div>
                </button>
              </div>
            );
          })}

          {/* User Location Dot */}
          {userLocation && (
            <div
              style={{
                left: `${project(userLocation.latitude, userLocation.longitude).xPct}%`,
                top: `${project(userLocation.latitude, userLocation.longitude).yPct}%`
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
            >
              <div className="w-3.5 h-3.5 rounded-full bg-teal-400 border-2 border-white shadow-lg ring-4 ring-teal-500/30" />
            </div>
          )}
        </div>
      </div>

      {/* Selected Location Card & In-App Route Preview Drawer */}
      {activePoint && (
        <div className="p-4 border-t border-sand-200 bg-sand-50 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-navy-900">{activePoint.name}</h4>
                <Badge variant="neutral" size="sm">
                  {activePoint.city}
                </Badge>
              </div>
              <p className="text-xs text-sand-600 mt-0.5">Approx. zone: {activePoint.approximateArea}</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-terracotta-600">{activePoint.priceLabel}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link
              to={activePoint.href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-900 text-white text-xs font-bold hover:bg-navy-800 transition-colors"
            >
              <span>View Details & Book</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCalculateRoute(travelMode)}
              disabled={isCalculatingRoute}
              className="border-terracotta-400 text-terracotta-600 hover:bg-terracotta-50"
            >
              <RouteIcon className="h-3.5 w-3.5" />
              <span>{isCalculatingRoute ? "Routing..." : "Preview Route"}</span>
            </Button>

            {/* External Navigation Secondary Fallback */}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${activePoint.approximateLatitude},${activePoint.approximateLongitude}&travelmode=walking`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-sand-700 hover:text-navy-900 hover:bg-sand-200 transition-colors ml-auto"
              title="Open directions in external Google Maps application"
            >
              <span>External Maps</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Location Warning / Permission State */}
          {locationWarning && (
            <div
              className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2"
              role="alert"
            >
              <span className="flex-1">{locationWarning}</span>
              <button
                type="button"
                onClick={handleUseDemoOrigin}
                className="px-2 py-1 rounded bg-amber-200 hover:bg-amber-300 font-semibold text-amber-900 text-[11px] whitespace-nowrap transition-colors"
              >
                Use Colombo Hub
              </button>
            </div>
          )}

          {/* Route Preview Panel */}
          {routePreviewOpen && activeRoute && (
            <div className="mt-3 p-3 rounded-xl bg-white border border-sand-300 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RouteIcon className="h-4 w-4 text-terracotta-500" />
                  <span className="text-xs font-bold text-navy-900">In-App Route Preview</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRoutePreviewOpen(false);
                    setActiveRoute(null);
                  }}
                  className="text-sand-500 hover:text-navy-900 p-1"
                  aria-label="Close route preview"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Transportation Mode Switcher */}
              <div className="flex items-center gap-1.5 bg-sand-100 p-1 rounded-lg">
                {(
                  [
                    { mode: "walking", label: "Walk", icon: Footprints },
                    { mode: "driving", label: "Drive", icon: Car },
                    { mode: "cycling", label: "Cycle", icon: Bike }
                  ] as const
                ).map(({ mode, label, icon: Icon }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTravelMode(mode)}
                    className={`flex-1 min-h-[32px] rounded-md text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
                      travelMode === mode
                        ? "bg-navy-900 text-white shadow-sm"
                        : "text-sand-700 hover:text-navy-900 hover:bg-sand-200"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Distance & Duration Summary */}
              <div className="flex items-center justify-around py-1.5 px-3 rounded-lg bg-sand-50 border border-sand-200">
                <div className="text-center">
                  <span className="text-[10px] font-semibold uppercase text-sand-500 block">Distance</span>
                  <span className="text-sm font-black text-navy-900">{formatDistance(activeRoute.distanceMeters)}</span>
                </div>
                <div className="h-6 w-px bg-sand-300" />
                <div className="text-center">
                  <span className="text-[10px] font-semibold uppercase text-sand-500 block">Est. Duration</span>
                  <span className="text-sm font-black text-terracotta-600 flex items-center justify-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(activeRoute.durationSeconds)}
                  </span>
                </div>
              </div>

              {/* Maneuver Steps List */}
              {activeRoute.legs[0]?.steps && activeRoute.legs[0].steps.length > 0 && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sand-500">Maneuver Steps</span>
                  {activeRoute.legs[0].steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs py-1 border-b border-sand-100 last:border-0">
                      <span className="w-4 h-4 rounded-full bg-navy-100 text-navy-900 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sand-800 font-medium">{step.instruction}</p>
                        {step.distanceMeters > 0 && (
                          <span className="text-[10px] text-sand-500">{formatDistance(step.distanceMeters)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {routeError && <p className="text-xs text-rose-600 font-medium">{routeError}</p>}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
