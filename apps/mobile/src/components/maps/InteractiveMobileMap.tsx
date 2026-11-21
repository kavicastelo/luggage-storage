import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, type DimensionValue } from "react-native";
import Svg, { Path, Circle, Line, Rect } from "react-native-svg";
import type { GeographicCoordinate, RouteResult } from "@luggage-storage/contracts";
import { MobileIcon } from "../MobileIcon";
import { mobileColors, mobileRadius, mobileSpacing } from "../../lib/theme";

export interface MobileMapPoint {
  id: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  priceLabel?: string;
}

export interface InteractiveMobileMapProps {
  locations?: MobileMapPoint[];
  selectedLocationId?: string | null;
  onSelectLocation?: (id: string) => void;
  userLocation?: GeographicCoordinate | null;
  activeRoute?: RouteResult | null;
  height?: number;
  zoomLevel?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onLocateMe?: () => void;
  showControls?: boolean;
}

const SRI_LANKA_DEFAULT_BOUNDS = {
  minLat: 5.9,
  maxLat: 9.85,
  minLng: 79.65,
  maxLng: 81.9
};

interface MobileTileInfo {
  key: string;
  url: string;
  leftPct: DimensionValue;
  topPct: DimensionValue;
  widthPct: DimensionValue;
  heightPct: DimensionValue;
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

export function InteractiveMobileMap({
  locations = [],
  selectedLocationId,
  onSelectLocation,
  userLocation,
  activeRoute,
  height = 320,
  zoomLevel = 1,
  onZoomIn,
  onZoomOut,
  onLocateMe,
  showControls = true
}: InteractiveMobileMapProps) {
  const validLocations = useMemo(
    () => locations.filter((loc) => Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)),
    [locations]
  );

  // Compute map bounds encompassing active locations, user position, and route
  const bounds = useMemo(() => {
    const lats = validLocations.map((l) => l.latitude);
    const lngs = validLocations.map((l) => l.longitude);

    if (userLocation && Number.isFinite(userLocation.latitude) && Number.isFinite(userLocation.longitude)) {
      lats.push(userLocation.latitude);
      lngs.push(userLocation.longitude);
    }

    if (activeRoute?.geometry) {
      for (const pt of activeRoute.geometry) {
        if (Number.isFinite(pt.latitude) && Number.isFinite(pt.longitude)) {
          lats.push(pt.latitude);
          lngs.push(pt.longitude);
        }
      }
    }

    const minLat = lats.length > 0 ? Math.min(...lats) : SRI_LANKA_DEFAULT_BOUNDS.minLat;
    const maxLat = lats.length > 0 ? Math.max(...lats) : SRI_LANKA_DEFAULT_BOUNDS.maxLat;
    const minLng = lngs.length > 0 ? Math.min(...lngs) : SRI_LANKA_DEFAULT_BOUNDS.minLng;
    const maxLng = lngs.length > 0 ? Math.max(...lngs) : SRI_LANKA_DEFAULT_BOUNDS.maxLng;

    const latSpan = Math.max(maxLat - minLat, 0.05);
    const lngSpan = Math.max(maxLng - minLng, 0.05);
    const padLat = latSpan * 0.15;
    const padLng = lngSpan * 0.15;

    return {
      minLat: minLat - padLat,
      maxLat: maxLat + padLat,
      minLng: minLng - padLng,
      maxLng: maxLng + padLng
    };
  }, [validLocations, userLocation, activeRoute]);

  // Project lat/lng into SVG coordinates (0 - 100 viewBox space)
  const project = (lat: number, lng: number) => {
    const xNorm = (lng - bounds.minLng) / (bounds.maxLng - bounds.minLng);
    const yNorm = 1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
    const xPct = Math.min(94, Math.max(6, xNorm * 100));
    const yPct = Math.min(92, Math.max(8, yNorm * 100));
    return { xPct, yPct };
  };

  // Build SVG path for route polyline
  const routePathD = useMemo(() => {
    if (!activeRoute?.geometry || activeRoute.geometry.length < 2) return "";
    return activeRoute.geometry
      .map((pt, i) => {
        const { xPct, yPct } = project(pt.latitude, pt.longitude);
        return `${i === 0 ? "M" : "L"} ${xPct} ${yPct}`;
      })
      .join(" ");
  }, [activeRoute, bounds]);

  const mapTilerKey = (
    (process.env.EXPO_PUBLIC_MAPTILER_KEY as string | undefined) ||
    (process.env.EXPO_PUBLIC_MAPTILER_API_KEY as string | undefined)
  )?.trim();

