import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  MapPin,
  ShieldCheck,
  Search,
  Lock,
  QrCode,
  Camera,
  Clock,
  CheckCircle2,
  ArrowRight,
  Luggage,
  CalendarClock
} from "lucide-react";
import { DEMO_LOCATIONS, formatLkr } from "@/data/mock-marketplace";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { useAuthStore } from "@/store/useAuthStore";
import { useDiscoveryLocations } from "@/hooks/queries/use-discovery";
import {
  formatDateTimeDisplay,
  formatLkrMinor,
  getColomboDefaultSchedule
} from "@/lib/formatters";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { MascotIllustration } from "@/components/ui/MascotIllustration";
import { buildTravellerScheduleQuery } from "./traveller-utils";

const TRANSIT_CORRIDORS = [
  { label: "Colombo Fort & Pettah", city: "Colombo" },
  { label: "Kandy Station", city: "Kandy" },
  { label: "Ella Nine Arch", city: "Ella" },
  { label: "Galle Fort", city: "Galle" },
  { label: "Negombo Beach & Airport", city: "Negombo" }
];

type DurationPresetKey = "2h" | "full-day" | "multi-day";

const DURATION_PRESETS: Array<{
  key: DurationPresetKey;
  label: string;
  hours: number;
}> = [
  { key: "2h", label: "2h Quick Drop", hours: 2 },
  { key: "full-day", label: "Full Day", hours: 8 },
  { key: "multi-day", label: "Multi-Day", hours: 48 }
];

