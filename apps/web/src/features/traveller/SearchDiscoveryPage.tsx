import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import type { BagCategory, BookingQuoteResponse, DiscoverySortOption } from "@luggage-storage/contracts";
import { DISCOVERY_SORT_OPTIONS } from "@luggage-storage/contracts";
import {
  Search,
  MapPin,
  Clock,
  LocateFixed,
  RotateCcw,
  CheckCircle2,
  Package,
  SlidersHorizontal,
  Luggage
} from "lucide-react";
import { DEMO_LOCATIONS, formatLkr } from "@/data/mock-marketplace";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { useAuthStore } from "@/store/useAuthStore";
import { useAvailabilitySearch, useDiscoveryLocations } from "@/hooks/queries/use-discovery";
import {
  formatAmenityLabel,
  formatLkrMinor,
  toIsoOffsetFromLocalInput
} from "@/lib/formatters";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { LocationDiscoveryMap, type DiscoveryMapPoint } from "./LocationDiscoveryMap";
import {
  buildTravellerScheduleQuery,
  countTotalBags,
  parseTravellerScheduleParams,
  type TravellerBagCounts
} from "./traveller-utils";

const CITY_FILTERS = ["All Sri Lanka", "Colombo", "Kandy", "Ella", "Galle", "Negombo"];

const SORT_LABELS: Record<DiscoverySortOption, string> = {
  distance: "Closest Transit Zone",
  newest: "Newest Verified Hubs",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low"
};

const BAG_FILTER_ROWS: Array<{ key: BagCategory; label: string }> = [
  { key: "BAG_SMALL", label: "Small" },
  { key: "BAG_MEDIUM", label: "Medium" },
  { key: "BAG_LARGE", label: "Large" },
  { key: "BAG_OVERSIZED", label: "Oversized" }
];