  const [failedTiles, setFailedTiles] = useState<Record<string, boolean>>({});

  const visibleTiles = useMemo<MobileTileInfo[]>(() => {
    const lngSpan = bounds.maxLng - bounds.minLng;
    const baseZoom = computeBaseZoom(lngSpan);
    const z = Math.min(16, Math.max(5, baseZoom + (zoomLevel ? Math.round(zoomLevel - 1) : 0)));

    const minX = lng2tile(bounds.minLng, z);
    const maxX = lng2tile(bounds.maxLng, z);
    const minY = lat2tile(bounds.maxLat, z);
    const maxY = lat2tile(bounds.minLat, z);

    if ((maxX - minX + 1) * (maxY - minY + 1) > 64) {
      return [];
    }

    const tiles: MobileTileInfo[] = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const key = `${z}/${x}/${y}`;
        const lngLeft = tile2lng(x, z);
        const lngRight = tile2lng(x + 1, z);
        const latTop = tile2lat(y, z);
        const latBottom = tile2lat(y + 1, z);

        const leftPct = `${(((lngLeft - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100).toFixed(2)}%`;
        const topPct = `${(((bounds.maxLat - latTop) / (bounds.maxLat - bounds.minLat)) * 100).toFixed(2)}%`;
        const widthPct = `${(((lngRight - lngLeft) / (bounds.maxLng - bounds.minLng)) * 100).toFixed(2)}%`;
        const heightPct = `${(((latTop - latBottom) / (bounds.maxLat - bounds.minLat)) * 100).toFixed(2)}%`;

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

  return (
    <View style={[styles.container, { height }]} testID="interactive-mobile-map">
      {/* Raster Map Tile Layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {visibleTiles.map((tile) => (
          <Image
            key={tile.key}
            source={{ uri: tile.url }}
            onError={() => {
              setFailedTiles((prev) => ({ ...prev, [tile.key]: true }));
            }}
            style={{
              position: "absolute",
              left: tile.leftPct,
              top: tile.topPct,
              width: tile.widthPct,
              height: tile.heightPct,
              opacity: 0.88
            }}
            resizeMode="stretch"
          />
        ))}
      </View>

      {/* Map Background & Vector Grid Canvas */}
      <Svg viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Rect x="0" y="0" width="100" height="100" fill="rgba(10, 25, 47, 0.25)" />

        {/* Transit Grid Lines */}
        <Line x1="25" y1="0" x2="25" y2="100" stroke="#1E293B" strokeWidth="0.3" strokeDasharray="1 2" />
        <Line x1="50" y1="0" x2="50" y2="100" stroke="#1E293B" strokeWidth="0.3" strokeDasharray="1 2" />
        <Line x1="75" y1="0" x2="75" y2="100" stroke="#1E293B" strokeWidth="0.3" strokeDasharray="1 2" />
        <Line x1="0" y1="33" x2="100" y2="33" stroke="#1E293B" strokeWidth="0.3" strokeDasharray="1 2" />
        <Line x1="0" y1="66" x2="100" y2="66" stroke="#1E293B" strokeWidth="0.3" strokeDasharray="1 2" />

        {/* Route Polyline Glow & Core Line */}
        {routePathD ? (
          <>
            <Path
              d={routePathD}
              fill="none"
              stroke="#FF5A36"
              strokeWidth="2.8"
              opacity={0.35}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={routePathD}
              fill="none"
              stroke="#E05D38"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}

        {/* User Location Pulse Ring */}
        {userLocation && (
          <Circle
            cx={project(userLocation.latitude, userLocation.longitude).xPct}
            cy={project(userLocation.latitude, userLocation.longitude).yPct}
            r="3"
            fill="none"
            stroke="#0EA5E9"
            strokeWidth="0.6"
            opacity={0.8}
          />
        )}
      </Svg>

      {/* Interactive Location Markers */}
      {validLocations.map((loc) => {
        const { xPct, yPct } = project(loc.latitude, loc.longitude);
        const isSelected = loc.id === selectedLocationId;

        return (
          <View
            key={loc.id}
            style={[
              styles.markerWrapper,
              {
                left: `${xPct}%`,
                top: `${yPct}%`,
                zIndex: isSelected ? 30 : 10
              }
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => onSelectLocation?.(loc.id)}
              style={[styles.markerButton, isSelected && styles.markerButtonSelected]}
              accessibilityLabel={`${loc.name} in ${loc.city}`}
              testID={`map-marker-${loc.id}`}
            >
              {loc.priceLabel ? (
                <View style={[styles.pricePill, isSelected && styles.pricePillSelected]}>
                  <Text style={[styles.priceText, isSelected && styles.priceTextSelected]}>{loc.priceLabel}</Text>
                </View>
              ) : null}
              <View style={[styles.pinIconCircle, isSelected && styles.pinIconCircleSelected]}>
                <MobileIcon
                  name="map-pin"
                  size={12}
                  color={isSelected ? mobileColors.white : mobileColors.terracotta[500]}
                />
              </View>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* User Position Dot */}
      {userLocation && (
        <View
          style={[
            styles.userDotWrapper,
            {
              left: `${project(userLocation.latitude, userLocation.longitude).xPct}%`,
              top: `${project(userLocation.latitude, userLocation.longitude).yPct}%`
            }
          ]}
          pointerEvents="none"
        >
          <View style={styles.userDot} />
        </View>
      )}

      {/* Controls Overlay */}
      {showControls && (
        <View style={styles.controlsContainer}>
          {onZoomIn && (
            <TouchableOpacity
              onPress={onZoomIn}
              style={styles.controlButton}
              accessibilityLabel="Zoom in"
              activeOpacity={0.8}
            >
              <MobileIcon name="plus" size={16} color={mobileColors.white} />
            </TouchableOpacity>
          )}
          {onZoomOut && (
            <TouchableOpacity
              onPress={onZoomOut}
              style={styles.controlButton}
              accessibilityLabel="Zoom out"
              activeOpacity={0.8}
            >
              <MobileIcon name="minus" size={16} color={mobileColors.white} />
            </TouchableOpacity>
          )}
          {onLocateMe && (
            <TouchableOpacity
              onPress={onLocateMe}
              style={[styles.controlButton, userLocation && styles.controlButtonActive]}
              accessibilityLabel="Find my location"
              activeOpacity={0.8}
            >
              <MobileIcon
                name="navigation"
                size={14}
                color={userLocation ? mobileColors.sky[500] : mobileColors.white}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Attribution */}
      <View style={styles.attributionContainer} pointerEvents="none">
        <Text style={styles.attributionText}>© MapTiler © OpenStreetMap</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: mobileRadius.lg,
    overflow: "hidden",
    position: "relative",
    backgroundColor: mobileColors.navy[950]
  },
  markerWrapper: {
    position: "absolute",
    transform: [{ translateX: -18 }, { translateY: -32 }]
  },
  markerButton: {
    alignItems: "center"
  },
  markerButtonSelected: {
    transform: [{ scale: 1.1 }]
  },
  pricePill: {
    backgroundColor: mobileColors.navy[900],
    borderWidth: 1,
    borderColor: mobileColors.sand[700],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: mobileRadius.full,
    marginBottom: 2
  },
  pricePillSelected: {
    backgroundColor: mobileColors.terracotta[500],
    borderColor: mobileColors.white
  },
  priceText: {
    fontSize: 9,
    fontWeight: "700",
    color: mobileColors.white
  },
  priceTextSelected: {
    color: mobileColors.white
  },
  pinIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: mobileColors.navy[900],
    borderWidth: 2,
    borderColor: mobileColors.sand[400],
    alignItems: "center",
    justifyContent: "center"
  },
  pinIconCircleSelected: {
    backgroundColor: mobileColors.terracotta[500],
    borderColor: mobileColors.white
  },
  userDotWrapper: {
    position: "absolute",
    transform: [{ translateX: -6 }, { translateY: -6 }],
    zIndex: 25
  },
  userDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: mobileColors.sky[500],
    borderWidth: 2,
    borderColor: mobileColors.white
  },
  controlsContainer: {
    position: "absolute",
    top: mobileSpacing[2],
    right: mobileSpacing[2],
    gap: 6,
    zIndex: 40
  },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: mobileRadius.md,
    backgroundColor: "rgba(10, 25, 47, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center"
  },
  controlButtonActive: {
    borderColor: mobileColors.sky[500]
  },
  attributionContainer: {
    position: "absolute",
    bottom: 4,
    right: 8,
    backgroundColor: "rgba(10, 25, 47, 0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: mobileRadius.sm
  },
  attributionText: {
    fontSize: 8,
    fontWeight: "500",
    color: mobileColors.sand[400]
  }
});
