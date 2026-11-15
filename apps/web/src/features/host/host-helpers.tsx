import { Link } from "react-router-dom";
import type { StorageLocation } from "@luggage-storage/contracts";
import type { StorageLocationItem } from "@/data/mock-marketplace";

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

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
    openHours: "08:00 - 20:00 IST",
    is24Hours: false,
    hasCctv: (loc.amenities ?? []).includes("CCTV"),
    hasClimateControl: (loc.amenities ?? []).includes("AIR_CONDITIONING"),
    hasInsurance: true,
    insuranceLimitLkr: 250000,
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

export function NoLocationSelectedCard({
  description,
  querySuffix
}: {
  description: string;
  querySuffix: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-sand-200 p-8 text-center space-y-3 shadow-sm">
      <p className="text-sm font-bold text-navy-950">No storage location selected or available</p>
      <p className="text-xs text-navy-600">{description}</p>
      <Link
        to={`/host/locations${querySuffix}`}
        className="inline-flex items-center px-4 py-2 rounded-xl bg-terracotta-500 text-white text-xs font-bold hover:bg-terracotta-600 transition"
      >
        Return to Storage Locations
      </Link>
    </div>
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
    <div
      role="alert"
      className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl flex flex-wrap items-center justify-between gap-3"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="px-3 py-1 rounded-lg bg-white border border-red-300 text-red-900 font-bold hover:bg-red-100 transition"
      >
        Retry
      </button>
    </div>
  );
}
