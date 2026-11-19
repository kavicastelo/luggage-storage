import { Link, useLocation } from "react-router-dom";
import { Building2, Calendar, Layers, Tag } from "lucide-react";
import type { StorageLocation } from "@luggage-storage/contracts";
import type { StorageLocationItem } from "@/data/mock-marketplace";
import { Alert, Button, EmptyState } from "@/components/ui";

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

export interface SriLankaCityPreset {
  city: string;
  latitude: number;
  longitude: number;
}

export const SRI_LANKA_HUB_PRESETS: SriLankaCityPreset[] = [
  { city: "Colombo", latitude: 6.9344, longitude: 79.8428 },
  { city: "Kandy", latitude: 7.2906, longitude: 80.6337 },
  { city: "Galle", latitude: 6.0267, longitude: 80.217 },
  { city: "Ella", latitude: 6.8667, longitude: 81.0466 }
];

/**
 * Normalizes a backend StorageLocation entity into the shape expected by shared
 * Host Overview / Operations components without injecting fake demo fixtures.
 */
export function mapApiLocationToItem(loc: StorageLocation): StorageLocationItem {
  return {
    id: loc.id,
    slug: loc.id,
    name: loc.name,
    city: loc.city,
    district: loc.city,
    landmark: loc.addressLine2 || loc.city,
    distanceKm: 0,
    rating: null,
    reviewCount: 0,
    verifiedHost: loc.status,
    openHours: "See location schedule",
    is24Hours: false,
    hasCctv: (loc.amenities ?? []).includes("CCTV"),
    hasClimateControl: (loc.amenities ?? []).includes("AIR_CONDITIONING"),
    hasInsurance: false,
    insuranceLimitLkr: 0,
    photoEvidencePolicy: "OPTIONAL_BY_DEFAULT",
    gracePeriodMinutes: 0,
    lateFeePolicyLabel: "Policy configured per location",
    hourlyRateLkr: { SMALL: 0, MEDIUM: 0, LARGE: 0, OVERSIZED: 0 },
    dailyCapLkr: { SMALL: 0, MEDIUM: 0, LARGE: 0, OVERSIZED: 0 },
    totalCapacity: 0,
    availableCapacity: 0,
    zones: (loc.zones ?? []).map((z) => ({
      id: z.id,
      code: z.zoneType,
      name: z.name,
      capacity: 0,
      occupied: 0
    })),
    addressMasked: `${loc.city} Area`,
    addressExact: loc.addressLine1,
    coordinates: {
      lat: Number(loc.latitude),
      lng: Number(loc.longitude)
    },
    description: loc.description ?? "",
    isLiveLocation: true,
    baseDailyRateLkr: null
  };
}

export function HostLocationSetupTabs({
  locationId,
  querySuffix = ""
}: {
  locationId: string;
  querySuffix?: string;
}) {
  const location = useLocation();
  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";

  if (!locationId || locationId === "select") {
    return null;
  }

  const basePath = `/host/locations/${locationId}`;
  const tabs = [
    { label: "Profile", path: basePath, icon: Building2 },
    { label: "Hours & Calendar", path: `${basePath}/schedule`, icon: Calendar },
    { label: "Capacity & Zones", path: `${basePath}/capacity`, icon: Layers },
    { label: "Pricing Rules", path: `${basePath}/pricing`, icon: Tag }
  ];

  return (
    <nav
      aria-label="Location setup sections"
      className="bg-white rounded-2xl border border-sand-200 p-2 shadow-sm flex flex-wrap gap-1.5"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = normalizedPath === tab.path;
        return (
          <Link
            key={tab.path}
            to={`${tab.path}${querySuffix}`}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              isActive
                ? "bg-navy-900 text-white shadow-sm"
                : "text-navy-800 hover:bg-sand-100"
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${isActive ? "text-amber-300" : "text-navy-500"}`} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function NoLocationSelectedCard({
  description,
  querySuffix
}: {
  description: string;
  querySuffix: string;
}) {
  return (
    <EmptyState
      mascot="suitcase-peek"
      title="No storage location selected or available"
      description={description}
      action={
        <Link
          to={`/host/locations${querySuffix}`}
          className="inline-flex items-center px-4 py-2.5 rounded-xl bg-terracotta-500 text-white text-xs font-bold hover:bg-terracotta-600 transition shadow-sm"
        >
          Return to Storage Locations
        </Link>
      }
    />
  );
}

export function HostQueryErrorAlert({
  message,
  onRetry
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Alert variant="danger" title="Unable to sync host workspace data">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry} className="bg-white">
          Retry
        </Button>
      </div>
    </Alert>
  );
}
