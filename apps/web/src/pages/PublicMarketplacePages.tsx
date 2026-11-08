import React, { useState, useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  MapPin,
  Shield,
  Clock,
  Star,
  Search,
  Briefcase,
  CheckCircle2,
  QrCode,
  ArrowRight,
  SlidersHorizontal,
  Camera,
  HelpCircle,
  Phone,
  Mail,
  FileText,
  Lock,
  Sparkles,
  AlertTriangle
} from "lucide-react";
import { MascotIllustration } from "@/components/ui/MascotIllustration";
import { ScreenHeaderBadge, DeferredBackendNotice } from "@/components/ui/DeferredBackendNotice";
import {
  DEMO_LOCATIONS,
  DEMO_BOOKINGS,
  REFUND_SEVEN_STAGES,
  formatLkr
} from "@/data/mock-marketplace";

// ============================================================================
// PW-001: Public Landing Page (/)
// ============================================================================
export function PublicLandingPage() {
  const navigate = useNavigate();
  const [cityQuery, setCityQuery] = useState("Colombo");
  const [bagCount, setBagCount] = useState(2);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/search?city=${encodeURIComponent(cityQuery)}&bags=${bagCount}`);
  };

  return (
    <div className="space-y-12" data-screen-id="PW-001">
      {/* Hero Section */}
      <section className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-6 sm:p-10 lg:p-12 shadow-xl overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-amber-300 font-mono text-xs font-bold border border-white/15">
            PW-001
          </span>
          <span className="px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-200 text-xs font-semibold border border-amber-400/30">
            Sri Lanka & Global Luggage Storage Network
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Explore Sri Lanka Hands-Free.{" "}
              <span className="text-amber-400">Verified Custody</span> at Every Transit Hub.
            </h1>
            <p className="text-slate-200 text-base sm:text-lg max-w-2xl leading-relaxed">
              Drop off your suitcases, backpacks, and surfboards with vetted partner hotels and
              concierge vaults near Colombo Fort, Ella, Kandy, Galle Fort, and CMB Airport.
              Protected by server-verified QR or backup PIN custody and tamper-evident seals.
            </p>

            {/* Quick Search Form */}
            <form
              onSubmit={handleSearch}
              className="bg-white text-slate-900 p-3 sm:p-4 rounded-2xl shadow-lg grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
            >
              <div className="sm:col-span-5 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                <MapPin className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1">
                  <label className="block text-[10px] font-bold uppercase text-slate-400">
                    City or Transit Hub
                  </label>
                  <select
                    aria-label="City or Transit Hub"
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none"
                  >
                    <option value="Colombo">Colombo Fort & Pettah</option>
                    <option value="Ella">Ella Railway & Nine Arch</option>
                    <option value="Kandy">Kandy Temple Quarter</option>
                    <option value="Galle">Galle Fort UNESCO Heritage</option>
                    <option value="Katunayake">CMB Airport (Katunayake)</option>
                  </select>
                </div>
              </div>

              <div className="sm:col-span-4 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                <Briefcase className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <label className="block text-[10px] font-bold uppercase text-slate-400">
                    Luggage Count
                  </label>
                  <select
                    aria-label="Luggage Count"
                    value={bagCount}
                    onChange={(e) => setBagCount(Number(e.target.value))}
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "Bag / Suitcase" : "Bags / Suitcases"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition"
                >
                  <Search className="h-4 w-4" />
                  <span>Find Storage</span>
                </button>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-6 pt-2 text-xs sm:text-sm text-slate-300">
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-emerald-400" />
                Up to LKR 250,000 Protection per Bag
              </span>
              <span className="flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-amber-400" />
                Cryptographic QR with 6-Digit PIN Fallback
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-blue-400" />
                15-Min Host Approval SLA
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col items-center justify-center gap-4">
            <div className="bg-white/95 text-slate-900 rounded-2xl p-5 shadow-lg border border-amber-200 max-w-sm w-full">
              <div className="flex items-center gap-4">
                <MascotIllustration mascot="wave" size="md" />
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    Ayubowan! Meet Kiri
                  </span>
                  <h2 className="font-bold text-base text-slate-900 mt-1">
                    Your Trusted Custody Companion
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    From Colombo Fort trains to Ella hikes, Kiri verifies every seal and handover.
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Rates starting from</span>
                <span className="font-extrabold text-blue-600 text-sm">LKR 140 / hour</span>
              </div>
            </div>

            <div className="bg-amber-50/95 text-slate-900 rounded-2xl p-4 shadow-md border border-amber-200 max-w-sm w-full flex items-center gap-3">
              <MascotIllustration mascot="king-coconut" size="sm" />
              <div className="text-xs">
                <p className="font-bold text-slate-900">Sip a King Coconut, Not Heavy Straps</p>
                <p className="text-slate-600 mt-0.5">
                  Free cancellation up to 24 hours before drop-off.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Sri Lankan Hubs */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Verified Storage Hubs Across Sri Lanka
            </h2>
            <p className="text-sm text-slate-600">
              Inspected partner locations with CCTV, tamper-evident seals, and instant QR check-in.
            </p>
          </div>
          <Link
            to="/search"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700"
          >
            <span>Explore All {DEMO_LOCATIONS.length} Hubs on Map</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DEMO_LOCATIONS.slice(0, 3).map((loc) => (
            <div
              key={loc.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                    {loc.city} • {loc.district}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                    {loc.rating} ({loc.reviewCount})
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{loc.name}</h3>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  {loc.landmark}
                </p>
                <p className="text-xs text-slate-600 mt-3 line-clamp-2">{loc.description}</p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="block text-[11px] text-slate-400 uppercase font-semibold">
                    Medium Suitcase
                  </span>
                  <span className="text-sm font-extrabold text-slate-900">
                    {formatLkr(loc.hourlyRateLkr.MEDIUM)}/hr{" "}
                    <span className="text-xs font-normal text-slate-500">
                      (Cap {formatLkr(loc.dailyCapLkr.MEDIUM)}/day)
                    </span>
                  </span>
                </div>
                <Link
                  to={`/locations/${loc.slug}`}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold transition"
                >
                  View Hub
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Surface Navigation Strip */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/how-it-works"
          className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-400 transition flex items-center gap-4"
        >
          <MascotIllustration mascot="suitcase-walk" size="sm" />
          <div>
            <span className="text-[11px] font-mono font-bold text-slate-400">PW-007</span>
            <h3 className="font-bold text-slate-900">How Custody Works</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              See our 4-step QR/PIN check-in, configurable photo evidence, and mandatory release protocol.
            </p>
          </div>
        </Link>

        <Link
          to="/become-a-host"
          className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-400 transition flex items-center gap-4"
        >
          <MascotIllustration mascot="high-five" size="sm" />
          <div>
            <span className="text-[11px] font-mono font-bold text-slate-400">PW-006</span>
            <h3 className="font-bold text-slate-900">Become a Host Partner</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Monetize unused hotel or shop space and keep 85% of every storage booking.
            </p>
          </div>
        </Link>

        <Link
          to="/portal/bookings"
          className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-400 transition flex items-center gap-4"
        >
          <MascotIllustration mascot="suitcase-hug" size="sm" />
          <div>
            <span className="text-[11px] font-mono font-bold text-slate-400">PW-011</span>
            <h3 className="font-bold text-slate-900">Traveller Booking Portal</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Access active QR passes, live in-storage status, and 7-stage refund tracking.
            </p>
          </div>
        </Link>
      </section>
    </div>
  );
}

// ============================================================================
// PW-002: Web Search & Discovery (/search)
// ============================================================================
export function WebSearchDiscoveryPage() {
  const [searchParams] = useSearchParams();
  const initialCity = searchParams.get("city") || "ALL";
  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [only24Hours, setOnly24Hours] = useState(false);
  const [onlyClimateControl, setOnlyClimateControl] = useState(false);
  const [selectedPinId, setSelectedPinId] = useState<string>(DEMO_LOCATIONS[0].id);

  const filteredLocations = useMemo(() => {
    return DEMO_LOCATIONS.filter((loc) => {
      if (selectedCity !== "ALL" && loc.city.toLowerCase() !== selectedCity.toLowerCase()) {
        return false;
      }
      if (only24Hours && !loc.is24Hours) return false;
      if (onlyClimateControl && !loc.hasClimateControl) return false;
      return true;
    });
  }, [selectedCity, only24Hours, onlyClimateControl]);

  return (
    <div className="space-y-6" data-screen-id="PW-002">
      <ScreenHeaderBadge
        screenId="PW-002"
        title="Geospatial Luggage Storage Discovery"
        subtitle="Filter verified Sri Lankan storage hubs by transit station, operating hours, and security amenities."
        workflows={["WF-007", "WF-008"]}
        roleScope="Public / Traveller"
        rightSlot={<MascotIllustration mascot="map" size="sm" caption="Interactive Map & List" />}
      />

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <SlidersHorizontal className="h-4 w-4 text-blue-600" />
            <span>Hub City:</span>
          </div>
          {["ALL", "Colombo", "Ella", "Kandy", "Galle", "Katunayake"].map((city) => (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                selectedCity.toLowerCase() === city.toLowerCase()
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {city === "ALL" ? "All Sri Lanka (5)" : city}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-slate-700">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={only24Hours}
              onChange={(e) => setOnly24Hours(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>24/7 Access Only</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyClimateControl}
              onChange={(e) => setOnlyClimateControl(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Climate-Controlled Vault</span>
          </label>
        </div>
      </div>

      {/* Split View: List & Interactive Map Canvas */}
      {filteredLocations.length === 0 ? (
        <MascotIllustration
          mascot="shrug"
          size="lg"
          variant="empty"
          badgeText="Zero Matching Locations"
          caption="No storage hubs matched all active filters. Try clearing the 24/7 or Climate-Control toggles."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            {filteredLocations.map((loc) => {
              const isSelected = loc.id === selectedPinId;
              return (
                <div
                  key={loc.id}
                  onClick={() => setSelectedPinId(loc.id)}
                  className={`bg-white rounded-2xl border p-5 transition cursor-pointer ${
                    isSelected
                      ? "border-blue-600 ring-2 ring-blue-100 shadow-md"
                      : "border-slate-200 hover:border-slate-300 shadow-sm"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold">
                          {loc.city}
                        </span>
                        {loc.is24Hours && (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-semibold">
                            24/7 Open
                          </span>
                        )}
                        {loc.hasClimateControl && (
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-xs font-semibold">
                            Climate Controlled
                          </span>
                        )}
                        <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-amber-400" />
                          {loc.rating} ({loc.reviewCount})
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">{loc.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{loc.landmark}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Approximate Area: {loc.addressMasked} (Exact street revealed after booking)
                      </p>
                    </div>

                    <div className="text-left sm:text-right flex-shrink-0">
                      <span className="text-xs text-slate-400 block">Medium Bag</span>
                      <span className="text-lg font-extrabold text-blue-600">
                        {formatLkr(loc.hourlyRateLkr.MEDIUM)}
                        <span className="text-xs font-normal text-slate-500">/hr</span>
                      </span>
                      <span className="block text-[11px] text-emerald-700 font-semibold mt-0.5">
                        {loc.availableCapacity} of {loc.totalCapacity} slots free
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span>Host: {loc.verifiedHost}</span>
                      <span>•</span>
                      <span>Hours: {loc.openHours}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/locations/${loc.slug}`}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold"
                      >
                        Details (PW-003)
                      </Link>
                      <Link
                        to={`/checkout/${loc.id}`}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                      >
                        Book Now (PW-004)
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive MapLibre Preview Canvas */}
          <div className="lg:col-span-5">
            <div className="sticky top-24 bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono uppercase text-amber-400 font-bold">
                    PostGIS + MapLibre Geospatial Preview
                  </span>
                  <h3 className="text-base font-bold">Sri Lanka Transit Corridor Map</h3>
                </div>
                <span className="text-xs bg-white/10 px-2.5 py-1 rounded-full">
                  {filteredLocations.length} Pins Active
                </span>
              </div>

              <div className="relative h-72 rounded-xl bg-gradient-to-b from-sky-950 via-slate-900 to-emerald-950 border border-white/10 p-4 flex flex-col justify-between overflow-hidden">
                <div className="grid grid-cols-2 gap-2">
                  {filteredLocations.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => setSelectedPinId(loc.id)}
                      className={`text-left p-2.5 rounded-xl border transition text-xs ${
                        selectedPinId === loc.id
                          ? "bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-md"
                          : "bg-slate-800/90 text-slate-200 border-white/10 hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{loc.city}</span>
                        <span>{formatLkr(loc.hourlyRateLkr.MEDIUM)}/h</span>
                      </div>
                      <p className="truncate text-[10px] opacity-80 mt-0.5">{loc.name}</p>
                    </button>
                  ))}
                </div>

                {(() => {
                  const activeLoc =
                    filteredLocations.find((l) => l.id === selectedPinId) || filteredLocations[0];
                  return (
                    <div className="bg-slate-950/90 border border-white/15 rounded-xl p-3 text-xs flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-amber-300">{activeLoc.name}</p>
                        <p className="text-slate-300 text-[11px]">
                          GPS: {activeLoc.coordinates.lat.toFixed(4)}° N,{" "}
                          {activeLoc.coordinates.lng.toFixed(4)}° E • {activeLoc.landmark}
                        </p>
                      </div>
                      <Link
                        to={`/locations/${activeLoc.slug}`}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold flex-shrink-0"
                      >
                        Inspect
                      </Link>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PW-003: Location Profile Detail (/locations/:slug)
// ============================================================================
export function LocationProfileDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const location =
    DEMO_LOCATIONS.find((l) => l.slug === slug || l.id === slug) || DEMO_LOCATIONS[0];
  const [hoursEstimate, setHoursEstimate] = useState(6);

  return (
    <div className="space-y-6" data-screen-id="PW-003">
      <ScreenHeaderBadge
        screenId="PW-003"
        title={location.name}
        subtitle={`${location.landmark} • Operated by ${location.verifiedHost}`}
        workflows={["WF-009"]}
        roleScope="Public / Traveller"
        rightSlot={
          <Link
            to={`/checkout/${location.id}`}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition"
          >
            <span>Book This Location (PW-004)</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">About This Verified Vault</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{location.description}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] text-slate-400 uppercase font-bold block">Hours</span>
                <span className="text-xs font-bold text-slate-900">{location.openHours}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] text-slate-400 uppercase font-bold block">
                  Protection
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  {formatLkr(location.insuranceLimitLkr)} / bag
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] text-slate-400 uppercase font-bold block">
                  Live Capacity
                </span>
                <span className="text-xs font-bold text-blue-700">
                  {location.availableCapacity} / {location.totalCapacity} slots open
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] text-slate-400 uppercase font-bold block">Rating</span>
                <span className="text-xs font-bold text-amber-600">
                  ★ {location.rating} ({location.reviewCount} reviews)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
              <Lock className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Privacy-Preserving Address Masking Active</p>
                <p className="mt-0.5">
                  Public Area: <strong>{location.addressMasked}</strong>. Exact building number and
                  concierge desk instructions are automatically unlocked on{" "}
                  <code className="font-mono">PW-005</code> and <code className="font-mono">TM-024</code>{" "}
                  upon booking confirmation.
                </p>
              </div>
            </div>
          </div>

          {/* Bag Tier Rate Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Transparent LKR Rate Card & Interactive Estimator
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-600">Duration: {hoursEstimate}h</span>
                <input
                  type="range"
                  min={1}
                  max={24}
                  value={hoursEstimate}
                  onChange={(e) => setHoursEstimate(Number(e.target.value))}
                  aria-label="Duration hours estimate"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(["SMALL", "MEDIUM", "LARGE", "OVERSIZED"] as const).map((tier) => {
                const hourly = location.hourlyRateLkr[tier];
                const cap = location.dailyCapLkr[tier];
                const raw = hourly * hoursEstimate;
                const effective = Math.min(raw, cap);
                return (
                  <div
                    key={tier}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1"
                  >
                    <span className="text-xs font-extrabold text-slate-900">{tier}</span>
                    <p className="text-xs text-slate-500">
                      {formatLkr(hourly)}/hr • Daily Cap {formatLkr(cap)}
                    </p>
                    <p className="text-sm font-extrabold text-blue-600 pt-1">
                      {hoursEstimate}h Est: {formatLkr(effective)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <MascotIllustration
            mascot="suitcase-hug"
            size="lg"
            variant="hero"
            badgeText="Verified Safe Custody (OQ-014)"
            caption={`Bag-count reconciliation, serialized tamper-evident tags, and configurable check-in photo evidence (${location.photoEvidencePolicy === "CONFIGURED_MANDATORY" ? "Mandatory at this location" : "Optional by default at this location"}).`}
          />

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Dedicated Storage Zones</h3>
            {location.zones.map((z) => (
              <div
                key={z.id}
                className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100"
              >
                <div>
                  <span className="font-mono font-bold text-blue-700">{z.code}</span>
                  <p className="text-slate-600">{z.name}</p>
                </div>
                <span className="font-semibold text-slate-700">
                  {z.capacity - z.occupied} / {z.capacity} free
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PW-004: Web Checkout & Schedule (/checkout/:locId)
// ============================================================================
export function WebCheckoutSchedulePage() {
  const { locId } = useParams<{ locId: string }>();
  const navigate = useNavigate();
  const location = DEMO_LOCATIONS.find((l) => l.id === locId) || DEMO_LOCATIONS[0];

  const [dropOffDate, setDropOffDate] = useState("2026-11-10T09:00");
  const [pickUpDate, setPickUpDate] = useState("2026-11-10T17:00");
  const [bags, setBags] = useState({ SMALL: 1, MEDIUM: 1, LARGE: 0, OVERSIZED: 0 });
  const [promoCode, setPromoCode] = useState("SLWELCOME10");

  const totalBags = bags.SMALL + bags.MEDIUM + bags.LARGE + bags.OVERSIZED;
  const subtotalLkr =
    bags.SMALL * location.dailyCapLkr.SMALL +
    bags.MEDIUM * location.dailyCapLkr.MEDIUM +
    bags.LARGE * location.dailyCapLkr.LARGE +
    bags.OVERSIZED * location.dailyCapLkr.OVERSIZED;
  const discountLkr = promoCode.toUpperCase() === "SLWELCOME10" ? Math.round(subtotalLkr * 0.1) : 0;
  const totalPayableLkr = Math.max(0, subtotalLkr - discountLkr);

  const adjustBag = (tier: keyof typeof bags, delta: number) => {
    setBags((prev) => ({
      ...prev,
      [tier]: Math.max(0, prev[tier] + delta)
    }));
  };

  return (
    <div className="space-y-6" data-screen-id="PW-004">
      <ScreenHeaderBadge
        screenId="PW-004"
        title="Web Checkout & Custody Schedule"
        subtitle={`Reserve atomic capacity slots at ${location.name} (${location.city})`}
        workflows={["WF-017", "WF-018"]}
        roleScope="Traveller"
        rightSlot={<MascotIllustration mascot="blank-tag" size="sm" caption="Transparent LKR Pricing" />}
      />

      <DeferredBackendNotice
        featureName="Atomic Capacity Lock & PayHere Checkout Session"
        targetPhase="Phase 4 Booking & Payment Backend"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">1. Drop-off & Pick-up Window</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Drop-off Date & Time (IST)
                </label>
                <input
                  type="datetime-local"
                  value={dropOffDate}
                  onChange={(e) => setDropOffDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pick-up Date & Time (IST)
                </label>
                <input
                  type="datetime-local"
                  value={pickUpDate}
                  onChange={(e) => setPickUpDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">2. Select Bag Categories & Quantities</h2>
            <div className="space-y-3">
              {(
                [
                  { key: "SMALL", label: "Small (Daypack, Laptop Bag, Handbag)" },
                  { key: "MEDIUM", label: "Medium (Cabin Suitcase, 40L Backpack)" },
                  { key: "LARGE", label: "Large (Checked 28-inch Roller Suitcase)" },
                  { key: "OVERSIZED", label: "Oversized (Surfboard, Golf Bag, Stroller)" }
                ] as const
              ).map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-500">
                      Daily Cap: {formatLkr(location.dailyCapLkr[item.key])}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => adjustBag(item.key, -1)}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold text-slate-700"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold text-sm">{bags[item.key]}</span>
                    <button
                      type="button"
                      onClick={() => adjustBag(item.key, 1)}
                      className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Price Breakdown (LKR)</h2>
            <div className="space-y-2 text-sm border-b border-slate-100 pb-4">
              <div className="flex justify-between text-slate-600">
                <span>Total Bags Selected</span>
                <span className="font-bold text-slate-900">{totalBags} Bags</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Storage Subtotal</span>
                <span className="font-semibold">{formatLkr(subtotalLkr)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Promo Code ({promoCode || "None"})</span>
                <span className="font-semibold">- {formatLkr(discountLkr)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Tamper-Evident Seals & Protection Guarantee</span>
                <span className="font-semibold text-emerald-700">Included</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Promo code"
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono uppercase"
              />
              <span className="text-xs text-emerald-700 font-bold">10% Applied</span>
            </div>

            <div className="flex justify-between items-baseline pt-2">
              <span className="text-base font-bold text-slate-900">Total Escrow Payable</span>
              <span className="text-2xl font-extrabold text-blue-600">
                {formatLkr(totalPayableLkr)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">
                Pre-Checkout Late Collection Policy Disclosure (OQ-015):
              </p>
              <p>{location.lateFeePolicyLabel}.</p>
              <p>
                <strong>No Silent Charges:</strong> Any overdue fee is requested in-app for your
                review and authorization—never auto-debited—and never blocks luggage return.
              </p>
            </div>

            <button
              type="button"
              disabled={totalBags === 0}
              onClick={() =>
                navigate(
                  `/booking/confirm?loc=${location.id}&total=${totalPayableLkr}&bags=${totalBags}`
                )
              }
              className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-sm shadow-md transition"
            >
              Proceed to Payment & Custody Token (PW-005)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PW-005: Web Payment & Confirmation (/booking/confirm)
// ============================================================================
export function WebPaymentConfirmationPage() {
  const [searchParams] = useSearchParams();
  const locId = searchParams.get("loc") || DEMO_LOCATIONS[0].id;
  const totalLkr = Number(searchParams.get("total") || 2115);
  const bagsCount = Number(searchParams.get("bags") || 2);
  const location = DEMO_LOCATIONS.find((l) => l.id === locId) || DEMO_LOCATIONS[0];
  const [simState, setSimState] = useState<"GATEWAY" | "POLLING" | "CONFIRMED">("CONFIRMED");

  return (
    <div className="space-y-6" data-screen-id="PW-005">
      <ScreenHeaderBadge
        screenId="PW-005"
        title="Web Payment & Custody Pass Confirmation"
        subtitle="PayHere payment status simulation and server-verified QR + 6-digit PIN fallback issuance (OQ-014)."
        workflows={["WF-019", "WF-020", "WF-021"]}
        roleScope="Traveller"
        rightSlot={
          <div className="flex items-center gap-2">
            {(["GATEWAY", "POLLING", "CONFIRMED"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setSimState(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  simState === st
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                State: {st}
              </button>
            ))}
          </div>
        }
      />

      <DeferredBackendNotice
        featureName="PayHere Webhook Verification & Custody Token Generation"
        targetPhase="Phase 4 Payment & Booking Engine"
      />

      {simState === "GATEWAY" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-xl mx-auto text-center space-y-4">
          <MascotIllustration
            mascot="phone"
            size="lg"
            badgeText="PayHere Checkout Sandbox Preview"
            caption="In production, travellers complete Visa/Mastercard/LankaQR authorization via PayHere."
          />
          <p className="text-lg font-bold text-slate-900">
            Amount to Authorize: {formatLkr(totalLkr)} ({bagsCount} Bags)
          </p>
          <button
            onClick={() => setSimState("CONFIRMED")}
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm"
          >
            Simulate PayHere Success Callback
          </button>
        </div>
      )}

      {simState === "POLLING" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-xl mx-auto text-center space-y-4">
          <MascotIllustration
            mascot="sitting-suitcase"
            size="lg"
            badgeText="Verifying Payment & 15m Host SLA"
            caption="Kiri is waiting for the cryptographic webhook signature and host confirmation."
          />
          <button
            onClick={() => setSimState("CONFIRMED")}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs"
          >
            View Confirmed Custody Pass
          </button>
        </div>
      )}

      {simState === "CONFIRMED" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
              <CheckCircle2 className="h-6 w-6 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">Booking Reference #LS-2026-8841 Confirmed</p>
                <p className="text-xs">
                  Exact street address unlocked: <strong>{location.addressExact}</strong>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2">
                <span className="text-[11px] font-mono uppercase text-amber-300 font-bold">
                  Cryptographic QR Payload
                </span>
                <div className="flex items-center gap-3">
                  <QrCode className="h-14 w-14 text-amber-400 flex-shrink-0" />
                  <div className="text-xs font-mono break-all text-slate-300">
                    LS-CUSTODY://LS-2026-8841/HMAC-9F8A72B
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                <span className="text-[11px] font-bold uppercase text-amber-800">
                  6-Digit PIN Fallback (When QR Scan Unavailable)
                </span>
                <p className="text-3xl font-mono font-extrabold tracking-widest text-slate-900">
                  482 910
                </p>
                <p className="text-xs text-slate-600">
                  Scan QR at counter, or use this rate-limited PIN fallback if camera scanning is unavailable.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <Link
                to="/portal/bookings"
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                Open Traveller Web Portal (PW-011)
              </Link>
              <Link
                to="/search"
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
              >
                Back to Discovery (PW-002)
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <MascotIllustration
              mascot="jump"
              size="lg"
              variant="hero"
              badgeText="Hands-Free Journey Ready!"
              caption="Kiri has locked in your capacity slot. At drop-off, staff verify QR (or PIN fallback), reconcile bag counts, and apply configurable photo evidence & seal tags!"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PW-006: Become a Host Landing (/become-a-host)
// ============================================================================
export function BecomeAHostLandingPage() {
  const [dailyBags, setDailyBags] = useState(18);
  const [avgRateLkr, setAvgRateLkr] = useState(1450);

  const grossMonthlyLkr = dailyBags * avgRateLkr * 30;
  const hostNetMonthlyLkr = Math.round(grossMonthlyLkr * 0.85);

  return (
    <div className="space-y-8" data-screen-id="PW-006">
      <ScreenHeaderBadge
        screenId="PW-006"
        title="Become a Verified Luggage Storage Host"
        subtitle="Turn unused hotel concierge rooms, retail backrooms, or station cafés into a recurring revenue stream."
        workflows={["WF-004"]}
        roleScope="Public / Prospective Host"
        rightSlot={<MascotIllustration mascot="high-five" size="sm" caption="85% Net Host Revenue Share" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
            Interactive Host Revenue Simulator (85% Net Payout / 15% Platform Commission)
          </span>
          <h2 className="text-2xl font-bold text-slate-900">
            Estimate Your Monthly Host Earnings in Sri Lanka
          </h2>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm font-bold text-slate-700 mb-1">
                <span>Average Bags Stored per Day</span>
                <span className="text-blue-600">{dailyBags} Bags / Day</span>
              </div>
              <input
                type="range"
                min={2}
                max={60}
                value={dailyBags}
                onChange={(e) => setDailyBags(Number(e.target.value))}
                className="w-full"
                aria-label="Average Bags Stored per Day"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm font-bold text-slate-700 mb-1">
                <span>Average Booking Value per Bag (LKR)</span>
                <span className="text-blue-600">{formatLkr(avgRateLkr)}</span>
              </div>
              <input
                type="range"
                min={800}
                max={3000}
                step={50}
                value={avgRateLkr}
                onChange={(e) => setAvgRateLkr(Number(e.target.value))}
                className="w-full"
                aria-label="Average Booking Value per Bag"
              />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-400 uppercase font-bold block">
                Projected Net Host Payout (85%)
              </span>
              <span className="text-3xl font-extrabold text-amber-400">
                {formatLkr(hostNetMonthlyLkr)}{" "}
                <span className="text-sm font-normal text-slate-300">/ month</span>
              </span>
              <p className="text-xs text-slate-400 mt-1">
                Gross Volume: {formatLkr(grossMonthlyLkr)} • Automated Weekly Bank Settlements
              </p>
            </div>
            <Link
              to="/host/dashboard"
              className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm text-center"
            >
              Launch Host Dashboard (HD-001)
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <MascotIllustration
            mascot="high-five"
            size="lg"
            variant="hero"
            badgeText="Partner With Kiri"
            caption="We supply tamper-evident security tags, QR scanner workflows, and LKR 250,000 protection coverage."
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PW-007: How It Works (/how-it-works)
// ============================================================================
export function HowItWorksPage() {
  const steps = [
    {
      step: "01",
      title: "Discover & Lock Atomic Capacity",
      desc: "Search verified hubs near railway stations, cultural sites, or airports. Your slot is reserved atomically in LKR.",
      icon: Search
    },
    {
      step: "02",
      title: "Server-Verified QR Check-In (with PIN Fallback) & Bag Reconciliation",
      desc: "Verify check-in via cryptographic QR scan—or rate-limited, audited 6-digit PIN fallback when QR scanning is unavailable. Staff reconcile bag counts, log staff ID & timestamps, and capture configurable photo evidence (OQ-014).",
      icon: Camera
    },
    {
      step: "03",
      title: "Explore Hands-Free with Live Custody Tracking",
      desc: "Track your bags in real time with storage zone codes and countdown reminders.",
      icon: Sparkles
    },
    {
      step: "04",
      title: "Verified Check-Out & Decoupled Mandatory Release (OQ-015 / BR-035)",
      desc: "Scan out to reconcile returned bag counts and release custody. Under OQ-015 & Invariant BR-035, luggage return and overdue fee settlement are strictly separate—hosts can never hold bags hostage, and any disclosed, configurable late fee is reviewed and paid in-app with no silent charges.",
      icon: Shield
    }
  ];

  return (
    <div className="space-y-8" data-screen-id="PW-007">
      <ScreenHeaderBadge
        screenId="PW-007"
        title="How Our Custody & Verification Protocol Works"
        subtitle="Engineered for cryptographic chain-of-custody, tamper-evident sealing, and traveller peace of mind."
        workflows={["WF-007", "WF-024", "WF-025"]}
        roleScope="Public"
        rightSlot={<MascotIllustration mascot="suitcase-walk" size="sm" caption="4-Step Chain of Custody" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.step} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-extrabold px-2.5 py-1 rounded bg-blue-50 text-blue-700">
                  STEP {s.step}
                </span>
                <Icon className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{s.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// PW-008: Help Centre & FAQs (/help)
// ============================================================================
export function HelpCentreFaqPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const faqs = [
    {
      q: "What happens if camera QR scanning is unavailable at the storage hub?",
      a: "Every confirmed booking includes a 6-digit numeric PIN fallback alongside the dynamic QR code (OQ-014). When QR scanning is unavailable, host staff use rate-limited server-side manual PIN verification, which is recorded in the custody audit log."
    },
    {
      q: "What is the cancellation and 7-stage refund policy?",
      a: "Cancellations made more than 24 hours before drop-off receive a 100% refund. Cancellations within 24 hours before drop-off receive a 50% refund. Every refund is tracked transparently across 7 settlement stages."
    },
    {
      q: "Can a host refuse to return my bag if I am late (overdue)?",
      a: "Never. Under OQ-015 and Platform Invariant BR-035 (No Possessory Lien), physical luggage return and overdue fee settlement are strictly separate. Hosts must immediately release your luggage upon QR/PIN verification using the Disputed Release Handover workflow (HM-028). Locations apply configurable grace periods and disclosed late collection fee policies (illustrative demo values: 30m–60m grace, 1.5x daily or hourly surcharge), which are requested in-app for traveller review and payment—never silently charged."
    },
    {
      q: "What items are prohibited from storage?",
      a: "Illegal substances, firearms, explosives, unsealed perishables, live animals, and unregistered high-value bullion/jewelry are strictly prohibited."
    }
  ];

  const filteredFaqs = faqs.filter(
    (f) =>
      f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" data-screen-id="PW-008">
      <ScreenHeaderBadge
        screenId="PW-008"
        title="Help Centre & Frequently Asked Questions"
        subtitle="Instant answers on custody seals, offline PINs, cancellations, and Sri Lanka transit hubs."
        workflows={["WF-039"]}
        roleScope="Public"
        rightSlot={<MascotIllustration mascot="thinking" size="sm" caption="Got a Question?" />}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
        <HelpCircle className="h-5 w-5 text-blue-600" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search FAQs (e.g. PIN, refund, overdue, prohibited)..."
          className="w-full text-sm focus:outline-none"
        />
      </div>

      <div className="space-y-4">
        {filteredFaqs.map((item, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <h3 className="font-bold text-slate-900 text-base">{item.q}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// PW-009: Contact Us & Inquiries (/contact)
// ============================================================================
export function ContactUsPage() {
  const [submitted, setSubmitted] = useState(false);
  const [subject, setSubject] = useState("Booking / Custody Inquiry");

  return (
    <div className="space-y-6" data-screen-id="PW-009">
      <ScreenHeaderBadge
        screenId="PW-009"
        title="Contact Us & 24/7 Operations Support Desk"
        subtitle="Direct escalation for active travellers, prospective hosts, and enterprise transit partners."
        workflows={["WF-039"]}
        roleScope="Public"
        rightSlot={<MascotIllustration mascot="phone" size="sm" caption="24/7 Colombo Support" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          {submitted ? (
            <div className="p-6 text-center space-y-3">
              <MascotIllustration
                mascot="jump"
                size="md"
                badgeText="Inquiry Logged (Preview #TKT-9042)"
                caption="Our Colombo Trust & Safety team responds to active custody inquiries within 15 minutes."
              />
              <button
                onClick={() => setSubmitted(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Topic</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option>Booking / Custody Inquiry</option>
                  <option>Host Partnership Onboarding</option>
                  <option>Refund or Payment Status</option>
                  <option>Urgent Overdue / Handover Assistance</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Your Email & Booking Reference (if applicable)
                </label>
                <input
                  type="email"
                  required
                  placeholder="traveller@example.com"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Message</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe how our team can help..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
              >
                Submit Support Inquiry
              </button>
            </form>
          )}
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 text-sm">
            <h3 className="font-bold text-slate-900">Colombo Operations Centre</h3>
            <p className="flex items-center gap-2 text-slate-600">
              <Phone className="h-4 w-4 text-blue-600" />
              <span>+94 11 234 5678 (24/7 Emergency Custody Hotline)</span>
            </p>
            <p className="flex items-center gap-2 text-slate-600">
              <Mail className="h-4 w-4 text-blue-600" />
              <span>support@luggagestorage.lk</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PW-010: Terms, Privacy & Legal (/terms)
// ============================================================================
export function TermsPrivacyLegalPage() {
  const [activeDoc, setActiveDoc] = useState<"TERMS" | "PRIVACY" | "CUSTODY">("TERMS");

  return (
    <div className="space-y-6" data-screen-id="PW-010">
      <ScreenHeaderBadge
        screenId="PW-010"
        title="Terms of Service, Privacy & Custody Legal Charter"
        subtitle="Binding platform policies governing luggage bailment, data protection, and Mandatory Release Invariant BR-035."
        workflows={["WF-001", "WF-027"]}
        roleScope="Public"
        rightSlot={<MascotIllustration mascot="salute" size="sm" caption="Compliance & Trust" />}
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "TERMS", label: "Marketplace Terms of Service" },
            { id: "PRIVACY", label: "Privacy & PDPA Compliance" },
            { id: "CUSTODY", label: "Custody & Mandatory Release Charter (BR-035)" }
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveDoc(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeDoc === tab.id
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 text-sm text-slate-700 leading-relaxed">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
          <FileText className="h-5 w-5 text-blue-600" />
          <span>
            {activeDoc === "TERMS" && "Section 1 — Global Marketplace Bailment & Booking Terms"}
            {activeDoc === "PRIVACY" &&
              "Section 2 — Personal Data Protection Act (Sri Lanka PDPA & GDPR) Notice"}
            {activeDoc === "CUSTODY" &&
              "Section 3 — Mandatory Luggage Release Invariant (BR-035) & Seal Integrity"}
          </span>
        </div>
        <p>
          All luggage storage bookings are governed by authoritative server-side QR verification
          (with rate-limited, audited 6-digit PIN fallback when QR scanning is unavailable),
          mandatory physical bag-count and category reconciliation, check-in/check-out timestamp
          and responsible staff ID logging, and configurable check-in photo evidence (optional by
          default; configurable as mandatory per location under <code className="font-mono">OQ-014</code>).
        </p>
        <p className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-medium">
          <strong>OQ-015 & Invariant BR-035 (Decoupled Custody & No Possessory Lien):</strong>{" "}
          Grace periods and late collection fee policies are configurable per location and must be
          disclosed prior to checkout. Additional charges are requested in-app for traveller review
          and payment authorization (no silent charges; cash at counter excluded). Storage hosts are
          strictly prohibited from retaining traveller luggage over unpaid or disputed overdue
          fees—physical luggage return and financial dispute resolution remain strictly separate and
          auditable (<code className="font-mono">HM-028</code>).
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// PW-011: Traveller Web Portal (/portal/bookings)
// ============================================================================
export function TravellerWebPortalPage() {
  const [tab, setTab] = useState<"ACTIVE" | "COMPLETED" | "REFUNDS">("ACTIVE");
  const [selectedBooking, setSelectedBooking] = useState(DEMO_BOOKINGS[0]);

  return (
    <div className="space-y-6" data-screen-id="PW-011">
      <ScreenHeaderBadge
        screenId="PW-011"
        title="Traveller Web Portal & Custody Pass Hub"
        subtitle="Manage active drop-offs, inspect tamper-evident seal numbers, and track 7-stage refund settlements."
        workflows={["WF-021", "WF-022", "WF-030", "WF-037"]}
        roleScope="Traveller"
        backendStatus="HYBRID_PREVIEW"
        rightSlot={<MascotIllustration mascot="suitcase-walk" size="sm" caption="Your Bookings" />}
      />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab("ACTIVE")}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${
            tab === "ACTIVE" ? "bg-blue-600 text-white" : "bg-white border border-slate-200"
          }`}
        >
          Active & Upcoming Custody (4)
        </button>
        <button
          onClick={() => setTab("COMPLETED")}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${
            tab === "COMPLETED" ? "bg-blue-600 text-white" : "bg-white border border-slate-200"
          }`}
        >
          Completed History & Reviews (1)
        </button>
        <button
          onClick={() => setTab("REFUNDS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${
            tab === "REFUNDS" ? "bg-blue-600 text-white" : "bg-white border border-slate-200"
          }`}
        >
          7-Stage Refund Tracker (1)
        </button>
      </div>

      {tab === "REFUNDS" ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                7-Stage Refund Progress — Booking #LS-2026-8799
              </h3>
              <p className="text-xs text-slate-500">
                Bandaranaike Airport (CMB) Transit Storage • Full Refund: {formatLkr(15980)}
              </p>
            </div>
            <MascotIllustration mascot="sitting-suitcase" size="sm" />
          </div>
          <div className="space-y-2.5">
            {REFUND_SEVEN_STAGES.map((st) => (
              <div
                key={st.stage}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                  st.completed
                    ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
                    : "bg-slate-50 border-slate-200 text-slate-500"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-white border font-mono font-bold flex items-center justify-center">
                    {st.stage}
                  </span>
                  <div>
                    <span className="font-bold">{st.label}</span>
                    <span className="ml-2 font-mono text-[10px] opacity-75">[{st.code}]</span>
                  </div>
                </div>
                <span className="font-mono">{st.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-3">
            {DEMO_BOOKINGS.map((b) => (
              <div
                key={b.id}
                onClick={() => setSelectedBooking(b)}
                className={`bg-white rounded-2xl border p-4 cursor-pointer transition ${
                  selectedBooking.id === b.id
                    ? "border-blue-600 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-blue-700">{b.reference}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800">
                    {b.status}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900">{b.locationName}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {b.totalBags} Bags • Total {formatLkr(b.totalAmountLkr)} • Zone {b.zoneCode}
                </p>
              </div>
            ))}
          </div>

          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-900 text-white">
                {selectedBooking.reference}
              </span>
              <span className="text-xs font-bold text-blue-600">{selectedBooking.status}</span>
            </div>
            <h3 className="font-bold text-lg text-slate-900">{selectedBooking.locationName}</h3>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">6-Digit Backup PIN:</span>
                <span className="font-mono font-extrabold text-base text-slate-900">
                  {selectedBooking.pinCode}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Zone:</span>
                <span className="font-mono font-bold">{selectedBooking.zoneCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tamper-Evident Seals:</span>
                <span className="font-mono">
                  {selectedBooking.sealIds.length > 0
                    ? selectedBooking.sealIds.join(", ")
                    : "Assigned at Check-In"}
                </span>
              </div>
            </div>
            {selectedBooking.status === "OVERDUE" && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span>
                  Overdue Collection Notice (OQ-015): Location configurable grace period
                  (illustrative 30m) elapsed. Review and pay any requested late fee in-app (no
                  silent charges). Protected by Invariant BR-035—unpaid or disputed fees never
                  prevent luggage return.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

