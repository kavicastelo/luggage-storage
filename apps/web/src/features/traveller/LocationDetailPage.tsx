import React, { useEffect, useMemo } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  CalendarX2,
  Luggage,
  ArrowLeft,
  Scale,
  Package
} from "lucide-react";
import { DEMO_LOCATIONS, formatLkr } from "@/data/mock-marketplace";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { useAuthStore } from "@/store/useAuthStore";
import { usePublicLocationDetail } from "@/hooks/queries/use-discovery";
import {
  formatAmenityLabel,
  formatBagCategoryLabel,
  formatDayOfWeek,
  formatLkrMinor,
  formatPricingUnitLabel
} from "@/lib/formatters";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import {
  buildTravellerScheduleQuery,
  isUuid,
  parseTravellerScheduleParams
} from "./traveller-utils";

export function LocationProfileDetailPage() {
  const params = useParams<{ slug?: string; id?: string }>();
  const routeLocation = useLocation();
  const { isAuthenticated } = useAuthStore();

  const isDemoMode = isDemoPreviewActive({
    allowDemoPreview: true,
    search: routeLocation.search,
    isAuthenticated
  });

  const searchQuery = new URLSearchParams(routeLocation.search);
  const rawIdentifier = params.slug ?? params.id ?? searchQuery.get("loc") ?? undefined;
  const parsedSchedule = useMemo(
    () => parseTravellerScheduleParams(routeLocation.search),
    [routeLocation.search]
  );

  const forwardScheduleQs = buildTravellerScheduleQuery({
    dropOffAt: parsedSchedule.dropOffIso,
    collectionAt: parsedSchedule.collectionIso,
    bags: parsedSchedule.bags,
    preserveDemoPreview: isDemoMode
  });

  const validLiveUuid = !isDemoMode && isUuid(rawIdentifier);
  const detailQuery = usePublicLocationDetail(rawIdentifier, { enabled: validLiveUuid });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = detailQuery.data?.name
        ? `${detailQuery.data.name} — LuggageStorage`
        : "Storage Facility Profile — LuggageStorage";
    }
  }, [detailQuery.data?.name]);

  // Strict Demo Preview Rendering (only on unauthenticated ?preview=demo)
  if (isDemoMode) {
    const demoLoc =
      DEMO_LOCATIONS.find(
        (loc) => loc.slug === rawIdentifier || loc.id === rawIdentifier
      ) ?? DEMO_LOCATIONS[0];

    return (
      <div className="space-y-8 pb-12 max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={`/search?${forwardScheduleQs}`}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-navy-900 hover:text-terracotta-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Search
          </Link>
          <Badge variant="neutral" size="md">
            Demo Preview Fixture
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <Card className="p-6 bg-white space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="brand">{demoLoc.city}</Badge>
                <Badge variant="success">Instant Booking</Badge>
              </div>
              <h1 className="text-3xl font-extrabold text-navy-950">{demoLoc.name}</h1>
              <p className="text-sm text-sand-700">{demoLoc.landmark}</p>
            </Card>

            <Card className="p-6 bg-white space-y-3">
              <h2 className="text-lg font-extrabold text-navy-950">About This Storage Facility</h2>
              <p className="text-sm text-sand-700">{demoLoc.description}</p>
              <div className="rounded-xl bg-sand-50 border border-sand-200 p-4 space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-navy-900">
                  Privacy-Preserving Address Masking
                </p>
                <p className="text-sm text-sand-800">{demoLoc.addressMasked}</p>
              </div>
            </Card>

            <Card className="p-6 bg-white space-y-3">
              <h2 className="text-lg font-extrabold text-navy-950">Operating Hours</h2>
              <p className="text-sm text-sand-700">{demoLoc.openHours}</p>
            </Card>

            <Card className="p-6 bg-white space-y-3">
              <h2 className="text-lg font-extrabold text-navy-950">
                Dedicated Storage Compartments
              </h2>
              <p className="text-sm text-sand-700">
                {demoLoc.zones.length} designated zones available during inspection preview.
              </p>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card className="p-6 bg-white space-y-4">
              <h2 className="text-lg font-extrabold text-navy-950">Transparent LKR Pricing Card</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-sand-700">Medium Daily Cap</span>
                  <span className="font-bold text-navy-950">
                    {formatLkr(demoLoc.dailyCapLkr.MEDIUM)}
                  </span>
                </div>
                <p className="text-xs text-sand-600 pt-2 border-t border-sand-200">
                  Protected by ledger-backed marketplace settlement transparency.
                </p>
              </div>
              <Link
                to={`/checkout/${demoLoc.id}?${forwardScheduleQs}`}
                className="block w-full text-center px-4 py-3 rounded-xl bg-terracotta-500 text-white font-bold text-sm hover:bg-terracotta-600"
              >
                Book This Hub
              </Link>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Live Mode — Non-UUID identifier
  if (!validLiveUuid) {
    return (
      <div className="max-w-3xl mx-auto py-12 space-y-6">
        <Alert variant="warning" title="Storage Location Not Found">
          The requested location identifier is invalid or missing. Browse active hubs from the
          search directory.
        </Alert>
        <Link
          to="/search"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-900 text-white text-sm font-bold"
        >
          <ArrowLeft className="h-4 w-4" />
          Browse Verified Hubs
        </Link>
      </div>
    );
  }

  const detail = detailQuery.data;
  const sortedImages = detail
    ? [...detail.images].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
    : [];
  const sortedHours = detail
    ? [...detail.openingHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    : [];

  return (
    <div className="space-y-8 pb-12 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/search?${forwardScheduleQs}`}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-navy-900 hover:text-terracotta-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Search
        </Link>
        {detail && (
          <Badge variant={detail.bookingMode === "INSTANT" ? "success" : "info"} size="md">
            {detail.bookingMode === "INSTANT"
              ? "Instant Booking Confirmation"
              : "Requires Host Approval"}
          </Badge>
        )}
      </div>

      {detailQuery.isError ? (
        <Alert variant="danger" title="Unable to Load Storage Location Profile">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : "Could not retrieve storage facility details."}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void detailQuery.refetch()}
            >
              Retry
            </Button>
          </div>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* Header & Photo Gallery */}
          <Card className="overflow-hidden bg-white">
            {detailQuery.isLoading ? (
              <div className="p-6 space-y-4">
                <LoadingSkeleton className="h-56 w-full" />
                <LoadingSkeleton variant="text" className="w-2/3" />
                <LoadingSkeleton variant="text" className="w-1/2" />
              </div>
            ) : detail ? (
              <>
                {sortedImages.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-sand-100 p-2">
                    <div
                      className={
                        sortedImages.length > 1 ? "sm:col-span-8" : "sm:col-span-12"
                      }
                    >
                      <img
                        src={sortedImages[0].url}
                        alt={sortedImages[0].caption || detail.name}
                        className="w-full h-64 sm:h-72 object-cover rounded-xl"
                      />
                    </div>
                    {sortedImages.length > 1 && (
                      <div className="sm:col-span-4 grid grid-cols-2 sm:grid-cols-1 gap-2">
                        {sortedImages.slice(1, 3).map((img) => (
                          <img
                            key={img.id}
                            src={img.url}
                            alt={img.caption || detail.name}
                            className="w-full h-32 sm:h-[140px] object-cover rounded-xl"
                            loading="lazy"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : detail.primaryImageUrl ? (
                  <img
                    src={detail.primaryImageUrl}
                    alt={detail.name}
                    className="w-full h-64 object-cover"
                  />
                ) : (
                  <div className="h-44 bg-gradient-to-br from-navy-900 to-navy-800 text-sand-200 flex flex-col items-center justify-center gap-2">
                    <Luggage className="h-10 w-10 text-terracotta-400" />
                    <span className="text-xs font-semibold">
                      Verified Storage Hub — Photos Uploaded at Onboarding
                    </span>
                  </div>
                )}

                <div className="p-6 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="brand" size="sm">
                      {detail.city}
                    </Badge>
                    <Badge variant="success" size="sm">
                      Verified Partner Hub
                    </Badge>
                    {detail.acceptsOversized ? (
                      <Badge variant="neutral" size="sm">
                        Accepts Oversized Luggage
                      </Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">
                        Standard Bags Only
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-3xl font-extrabold text-navy-950">{detail.name}</h1>
                  <p className="text-sm text-sand-700 flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-terracotta-500 shrink-0" />
                    {detail.approximateArea}, {detail.city}
                  </p>
                </div>
              </>
            ) : (
              <div className="p-6 space-y-3">
                <LoadingSkeleton variant="text" className="w-1/2" />
                <LoadingSkeleton variant="text" className="w-1/3" />
              </div>
            )}
          </Card>

          {/* Description & Address Privacy */}
          <Card className="p-6 bg-white space-y-4">
            <h2 className="text-lg font-extrabold text-navy-950">About This Storage Facility</h2>
            {detail ? (
              <>
                <p className="text-sm text-sand-800 leading-relaxed">
                  {detail.description?.trim() ||
                    "Verified partner storage counter equipped for QR and 6-digit PIN custody handovers."}
                </p>

                {detail.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {detail.amenities.map((amenity) => (
                      <span
                        key={amenity}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sand-100 text-xs font-semibold text-navy-900"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        {formatAmenityLabel(amenity)}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <LoadingSkeleton variant="text" className="w-full" />
            )}

            <div className="rounded-xl bg-navy-50 border border-navy-200 p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-900">
                <ShieldCheck className="h-4 w-4 text-terracotta-600" />
                Privacy-Preserving Address Masking
              </div>
              <p className="text-sm text-navy-900">
                Approximate zone:{" "}
                <span className="font-semibold">
                  {detail ? `${detail.approximateArea}, ${detail.city}` : "Station corridor"}
                </span>
                . Exact street address, entry gate directions, and floor guidance unlock
                immediately after booking confirmation.
              </p>
            </div>
          </Card>

          {/* Operating Hours & Schedule Exceptions */}
          <Card className="p-6 bg-white space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-navy-950 flex items-center gap-2">
                <Clock className="h-5 w-5 text-terracotta-500" />
                Operating Hours
              </h2>
              {detail && (
                <span className="text-xs font-semibold text-sand-700">
                  {detail.is24Hours ? "Open 24 Hours" : detail.operatingHoursSummary} ({detail.timezone})
                </span>
              )}
            </div>

            {detail ? (
              sortedHours.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {sortedHours.map((entry) => (
                    <div
                      key={entry.dayOfWeek}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-sand-50 border border-sand-200"
                    >
                      <span className="font-bold text-navy-950">
                        {formatDayOfWeek(entry.dayOfWeek)}
                      </span>
                      {entry.isClosed ? (
                        <Badge variant="neutral" size="sm">
                          Closed
                        </Badge>
                      ) : (
                        <span className="font-mono text-navy-900">
                          {entry.openTime} – {entry.closeTime}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-sand-700">
                  Standard operating schedule: {detail.operatingHoursSummary}.
                </p>
              )
            ) : (
              <LoadingSkeleton className="h-24 w-full" />
            )}

            {detail && detail.upcomingExceptions.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                  <CalendarX2 className="h-4 w-4" />
                  Upcoming Holiday / Special Hours
                </div>
                <ul className="space-y-1 text-xs text-amber-950">
                  {detail.upcomingExceptions.map((ex, idx) => (
                    <li key={`${ex.exceptionDate}-${idx}`} className="flex flex-wrap gap-2">
                      <span className="font-mono font-bold">{ex.exceptionDate}</span>
                      <span>•</span>
                      <span>
                        {ex.exceptionType === "CLOSURE"
                          ? "Closed"
                          : `Modified hours ${ex.openTime ?? ""}–${ex.closeTime ?? ""}`}
                      </span>
                      {ex.reason && <span className="text-amber-800">({ex.reason})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Capacity Summary */}
          <Card className="p-6 bg-white space-y-3">
            <h2 className="text-lg font-extrabold text-navy-950 flex items-center gap-2">
              <Package className="h-5 w-5 text-terracotta-500" />
              Dedicated Storage Compartments
            </h2>
            {detail ? (
              <div className="space-y-3">
                <p className="text-sm text-sand-700">
                  {detail.capacitySummary.activePoolCount} configured storage{" "}
                  {detail.capacitySummary.activePoolCount === 1 ? "pool" : "pools"} with{" "}
                  <span className="font-bold text-navy-950">
                    {detail.capacitySummary.totalMaxCapacityUnits} maximum capacity units
                  </span>
                  . Live slot availability is checked against your exact drop-off and collection
                  window at checkout.
                </p>
                {detail.capacitySummary.supportedBagCategories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {detail.capacitySummary.supportedBagCategories.map((cat) => (
                      <Badge key={cat} variant="neutral" size="sm">
                        {formatBagCategoryLabel(cat)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <LoadingSkeleton variant="text" className="w-2/3" />
            )}
          </Card>
        </div>

        {/* Right Pricing Card & Reserve Action */}
        <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-4">
          <Card className="p-6 bg-white space-y-5 border-2 border-sand-200">
            <div>
              <h2 className="text-lg font-extrabold text-navy-950">Transparent LKR Pricing Card</h2>
              {detail?.pricingPolicy && (
                <p className="text-xs text-sand-700 mt-1">
                  Billed {formatPricingUnitLabel(detail.pricingPolicy.pricingUnit)} • Base rate{" "}
                  <span className="font-bold text-navy-950">
                    {formatLkrMinor(
                      detail.pricingPolicy.baseRateMinor,
                      detail.pricingPolicy.currency
                    )}
                  </span>
                </p>
              )}
            </div>

            {detail?.pricingPolicy && detail.pricingPolicy.tierRates.length > 0 ? (
              <div className="space-y-2 text-sm">
                {detail.pricingPolicy.tierRates.map((tier) => (
                  <div
                    key={tier.bagCategory}
                    className="flex items-center justify-between py-1.5 border-b border-sand-100 last:border-none"
                  >
                    <span className="font-semibold text-sand-800">
                      {formatBagCategoryLabel(tier.bagCategory)}
                    </span>
                    <span className="font-mono font-bold text-navy-950">
                      {formatLkrMinor(tier.rateMinor, detail.pricingPolicy!.currency)}
                    </span>
                  </div>
                ))}
              </div>
            ) : detail?.baseRateMinor ? (
              <div className="flex items-center justify-between py-2 border-y border-sand-200 text-sm">
                <span className="text-sand-700">Standard bag base rate</span>
                <span className="font-mono font-bold text-navy-950">
                  {formatLkrMinor(detail.baseRateMinor, detail.currency)}
                </span>
              </div>
            ) : (
              <p className="text-xs text-sand-700">
                Exact itemized storage fees and applicable taxes are calculated authoritatively on
                the checkout schedule screen.
              </p>
            )}

            <div className="rounded-xl bg-sand-50 border border-sand-200 p-3.5 text-xs text-sand-700 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-navy-950">
                <Scale className="h-3.5 w-3.5 text-terracotta-600" />
                Clear Policy Terms
              </div>
              <p>
                Free 100% refund when cancelled &gt;2h before drop-off; 50% refund within 2h before
                drop-off. Protected by ledger-backed marketplace settlement accountability.
              </p>
            </div>

            {detail && detail.bookingMode === "HOST_APPROVAL" && (
              <Alert variant="info">
                Host confirms space availability within 15 minutes before payment is collected.
              </Alert>
            )}

            {detail ? (
              <Link
                to={`/checkout/${detail.id}?${forwardScheduleQs}`}
                className="block w-full text-center px-4 py-3 rounded-xl bg-terracotta-500 text-white font-bold text-sm hover:bg-terracotta-600 transition-colors shadow-sm"
              >
                Book This Hub
              </Link>
            ) : (
              <Button type="button" variant="primary" disabled className="w-full">
                Book This Hub
              </Button>
            )}
          </Card>

          <Card className="p-4 bg-white text-xs text-sand-700 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Check-in requires your Digital Custody Pass QR or 6-digit backup PIN issued upon
              confirmation.
            </span>
          </Card>
        </div>
      </div>
    </div>
  );
}