export function WebSearchDiscoveryPage() {
  const routeLocation = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();

  const isDemoMode = isDemoPreviewActive({
    allowDemoPreview: true,
    search: routeLocation.search,
    isAuthenticated
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Find Luggage Storage in Sri Lanka — LuggageStorage";
    }
  }, []);

  const parsedInitial = useMemo(
    () => parseTravellerScheduleParams(searchParams.toString()),
    [searchParams]
  );

  const [city, setCity] = useState(parsedInitial.city);
  const [searchTermInput, setSearchTermInput] = useState(parsedInitial.searchTerm);
  const [appliedSearchTerm, setAppliedSearchTerm] = useState(parsedInitial.searchTerm);
  const [dropOffLocal, setDropOffLocal] = useState(parsedInitial.dropOffLocal);
  const [collectionLocal, setCollectionLocal] = useState(parsedInitial.collectionLocal);
  const [bags, setBags] = useState<TravellerBagCounts>(parsedInitial.bags);
  const [acceptsOversized, setAcceptsOversized] = useState(parsedInitial.acceptsOversized);
  const [sortBy, setSortBy] = useState<DiscoverySortOption>(
    parsedInitial.sortBy ??
      (parsedInitial.latitude !== undefined ? "distance" : "newest")
  );
  const [geoCoords, setGeoCoords] = useState<{ latitude: number; longitude: number } | null>(
    parsedInitial.latitude !== undefined && parsedInitial.longitude !== undefined
      ? { latitude: parsedInitial.latitude, longitude: parsedInitial.longitude }
      : null
  );
  const [geoError, setGeoError] = useState<string | null>(null);
  const [selectedMapLocationId, setSelectedMapLocationId] = useState<string | null>(null);

  const dropOffIso = toIsoOffsetFromLocalInput(dropOffLocal) || parsedInitial.dropOffIso;
  const collectionIso = toIsoOffsetFromLocalInput(collectionLocal) || parsedInitial.collectionIso;
  const hasValidSchedule =
    Boolean(dropOffIso && collectionIso) &&
    new Date(collectionIso).getTime() > new Date(dropOffIso).getTime();
  const totalBags = countTotalBags(bags);

  const syncUrlParams = (overrides: {
    nextCity?: string;
    nextSearchTerm?: string;
    nextDropOffLocal?: string;
    nextCollectionLocal?: string;
    nextBags?: TravellerBagCounts;
    nextOversized?: boolean;
    nextSort?: DiscoverySortOption;
    nextCoords?: { latitude: number; longitude: number } | null;
  } = {}) => {
    const targetCity = overrides.nextCity !== undefined ? overrides.nextCity : city;
    const targetTerm =
      overrides.nextSearchTerm !== undefined ? overrides.nextSearchTerm : appliedSearchTerm;
    const targetDrop =
      overrides.nextDropOffLocal !== undefined
        ? toIsoOffsetFromLocalInput(overrides.nextDropOffLocal)
        : dropOffIso;
    const targetCollect =
      overrides.nextCollectionLocal !== undefined
        ? toIsoOffsetFromLocalInput(overrides.nextCollectionLocal)
        : collectionIso;
    const targetBags = overrides.nextBags ?? bags;
    const targetOversized =
      overrides.nextOversized !== undefined ? overrides.nextOversized : acceptsOversized;
    const targetSort = overrides.nextSort ?? sortBy;
    const targetCoords = overrides.nextCoords !== undefined ? overrides.nextCoords : geoCoords;

    const qs = buildTravellerScheduleQuery({
      city: targetCity || undefined,
      searchTerm: targetTerm || undefined,
      dropOffAt: targetDrop || undefined,
      collectionAt: targetCollect || undefined,
      bags: targetBags,
      acceptsOversized: targetOversized || undefined,
      sortBy: targetSort,
      latitude: targetCoords?.latitude,
      longitude: targetCoords?.longitude,
      preserveDemoPreview: isDemoMode
    });
    setSearchParams(new URLSearchParams(qs), { replace: true });
  };

  const discoveryQuery = useDiscoveryLocations(
    {
      city: city || undefined,
      searchTerm: appliedSearchTerm || undefined,
      acceptsOversized: acceptsOversized || bags.BAG_OVERSIZED > 0 ? true : undefined,
      latitude: geoCoords?.latitude,
      longitude: geoCoords?.longitude,
      sortBy,
      limit: 24
    },
    { enabled: !isDemoMode }
  );

  const availabilityQuery = useAvailabilitySearch(
    hasValidSchedule && totalBags > 0
      ? {
          city: city || undefined,
          dropOffAt: dropOffIso,
          collectionAt: collectionIso,
          smallBags: bags.BAG_SMALL,
          mediumBags: bags.BAG_MEDIUM,
          largeBags: bags.BAG_LARGE,
          oversizedBags: bags.BAG_OVERSIZED
        }
      : null,
    { enabled: !isDemoMode && hasValidSchedule && totalBags > 0 }
  );

  const quotesByLocationId = useMemo(() => {
    const map = new Map<string, BookingQuoteResponse>();
    for (const quote of availabilityQuery.data?.quotes ?? []) {
      map.set(quote.locationId, quote);
    }
    return map;
  }, [availabilityQuery.data]);

  const scheduleForwardQuery = buildTravellerScheduleQuery({
    dropOffAt: dropOffIso,
    collectionAt: collectionIso,
    bags,
    preserveDemoPreview: isDemoMode
  });

  const handleCitySelect = (selectedCity: string) => {
    const nextCity = selectedCity === "All Sri Lanka" ? "" : selectedCity;
    setCity(nextCity);
    syncUrlParams({ nextCity });
  };

  const handleSearchFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchTermInput.trim();
    setAppliedSearchTerm(trimmed);
    syncUrlParams({ nextSearchTerm: trimmed });
  };

  const handleNearMe = () => {
    setGeoError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Browser location lookup is unavailable in this environment.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        };
        setGeoCoords(coords);
        setSortBy("distance");
        syncUrlParams({ nextCoords: coords, nextSort: "distance" });
      },
      (err) => {
        setGeoError(
          err.message || "Location permission was denied. Filter by city or keyword instead."
        );
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleResetFilters = () => {
    setCity("");
    setSearchTermInput("");
    setAppliedSearchTerm("");
    setAcceptsOversized(false);
    setGeoCoords(null);
    setGeoError(null);
    setSortBy("newest");
    const resetBags: TravellerBagCounts = {
      BAG_SMALL: 0,
      BAG_MEDIUM: 1,
      BAG_LARGE: 0,
      BAG_OVERSIZED: 0
    };
    setBags(resetBags);
    const nextParams = new URLSearchParams();
    if (isDemoMode) {
      nextParams.set("preview", "demo");
    }
    setSearchParams(nextParams, { replace: true });
  };

  const adjustBag = (key: BagCategory, delta: number) => {
    const nextValue = Math.max(0, Math.min(20, bags[key] + delta));
    const nextBags = { ...bags, [key]: nextValue };
    setBags(nextBags);
    syncUrlParams({ nextBags });
  };

  const demoFilteredLocations = useMemo(() => {
    if (!isDemoMode) return [];
    return DEMO_LOCATIONS.filter((loc) => {
      if (city && loc.city.toLowerCase() !== city.toLowerCase()) return false;
      if (
        appliedSearchTerm &&
        !`${loc.name} ${loc.city} ${loc.landmark}`
          .toLowerCase()
          .includes(appliedSearchTerm.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [isDemoMode, city, appliedSearchTerm]);

  const mapPoints: DiscoveryMapPoint[] = useMemo(() => {
    if (isDemoMode) {
      return demoFilteredLocations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        city: loc.city,
        approximateArea: loc.district,
        approximateLatitude: loc.coordinates.lat,
        approximateLongitude: loc.coordinates.lng,
        priceLabel: formatLkr(loc.dailyCapLkr.MEDIUM),
        href: `/locations/${loc.slug}?${scheduleForwardQuery}`
      }));
    }

    return (discoveryQuery.data?.locations ?? []).map((loc) => {
      const liveQuote = quotesByLocationId.get(loc.id);
      const priceLabel = liveQuote
        ? formatLkrMinor(liveQuote.totalAmountMinor, liveQuote.currency)
        : loc.baseRateMinor
        ? formatLkrMinor(loc.baseRateMinor, loc.currency)
        : loc.city;
      return {
        id: loc.id,
        name: loc.name,
        city: loc.city,
        approximateArea: loc.approximateArea,
        approximateLatitude: loc.approximateLatitude,
        approximateLongitude: loc.approximateLongitude,
        priceLabel,
        bookingMode: loc.bookingMode,
        href: `/locations/${loc.id}?${scheduleForwardQuery}`
      };
    });
  }, [isDemoMode, demoFilteredLocations, discoveryQuery.data, quotesByLocationId, scheduleForwardQuery]);

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Filter Panel */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-navy-950">
              Find Luggage Storage in Sri Lanka
            </h1>
            <p className="text-sm text-sand-700 mt-1">
              Compare verified transit hubs with transparent server-computed LKR quotes and live
              availability.
            </p>
          </div>
          {geoCoords && (
            <Badge variant="info" size="md">
              Sorted near ({geoCoords.latitude.toFixed(2)}, {geoCoords.longitude.toFixed(2)})
            </Badge>
          )}
        </div>

        {/* City Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {CITY_FILTERS.map((cityLabel) => {
            const isSelected =
              (cityLabel === "All Sri Lanka" && !city) ||
              city.toLowerCase() === cityLabel.toLowerCase();
            return (
              <button
                key={cityLabel}
                type="button"
                onClick={() => handleCitySelect(cityLabel)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                  isSelected
                    ? "bg-navy-900 text-white"
                    : "bg-white text-navy-900 border border-sand-300 hover:bg-sand-100"
                }`}
              >
                {cityLabel}
              </button>
            );
          })}
        </div>

        {/* Filter Controls */}
        <Card className="p-5 bg-white space-y-4">
          <form
            onSubmit={handleSearchFormSubmit}
            className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-sand-700 mb-1">
                Search Hub or Area
              </label>
              <div className="relative">
                <Search className="h-4 w-4 text-sand-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTermInput}
                  onChange={(e) => setSearchTermInput(e.target.value)}
                  placeholder="Colombo Fort, Pettah, Galle Road..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-sand-300 text-sm"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-sand-700 mb-1">Drop-off</label>
              <input
                type="datetime-local"
                value={dropOffLocal}
                onChange={(e) => {
                  setDropOffLocal(e.target.value);
                  syncUrlParams({ nextDropOffLocal: e.target.value });
                }}
                className="w-full px-3 py-2 rounded-xl border border-sand-300 text-sm"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-sand-700 mb-1">Pick-up</label>
              <input
                type="datetime-local"
                value={collectionLocal}
                onChange={(e) => {
                  setCollectionLocal(e.target.value);
                  syncUrlParams({ nextCollectionLocal: e.target.value });
                }}
                className="w-full px-3 py-2 rounded-xl border border-sand-300 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <Button type="submit" variant="primary" className="w-full py-2">
                Apply Filters
              </Button>
            </div>
          </form>

          {/* Bag Counts, Oversized, Near Me, Sort & Reset */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-sand-200">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-sand-700 flex items-center gap-1">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Bags:
              </span>
              {BAG_FILTER_ROWS.map((bagRow) => (
                <div
                  key={bagRow.key}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-sand-200 bg-sand-50 text-xs"
                >
                  <span className="font-semibold text-navy-900">{bagRow.label}</span>
                  <button
                    type="button"
                    onClick={() => adjustBag(bagRow.key, -1)}
                    aria-label={`Decrease ${bagRow.label}`}
                    className="w-5 h-5 rounded bg-white border border-sand-300 font-bold"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold w-4 text-center">{bags[bagRow.key]}</span>
                  <button
                    type="button"
                    onClick={() => adjustBag(bagRow.key, 1)}
                    aria-label={`Increase ${bagRow.label}`}
                    className="w-5 h-5 rounded bg-white border border-sand-300 font-bold"
                  >
                    +
                  </button>
                </div>
              ))}

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-navy-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptsOversized}
                  onChange={(e) => {
                    setAcceptsOversized(e.target.checked);
                    syncUrlParams({ nextOversized: e.target.checked });
                  }}
                  className="rounded border-sand-400 text-terracotta-600 focus:ring-terracotta-500"
                />
                Accepts Oversized Gear
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Sort results"
                value={sortBy}
                onChange={(e) => {
                  const next = e.target.value as DiscoverySortOption;
                  setSortBy(next);
                  syncUrlParams({ nextSort: next });
                }}
                className="px-3 py-1.5 rounded-xl border border-sand-300 text-xs font-semibold bg-white"
              >
                {DISCOVERY_SORT_OPTIONS.map((option) => (
                  <option
                    key={option}
                    value={option}
                    disabled={option === "distance" && !geoCoords}
                  >
                    {SORT_LABELS[option]}
                  </option>
                ))}
              </select>

              <Button type="button" variant="outline" size="sm" onClick={handleNearMe}>
                <LocateFixed className="h-3.5 w-3.5" />
                Near Me
              </Button>

              <Button type="button" variant="ghost" size="sm" onClick={handleResetFilters}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Filters
              </Button>
            </div>
          </div>

          {!hasValidSchedule && (
            <Alert variant="warning">
              Pick-up time must be strictly after drop-off time to compute live availability quotes.
            </Alert>
          )}
          {geoError && <Alert variant="warning">{geoError}</Alert>}
        </Card>
      </div>

      {/* Main Results + Map Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-4">
          {isDemoMode ? (
            demoFilteredLocations.length === 0 ? (
              <Card className="p-8 text-center bg-white space-y-3">
                <p className="font-bold text-navy-950">No demo locations match those filters.</p>
                <Button type="button" variant="outline" size="sm" onClick={handleResetFilters}>
                  Reset Filters
                </Button>
              </Card>
            ) : (
              demoFilteredLocations.map((loc) => (
                <Card key={loc.id} className="p-6 bg-white space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="brand" size="sm">
                          {loc.city}
                        </Badge>
                        <Badge variant="neutral" size="sm">
                          Demo Preview
                        </Badge>
                      </div>
                      <h2 className="text-xl font-extrabold text-navy-950">{loc.name}</h2>
                      <p className="text-xs text-sand-700 mt-1">{loc.landmark}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-sand-600">Standard day rate</p>
                      <p className="text-lg font-black text-navy-950">
                        {formatLkr(loc.dailyCapLkr.MEDIUM)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-sand-200 justify-end">
                    <Link
                      to={`/locations/${loc.slug}?${scheduleForwardQuery}`}
                      className="px-4 py-2 rounded-xl border border-sand-300 text-xs font-bold text-navy-900 hover:bg-sand-100"
                    >
                      Details
                    </Link>
                    <Link
                      to={`/checkout/${loc.id}?${scheduleForwardQuery}`}
                      className="px-4 py-2 rounded-xl bg-terracotta-500 text-white text-xs font-bold hover:bg-terracotta-600"
                    >
                      Book Now
                    </Link>
                  </div>
                </Card>
              ))
            )
          ) : discoveryQuery.isLoading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="p-6 space-y-3">
                  <LoadingSkeleton variant="text" className="w-1/3" />
                  <LoadingSkeleton variant="text" className="w-2/3" />
                  <LoadingSkeleton className="h-20 w-full" />
                </Card>
              ))}
            </div>
          ) : discoveryQuery.isError ? (
            <Alert variant="danger" title="Unable to Load Storage Locations">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {discoveryQuery.error instanceof Error
                    ? discoveryQuery.error.message
                    : "Failed to query verified locations."}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void discoveryQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            </Alert>
          ) : !discoveryQuery.data || discoveryQuery.data.locations.length === 0 ? (
            <Card className="p-8 text-center bg-white space-y-3">
              <Luggage className="h-8 w-8 text-terracotta-500 mx-auto" />
              <h2 className="text-lg font-extrabold text-navy-950">
                No storage hubs matched your search
              </h2>
              <p className="text-sm text-sand-700">
                Try clearing city or oversized filters to explore other verified transit corridors.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={handleResetFilters}>
                Reset Filters
              </Button>
            </Card>
          ) : (
            discoveryQuery.data.locations.map((loc) => {
              const liveQuote = quotesByLocationId.get(loc.id);
              const isSelected = selectedMapLocationId === loc.id;
              return (
                <Card
                  key={loc.id}
                  onMouseEnter={() => setSelectedMapLocationId(loc.id)}
                  className={`overflow-hidden bg-white transition-shadow ${
                    isSelected ? "ring-2 ring-terracotta-500" : ""
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12">
                    <div className="sm:col-span-4 bg-sand-100 min-h-[150px]">
                      {loc.primaryImageUrl ? (
                        <img
                          src={loc.primaryImageUrl}
                          alt={loc.name}
                          className="w-full h-full object-cover min-h-[150px]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sand-500">
                          <Package className="h-8 w-8" />
                        </div>
                      )}
                    </div>

                    <div className="sm:col-span-8 p-5 flex flex-col justify-between space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="brand" size="sm">
                              {loc.city}
                            </Badge>
                            <Badge
                              variant={loc.bookingMode === "INSTANT" ? "success" : "info"}
                              size="sm"
                            >
                              {loc.bookingMode === "INSTANT"
                                ? "Instant Confirmation"
                                : "Host Approval"}
                            </Badge>
                            {loc.acceptsOversized && (
                              <Badge variant="neutral" size="sm">
                                Oversized Accepted
                              </Badge>
                            )}
                          </div>
                          <h2 className="text-lg font-extrabold text-navy-950">{loc.name}</h2>
                          <p className="text-xs text-sand-700 flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-terracotta-500 shrink-0" />
                            {loc.approximateArea}
                            {typeof loc.distanceMeters === "number" && (
                              <span className="font-mono text-navy-800 ml-1">
                                ({(loc.distanceMeters / 1000).toFixed(1)} km corridor)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-sand-600 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-navy-700 shrink-0" />
                            {loc.is24Hours
                              ? "Open 24 Hours"
                              : loc.operatingHoursSummary ?? "Operating hours not configured"}
                          </p>
                        </div>

                        <div className="text-right">
                          {liveQuote ? (
                            <>
                              <p className="text-[11px] font-semibold text-sand-600">
                                {totalBags} {totalBags === 1 ? "bag" : "bags"} quote
                              </p>
                              <p className="text-lg font-black text-navy-950">
                                {formatLkrMinor(liveQuote.totalAmountMinor, liveQuote.currency)}
                              </p>
                              <Badge
                                variant={liveQuote.available ? "success" : "danger"}
                                size="sm"
                              >
                                {liveQuote.available
                                  ? `${liveQuote.remainingCapacityUnits} units free`
                                  : "Unavailable"}
                              </Badge>
                            </>
                          ) : loc.baseRateMinor ? (
                            <>
                              <p className="text-[11px] text-sand-600">Base rate from</p>
                              <p className="text-lg font-black text-navy-950">
                                {formatLkrMinor(loc.baseRateMinor, loc.currency)}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs font-semibold text-sand-700">
                              Live quote at checkout
                            </p>
                          )}
                        </div>
                      </div>

                      {liveQuote && !liveQuote.available && liveQuote.unavailabilityReason && (
                        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5">
                          {liveQuote.unavailabilityReason}
                        </p>
                      )}

                      {loc.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {loc.amenities.slice(0, 4).map((amenity) => (
                            <span
                              key={amenity}
                              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-sand-100 text-sand-800"
                            >
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              {formatAmenityLabel(amenity)}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-sand-200">
                        <Link
                          to={`/locations/${loc.id}?${scheduleForwardQuery}`}
                          className="px-4 py-2 rounded-xl border border-sand-300 text-xs font-bold text-navy-900 hover:bg-sand-100"
                        >
                          Details
                        </Link>
                        <Link
                          to={`/checkout/${loc.id}?${scheduleForwardQuery}`}
                          className="px-4 py-2 rounded-xl bg-terracotta-500 text-white text-xs font-bold hover:bg-terracotta-600"
                        >
                          Book Now
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Sticky Interactive Corridor Map */}
        <div className="lg:col-span-5 lg:sticky lg:top-20">
          <LocationDiscoveryMap
            locations={mapPoints}
            selectedLocationId={selectedMapLocationId}
            onSelectLocation={setSelectedMapLocationId}
          />
        </div>
      </div>
    </div>
  );
}
