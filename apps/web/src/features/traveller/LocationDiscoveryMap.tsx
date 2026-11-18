import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { MapPin, Compass, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

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

function projectCoordinates(
  locations: DiscoveryMapPoint[],
  lat: number,
  lng: number
): { xPct: number; yPct: number } {
  const lats = locations.map((l) => l.approximateLatitude).filter(Number.isFinite);
  const lngs = locations.map((l) => l.approximateLongitude).filter(Number.isFinite);

  const rawMinLat = lats.length > 0 ? Math.min(...lats) : SRI_LANKA_BOUNDS.minLat;
  const rawMaxLat = lats.length > 0 ? Math.max(...lats) : SRI_LANKA_BOUNDS.maxLat;
  const rawMinLng = lngs.length > 0 ? Math.min(...lngs) : SRI_LANKA_BOUNDS.minLng;
  const rawMaxLng = lngs.length > 0 ? Math.max(...lngs) : SRI_LANKA_BOUNDS.maxLng;

  const latSpan = Math.max(rawMaxLat - rawMinLat, 0.08);
  const lngSpan = Math.max(rawMaxLng - rawMinLng, 0.08);

  const padLat = latSpan * 0.2;
  const padLng = lngSpan * 0.2;

  const minLat = rawMinLat - padLat;
  const maxLat = rawMaxLat + padLat;
  const minLng = rawMinLng - padLng;
  const maxLng = rawMaxLng + padLng;

  const xPct = Math.min(90, Math.max(10, ((lng - minLng) / (maxLng - minLng)) * 100));
  const yPct = Math.min(88, Math.max(12, (1 - (lat - minLat) / (maxLat - minLat)) * 100));
  return { xPct, yPct };
}

function computeSpreadCoordinates(locations: DiscoveryMapPoint[]): Map<string, { xPct: number; yPct: number }> {
  const placed: Array<{ id: string; xPct: number; yPct: number }> = [];
  const result = new Map<string, { xPct: number; yPct: number }>();

  for (const loc of locations) {
    const base = projectCoordinates(
      locations,
      loc.approximateLatitude,
      loc.approximateLongitude
    );
    let xPct = base.xPct;
    let yPct = base.yPct;

    let collisionCount = 0;
    for (const prev of placed) {
      const dx = Math.abs(prev.xPct - xPct);
      const dy = Math.abs(prev.yPct - yPct);
      if (dx < 8 && dy < 8) {
        collisionCount += 1;
      }
    }

    if (collisionCount > 0) {
      const angle = collisionCount * 2.1;
      const radius = 5 + collisionCount * 2.5;
      xPct = Math.min(90, Math.max(10, base.xPct + Math.cos(angle) * radius));
      yPct = Math.min(88, Math.max(12, base.yPct + Math.sin(angle) * radius));
    }

    placed.push({ id: loc.id, xPct, yPct });
    result.set(loc.id, { xPct, yPct });
  }

  return result;
}

export const LocationDiscoveryMap: React.FC<LocationDiscoveryMapProps> = ({
  locations,
  selectedLocationId,
  onSelectLocation
}) => {
  const mapTilerKey = (import.meta.env.VITE_MAPTILER_KEY as string | undefined)?.trim();
  const validLocations = useMemo(
    () =>
      locations.filter(
        (loc) =>
          Number.isFinite(loc.approximateLatitude) && Number.isFinite(loc.approximateLongitude)
      ),
    [locations]
  );

  const pinPositions = useMemo(() => computeSpreadCoordinates(validLocations), [validLocations]);

  const activePoint =
    validLocations.find((loc) => loc.id === selectedLocationId) ?? validLocations[0] ?? null;

  const centerPoint = activePoint ?? {
    approximateLatitude: 7.8731,
    approximateLongitude: 80.7718
  };

  const mapTilerStaticUrl = mapTilerKey
    ? `https://api.maptiler.com/maps/streets-v2/static/${centerPoint.approximateLongitude.toFixed(
        3
      )},${centerPoint.approximateLatitude.toFixed(
        3
      )},8/600x360.png?key=${encodeURIComponent(mapTilerKey)}`
    : null;

  return (
    <Card className="overflow-hidden border border-sand-200 bg-white">
      <div className="px-4 py-3 bg-navy-900 text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-terracotta-400" />
          <h3 className="text-sm font-bold">Sri Lanka Transit Corridor Map</h3>
        </div>
        <Badge variant="navy" size="sm">
          {validLocations.length} {validLocations.length === 1 ? "zone" : "zones"}
        </Badge>
      </div>

      <div className="relative h-72 sm:h-80 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950 overflow-hidden">
        {mapTilerStaticUrl && (
          <img
            src={mapTilerStaticUrl}
            alt="MapTiler Sri Lanka transit corridor backdrop"
            className="absolute inset-0 w-full h-full object-cover opacity-35"
            loading="lazy"
          />
        )}

        {/* Coordinate Projection Grid */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 w-full h-full opacity-25"
        >
          {[20, 40, 60, 80].map((pos) => (
            <React.Fragment key={pos}>
              <line x1={pos} y1={0} x2={pos} y2={100} stroke="#e5dfd7" strokeWidth="0.3" />
              <line x1={0} y1={pos} x2={100} y2={pos} stroke="#e5dfd7" strokeWidth="0.3" />
            </React.Fragment>
          ))}
        </svg>

        {validLocations.length === 0 ? (
          <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6 text-sand-200">
            <MapPin className="h-8 w-8 text-terracotta-400 mb-2" />
            <p className="text-sm font-semibold">No transit zones match the current filter</p>
            <p className="text-xs text-sand-300 mt-1">
              Adjust your city or keyword filters to view verified custody hubs.
            </p>
          </div>
        ) : (
          <div className="relative z-10 h-full w-full">
            {validLocations.map((loc) => {
              const coords = pinPositions.get(loc.id) ?? { xPct: 50, yPct: 50 };
              const isSelected = activePoint?.id === loc.id;
              return (
                <button
                  key={loc.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectLocation?.(loc.id)}
                  style={{ left: `${coords.xPct}%`, top: `${coords.yPct}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 min-h-[36px] px-2.5 py-1 rounded-full text-xs font-bold shadow-md transition-transform flex items-center gap-1 tabular-nums ${
                    isSelected
                      ? "bg-terracotta-500 text-white scale-110 ring-2 ring-white z-20"
                      : "bg-white text-navy-950 hover:bg-terracotta-50 z-10"
                  }`}
                  title={`${loc.name} (${loc.approximateArea})`}
                >
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[110px]">{loc.priceLabel}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {activePoint && (
        <div className="p-4 border-t border-sand-200 bg-sand-50 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-terracotta-700">
                {activePoint.city} • {activePoint.approximateArea}
              </p>
              <p className="text-sm font-extrabold text-navy-950 truncate">{activePoint.name}</p>
              <p className="text-xs text-sand-700 mt-0.5">
                Transit precinct: {activePoint.approximateArea}
              </p>
            </div>
            <Link
              to={activePoint.href}
              className="shrink-0 min-h-[44px] inline-flex items-center text-xs font-bold px-3.5 py-2 rounded-xl bg-navy-900 text-white hover:bg-navy-800 transition-colors"
            >
              Details
            </Link>
          </div>
        </div>
      )}

      <div className="px-4 py-2.5 bg-white border-t border-sand-200 flex items-center gap-2 text-[11px] text-sand-700">
        <ShieldAlert className="h-3.5 w-3.5 text-navy-700 shrink-0" />
        <span>
          Approximate ~200–400m transit zone shown before booking. Exact street address unlocks
          after confirmation.
        </span>
      </div>
    </Card>
  );
};