function computeColomboOffsetIso(baseIso: string, addHours: number): string {
  const baseMs = new Date(baseIso).getTime();
  if (Number.isNaN(baseMs)) return baseIso;
  const targetMs = baseMs + addHours * 3600_000;
  const colomboOffsetMs = 330 * 60_000;
  const shifted = new Date(targetMs + colomboOffsetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate()
  )}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:00+05:30`;
}

export function PublicLandingPage() {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { isAuthenticated } = useAuthStore();
  const isDemoMode = isDemoPreviewActive({
    allowDemoPreview: true,
    search: routeLocation.search,
    isAuthenticated
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "LuggageStorage Sri Lanka — Verified Custody & Short-Term Baggage Storage";
    }
  }, []);

  const [defaults] = useState(() => getColomboDefaultSchedule());
  const [cityQuery, setCityQuery] = useState("Colombo");
  const [durationPreset, setDurationPreset] = useState<DurationPresetKey>("full-day");
  const [mediumBags, setMediumBags] = useState(1);

  const dropOffIso = defaults.dropOffIso;
  const collectionIso = useMemo(() => {
    if (durationPreset === "full-day") return defaults.collectionIso;
    const preset = DURATION_PRESETS.find((p) => p.key === durationPreset);
    return computeColomboOffsetIso(defaults.dropOffIso, preset?.hours ?? 8);
  }, [defaults.collectionIso, defaults.dropOffIso, durationPreset]);

  const discoveryQuery = useDiscoveryLocations(
    { limit: 6, sortBy: "newest" },
    { enabled: !isDemoMode }
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qs = buildTravellerScheduleQuery({
      city: cityQuery.trim() || undefined,
      dropOffAt: dropOffIso,
      collectionAt: collectionIso,
      bags: { BAG_SMALL: 0, BAG_MEDIUM: mediumBags, BAG_LARGE: 0, BAG_OVERSIZED: 0 },
      preserveDemoPreview: isDemoMode
    });
    navigate(`/search?${qs}`);
  };

  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <section className="relative rounded-3xl bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-white overflow-hidden shadow-xl">
        <div className="px-6 py-12 sm:px-10 sm:py-16 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-terracotta-500/20 border border-terracotta-400/40 text-terracotta-200 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4 text-terracotta-400" />
              Verified Custody Across Sri Lanka
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Explore Sri Lanka Hands-Free
            </h1>
            <p className="text-sand-200 text-base sm:text-lg max-w-2xl leading-relaxed">
              Drop suitcases at verified station lounges, boutique hotels, and heritage transit
              hubs with QR + 6-digit PIN handover custody and serialized tamper-evident seals.
            </p>

            {/* Quick Search Bar with Duration Presets */}
            <form
              onSubmit={handleSearchSubmit}
              className="rounded-2xl bg-white text-navy-950 p-4 sm:p-5 shadow-lg space-y-3.5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <label
                    htmlFor="hero-city-input"
                    className="block text-xs font-bold text-sand-700 mb-1"
                  >
                    Destination or Transit Hub
                  </label>
                  <div className="relative">
                    <MapPin className="h-4 w-4 text-terracotta-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="hero-city-input"
                      type="text"
                      value={cityQuery}
                      onChange={(e) => setCityQuery(e.target.value)}
                      placeholder="Colombo, Kandy, Galle, Ella..."
                      className="w-full min-h-[44px] pl-9 pr-3 py-2.5 rounded-xl border border-sand-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label
                    htmlFor="hero-bags-select"
                    className="block text-xs font-bold text-sand-700 mb-1"
                  >
                    Standard Bags
                  </label>
                  <select
                    id="hero-bags-select"
                    value={mediumBags}
                    onChange={(e) => setMediumBags(Number(e.target.value))}
                    aria-label="Number of bags"
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-sand-300 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "Bag" : "Bags"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <Button type="submit" variant="primary" className="w-full min-h-[44px]">
                    <Search className="h-4 w-4" />
                    Find Storage
                  </Button>
                </div>
              </div>

              {/* Quick Schedule Presets */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-sand-200">
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Quick duration presets">
                  <span className="text-[11px] font-bold text-sand-700 mr-1 flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5 text-terracotta-600" />
                    Duration:
                  </span>
                  {DURATION_PRESETS.map((preset) => {
                    const active = durationPreset === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setDurationPreset(preset.key)}
                        className={`min-h-[36px] px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                          active
                            ? "bg-navy-900 text-white"
                            : "bg-sand-100 text-navy-900 hover:bg-sand-200"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[11px] font-medium text-sand-700">
                  {formatDateTimeDisplay(dropOffIso)} → {formatDateTimeDisplay(collectionIso)}
                </span>
              </div>
            </form>

            {/* Quick Corridor Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-sand-300 mr-1">Popular hubs:</span>
              {TRANSIT_CORRIDORS.map((corridor) => (
                <Link
                  key={corridor.city}
                  to={`/search?${buildTravellerScheduleQuery({
                    city: corridor.city,
                    dropOffAt: dropOffIso,
                    collectionAt: collectionIso,
                    bags: { BAG_MEDIUM: mediumBags },
                    preserveDemoPreview: isDemoMode
                  })}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/10 hover:bg-terracotta-500 text-white border border-white/15 transition-colors"
                >
                  {corridor.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col items-center gap-4">
            <div className="relative flex flex-col items-center">
              <MascotIllustration
                mascot="wave"
                size="2xl"
                variant="spotlight"
                badgeText="Verified Custody"
              />
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-sand-100 backdrop-blur-sm">
                  <QrCode className="h-3.5 w-3.5 text-terracotta-400" />
                  QR + 6-Digit PIN
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-sand-100 backdrop-blur-sm">
                  <Lock className="h-3.5 w-3.5 text-emerald-400" />
                  Tamper-Evident Seals
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Custody Trust Pillars */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-950">
            How Verified Luggage Custody Works
          </h2>
          <p className="text-sm text-sand-700 leading-relaxed">
            Every drop-off is backed by single-use QR credentials, mandatory release protections,
            and transparent LKR receipts from booking to collection.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 space-y-3 bg-white">
            <div className="w-11 h-11 rounded-2xl bg-terracotta-100 text-terracotta-700 flex items-center justify-center">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-extrabold text-navy-950">
              Serialized Tamper-Evident Seals
            </h3>
            <p className="text-sm text-sand-700 leading-relaxed">
              Partner hosts seal checked-in luggage at the counter and log custody events before bags
              enter designated storage zones.
            </p>
          </Card>

          <Card className="p-6 space-y-3 bg-white">
            <div className="w-11 h-11 rounded-2xl bg-navy-100 text-navy-800 flex items-center justify-center">
              <QrCode className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-extrabold text-navy-950">QR + Offline 6-Digit PIN</h3>
            <p className="text-sm text-sand-700 leading-relaxed">
              Single-use Digital Custody Passes include a scannable QR code plus a 6-digit backup
              PIN for areas with patchy mobile reception.
            </p>
          </Card>

          <Card className="p-6 space-y-3 bg-white">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Camera className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-extrabold text-navy-950">
              Privacy-Protected Hubs
            </h3>
            <p className="text-sm text-sand-700 leading-relaxed">
              Browse approximate station neighborhoods first; exact host door addresses and entry
              notes unlock immediately upon confirmation.
            </p>
          </Card>
        </div>
      </section>

      {/* Featured Hubs Section */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MascotIllustration mascot="sun-hat" size="xs" variant="bare" decorative />
            <div>
              <h2 className="text-2xl font-extrabold text-navy-950">
                Verified Storage Hubs Across Sri Lanka
              </h2>
              <p className="text-sm text-sand-700">
                Browse active partner storage points and compare transparent LKR rates.
              </p>
            </div>
          </div>
          <Link
            to={`/search?${buildTravellerScheduleQuery({
              dropOffAt: dropOffIso,
              collectionAt: collectionIso,
              bags: { BAG_MEDIUM: mediumBags },
              preserveDemoPreview: isDemoMode
            })}`}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-terracotta-600 hover:text-terracotta-700 min-h-[44px] px-2"
          >
            View All Hubs
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isDemoMode ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DEMO_LOCATIONS.slice(0, 3).map((loc) => (
              <Card key={loc.id} className="p-6 flex flex-col justify-between bg-white space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="brand" size="sm">
                      {loc.city}
                    </Badge>
                    <Badge variant="success" size="sm">
                      Demo Preview
                    </Badge>
                  </div>
                  <h3 className="text-lg font-extrabold text-navy-950">{loc.name}</h3>
                  <p className="text-xs text-sand-700">{loc.landmark}</p>
                </div>
                <div className="pt-4 border-t border-sand-200 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-sand-600">Standard Day Cap</p>
                    <p className="text-sm font-extrabold text-navy-950 tabular-nums">
                      {formatLkr(loc.dailyCapLkr.MEDIUM)}
                    </p>
                  </div>
                  <Link
                    to={`/locations/${loc.slug}?preview=demo`}
                    className="min-h-[44px] inline-flex items-center px-3.5 py-2 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800 transition-colors"
                  >
                    Inspect Hub
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        ) : discoveryQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[0, 1, 2].map((idx) => (
              <Card key={idx} className="p-6 space-y-3">
                <LoadingSkeleton className="h-44 w-full" />
                <LoadingSkeleton variant="text" className="w-2/3" />
                <LoadingSkeleton variant="text" className="w-1/2" />
              </Card>
            ))}
          </div>
        ) : discoveryQuery.isError ? (
          <Alert variant="danger" title="Unable to Load Featured Hubs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {discoveryQuery.error instanceof Error
                  ? discoveryQuery.error.message
                  : "Network error contacting discovery API."}
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
          <Card className="p-8 text-center space-y-3 bg-white">
            <MascotIllustration mascot="king-coconut" size="lg" variant="bare" decorative />
            <h3 className="text-lg font-extrabold text-navy-950">
              Launching soon across Sri Lanka transit corridors
            </h3>
            <p className="text-sm text-sand-700 max-w-lg mx-auto">
              Partner hosts are completing physical verification and counter onboarding. Search by
              schedule or check back shortly.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {discoveryQuery.data.locations.slice(0, 6).map((loc) => (
              <Card key={loc.id} className="overflow-hidden flex flex-col justify-between bg-white">
                <div>
                  {loc.primaryImageUrl ? (
                    <img
                      src={loc.primaryImageUrl}
                      alt={loc.name}
                      className="h-44 w-full object-cover bg-sand-100"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-44 w-full bg-gradient-to-br from-sand-100 to-sand-200 flex items-center justify-center text-sand-500">
                      <Luggage className="h-8 w-8" />
                    </div>
                  )}
                  <div className="p-5 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="brand" size="sm">
                        {loc.city}
                      </Badge>
                      <Badge
                        variant={loc.bookingMode === "INSTANT" ? "success" : "info"}
                        size="sm"
                      >
                        {loc.bookingMode === "INSTANT" ? "Instant" : "Approval"}
                      </Badge>
                      {loc.acceptsOversized && (
                        <Badge variant="neutral" size="sm">
                          Oversized OK
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-extrabold text-navy-950 line-clamp-1">
                      {loc.name}
                    </h3>
                    <p className="text-xs text-sand-700 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-terracotta-500 shrink-0" />
                      {loc.approximateArea}
                    </p>
                    <p className="text-xs text-sand-600 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-navy-700 shrink-0" />
                      {loc.is24Hours
                        ? "Open 24 Hours"
                        : loc.operatingHoursSummary ?? "Operating hours not configured"}
                    </p>
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-sand-200 flex items-center justify-between gap-2 bg-sand-50/50">
                  <div>
                    <p className="text-[11px] text-sand-600">Standard rate from</p>
                    <p className="text-sm font-extrabold text-navy-950 tabular-nums">
                      {loc.baseRateMinor
                        ? formatLkrMinor(loc.baseRateMinor, loc.currency)
                        : "Live quote at checkout"}
                    </p>
                  </div>
                  <Link
                    to={`/locations/${loc.id}?${buildTravellerScheduleQuery({
                      dropOffAt: dropOffIso,
                      collectionAt: collectionIso,
                      bags: { BAG_MEDIUM: mediumBags }
                    })}`}
                    className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800 transition-colors"
                  >
                    Details
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Bottom Partner Strip */}
      <section className="rounded-2xl border border-sand-200 bg-white p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-terracotta-600">
            <CheckCircle2 className="h-4 w-4" />
            Host Partner Network
          </div>
          <h3 className="text-xl font-extrabold text-navy-950">
            Operate a secure counter near a station or tourist corridor?
          </h3>
          <p className="text-sm text-sand-700">
            Join verified Sri Lankan hotels and transit businesses earning predictable luggage custody
            revenue.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/become-a-host"
            className="min-h-[44px] inline-flex items-center px-5 py-2.5 rounded-xl bg-terracotta-500 text-white text-sm font-bold hover:bg-terracotta-600 transition-colors"
          >
            Become a Host Partner
          </Link>
          <Link
            to="/how-it-works"
            className="min-h-[44px] inline-flex items-center px-5 py-2.5 rounded-xl border border-sand-300 text-navy-900 text-sm font-bold hover:bg-sand-100 transition-colors"
          >
            Read Custody Charter
          </Link>
        </div>
      </section>
    </div>
  );
}
