import React, { useState, useMemo, useEffect } from "react";
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
  Phone,
  Mail,
  FileText,
  Lock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Printer,
  Check,
  Info,
  X
} from "lucide-react";
import {
  Button,
  Badge,
  Alert,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  MascotIllustration
} from "@/components/ui";
import { useAuthStore } from "@/store/useAuthStore";
import { marketplaceApi } from "@/services/marketplace-api";
import { PublicStorageLocation } from "@luggage-storage/contracts";
import {
  DEMO_LOCATIONS,
  DEMO_BOOKINGS,
  REFUND_SEVEN_STAGES,
  formatLkr,
  DemoBookingRecord,
  StorageLocationItem
} from "@/data/mock-marketplace";

function mapPublicLocationToItem(loc: PublicStorageLocation): StorageLocationItem {
  const baseRate = Math.round((loc.baseRateMinor ?? 15000) / 100);
  return {
    id: loc.id,
    slug: loc.id,
    name: loc.name,
    city: loc.city,
    district: loc.approximateArea || loc.city,
    landmark: loc.approximateArea || `${loc.city} Central Zone`,
    distanceKm: (loc.distanceMeters ?? 1000) / 1000,
    rating: loc.averageRating,
    reviewCount: loc.reviewCount,
    verifiedHost: "Verified Host Partner",
    openHours: loc.operatingHoursSummary,
    is24Hours: loc.is24Hours,
    hasCctv: loc.amenities.includes("CCTV"),
    hasClimateControl: loc.amenities.includes("AIR_CONDITIONING"),
    hasInsurance: true,
    insuranceLimitLkr: 250000,
    photoEvidencePolicy: "OPTIONAL_BY_DEFAULT",
    gracePeriodMinutes: 30,
    lateFeePolicyLabel: "Standard Tier LKR 300 / hr",
    hourlyRateLkr: {
      SMALL: Math.round(baseRate * 0.7),
      MEDIUM: baseRate,
      LARGE: Math.round(baseRate * 1.5),
      OVERSIZED: Math.round(baseRate * 2.0)
    },
    dailyCapLkr: {
      SMALL: Math.round(baseRate * 0.7 * 8),
      MEDIUM: baseRate * 8,
      LARGE: Math.round(baseRate * 1.5 * 8),
      OVERSIZED: Math.round(baseRate * 2.0 * 8)
    },
    totalCapacity: 50,
    availableCapacity: 45,
    coordinates: {
      lat: loc.approximateLatitude,
      lng: loc.approximateLongitude
    },
    addressMasked: loc.approximateArea,
    addressExact: `${loc.approximateArea} (Revealed upon confirmed booking per OQ-012)`,
    zones: [{ id: "z1", code: "Z1", name: "Main Storage Room", capacity: 50, occupied: 5 }],
    description: loc.description || "Secure, convenient storage facility in Sri Lanka."
  };
}

// ============================================================================
// PW-001: Public Landing Page (/)
// ============================================================================
export function PublicLandingPage() {
  const navigate = useNavigate();
  const [selectedCity, setSelectedCity] = useState("Colombo");
  const [bagCount, setBagCount] = useState(2);
  const [dropDate, setDropDate] = useState("2026-11-10");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(
      `/search?city=${encodeURIComponent(selectedCity)}&date=${dropDate}&bags=${bagCount}`
    );
  };

  const featuredHubs = useMemo(() => DEMO_LOCATIONS.slice(0, 3), []);

  return (
    <div className="space-y-16 sm:space-y-20">
      {/* Hospitality Hero Section */}
      <section className="relative rounded-3xl bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 text-white p-6 sm:p-10 lg:p-14 shadow-xl overflow-hidden border border-navy-800">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 rounded-full bg-terracotta-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-20 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-sand-200 text-xs font-semibold backdrop-blur-sm border border-white/15">
              <span className="w-2 h-2 rounded-full bg-terracotta-400 animate-pulse" />
              <span>Sri Lanka Verified Luggage Custody Network</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Explore Sri Lanka Hands-Free.{" "}
              <span className="text-terracotta-400">Verified Custody</span> at Every Transit Hub.
            </h1>

            <p className="text-sand-200 text-base sm:text-lg max-w-2xl leading-relaxed">
              Drop off your backpacks, suitcases, and surfboards with inspected partner hotels and
              concierge vaults near Colombo Fort, Ella, Kandy, Galle Fort, and CMB Airport. Protected
              by tamper-evident serialized seals and covered up to LKR 250,000.
            </p>

            {/* Intuitive Search Bar Card */}
            <form
              onSubmit={handleSearchSubmit}
              className="bg-white text-navy-950 p-3 sm:p-4 rounded-2xl shadow-xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-center border border-sand-200"
            >
              <div className="sm:col-span-5 flex items-center gap-3 px-3 py-2 rounded-xl bg-sand-50 border border-sand-200">
                <MapPin className="h-5 w-5 text-terracotta-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-sand-600">
                    City or Station Hub
                  </label>
                  <select
                    aria-label="City or Station Hub"
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full bg-transparent text-sm font-semibold text-navy-900 focus:outline-none truncate"
                  >
                    <option value="Colombo">Colombo Fort & Pettah</option>
                    <option value="Ella">Ella Railway & Nine Arch</option>
                    <option value="Kandy">Kandy Temple Quarter</option>
                    <option value="Galle">Galle Fort UNESCO Heritage</option>
                    <option value="Katunayake">CMB Airport (Katunayake)</option>
                  </select>
                </div>
              </div>

              <div className="sm:col-span-3 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-sand-50 border border-sand-200">
                <Clock className="h-5 w-5 text-sand-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-sand-600">
                    Storage Date
                  </label>
                  <input
                    type="date"
                    value={dropDate}
                    onChange={(e) => setDropDate(e.target.value)}
                    className="w-full bg-transparent text-sm font-semibold text-navy-900 focus:outline-none"
                    aria-label="Storage Date"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-sand-50 border border-sand-200">
                <Briefcase className="h-5 w-5 text-navy-700 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-sand-600">
                    Bags
                  </label>
                  <select
                    aria-label="Luggage Items"
                    value={bagCount}
                    onChange={(e) => setBagCount(Number(e.target.value))}
                    className="w-full bg-transparent text-sm font-semibold text-navy-900 focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm:col-span-3">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center shadow-md font-bold text-sm"
                >
                  <Search className="h-4 w-4 mr-2" />
                  <span>Find Storage</span>
                </Button>
              </div>
            </form>

            {/* Trust Reassurance Badges */}
            <div className="flex flex-wrap items-center gap-6 pt-2 text-xs sm:text-sm text-sand-300">
              <span className="flex items-center gap-2 font-medium">
                <Shield className="h-4 w-4 text-emerald-400" />
                LKR 250,000 Protection / Bag
              </span>
              <span className="flex items-center gap-2 font-medium">
                <QrCode className="h-4 w-4 text-amber-300" />
                Cryptographic QR & Offline PIN
              </span>
              <span className="flex items-center gap-2 font-medium">
                <Clock className="h-4 w-4 text-sky-300" />
                Immediate Counter Release
              </span>
            </div>
          </div>

          {/* Right Mascot Hero Card */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center gap-4">
            <div className="bg-white/95 text-navy-900 rounded-3xl p-6 shadow-2xl border border-sand-200/80 max-w-md w-full backdrop-blur-md">
              <div className="flex items-center gap-5">
                <MascotIllustration mascot="wave" size="md" />
                <div className="space-y-1">
                  <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-terracotta-800 bg-terracotta-100 px-2.5 py-0.5 rounded-full">
                    Ayubowan! Meet Kiri
                  </span>
                  <h2 className="font-bold text-lg text-navy-950">
                    Your Travel Custody Companion
                  </h2>
                  <p className="text-xs text-sand-700 leading-relaxed">
                    From scenic Colombo-Badulla trains to coastal Galle walks, Kiri ensures every
                    bag is sealed and protected.
                  </p>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-sand-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-sand-700">Storage rates from</span>
                <span className="font-extrabold text-terracotta-700 text-base">
                  LKR 140 <span className="text-xs font-normal text-sand-600">/ hour</span>
                </span>
              </div>
            </div>

            <div className="bg-sand-50/90 text-navy-900 rounded-2xl p-4 shadow-sm border border-sand-200/60 max-w-md w-full flex items-center gap-4">
              <MascotIllustration mascot="king-coconut" size="sm" />
              <div className="text-xs">
                <p className="font-bold text-navy-900">Sip King Coconut, Don't Haul Straps</p>
                <p className="text-sand-700 mt-0.5">
                  100% full refund on cancellations made at least 24 hours prior to scheduled drop-off.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Sri Lankan Transit Hubs */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
              Verified Storage Hubs Across Sri Lanka
            </h2>
            <p className="text-sm sm:text-base text-sand-700 mt-1">
              Inspected hotel desks and vaults equipped with CCTV, serialized tamper-evident seals,
              and 1-tap QR check-in.
            </p>
          </div>
          <Link
            to="/search"
            className="inline-flex items-center gap-2 text-sm font-bold text-terracotta-700 hover:text-terracotta-800 transition"
          >
            <span>Explore All {DEMO_LOCATIONS.length} Hubs on Map</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredHubs.map((loc) => (
            <Card
              key={loc.id}
              className="flex flex-col justify-between hover:border-sand-300 transition shadow-sm group"
            >
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="brand">{loc.city}</Badge>
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    <span>{loc.rating !== null ? loc.rating.toFixed(1) : "New"}</span>
                    <span className="text-sand-600 font-normal">({loc.reviewCount})</span>
                  </span>
                </div>
                <CardTitle className="text-lg group-hover:text-terracotta-700 transition">
                  {loc.name}
                </CardTitle>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <MapPin className="h-3.5 w-3.5 text-sand-500 flex-shrink-0" />
                  <span className="truncate">{loc.landmark}</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-[11px] text-sand-700">
                  <span className="px-2 py-1 rounded bg-sand-100 font-medium">
                    {loc.is24Hours ? "24/7 Access" : loc.openHours}
                  </span>
                  <span className="px-2 py-1 rounded bg-sand-100 font-medium">
                    {loc.hasClimateControl ? "Climate Controlled" : "Secure Ventilated"}
                  </span>
                  <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                    {loc.availableCapacity} slots available
                  </span>
                </div>
                <div className="pt-2 border-t border-sand-100 flex items-baseline justify-between">
                  <span className="text-xs text-sand-600">Standard Bag Rate</span>
                  <div>
                    <span className="text-lg font-extrabold text-navy-950">
                      {formatLkr(loc.hourlyRateLkr.MEDIUM)}
                    </span>
                    <span className="text-xs text-sand-600"> / hr</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="gap-2">
                <Link to={`/locations/${loc.slug}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full justify-center">
                    Inspect
                  </Button>
                </Link>
                <Link to={`/checkout/${loc.id}`} className="flex-1">
                  <Button variant="primary" size="sm" className="w-full justify-center">
                    Book Now
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      {/* 4-Step Chain of Custody */}
      <section className="bg-sand-50 rounded-3xl p-8 sm:p-12 border border-sand-200/80 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <Badge variant="brand">Cryptographic Security & Trust</Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-950">
            How Verified Luggage Custody Works
          </h2>
          <p className="text-sm text-sand-700">
            Engineered for complete transparency: from online reservation to tamper-evident seals and
            guaranteed counter release.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              step: "01",
              title: "Discover & Reserve",
              desc: "Choose a verified hotel or station vault near your destination. Lock in guaranteed capacity in LKR.",
              icon: Search
            },
            {
              step: "02",
              title: "Drop Off & Seal",
              desc: "Show your QR code or 6-digit PIN. Staff apply serialized tamper-evident tags and capture check-in photos.",
              icon: Camera
            },
            {
              step: "03",
              title: "Explore Unburdened",
              desc: "Climb Little Adam's Peak, visit the Sacred Tooth Temple, or catch a beach sunset without heavy baggage.",
              icon: Sparkles
            },
            {
              step: "04",
              title: "Immediate Pick-Up",
              desc: "Return and scan your QR code. Your bags are released immediately without possessory liens or hidden surcharges.",
              icon: Shield
            }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="bg-white rounded-2xl p-6 border border-sand-200/80 shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-extrabold text-terracotta-700 bg-terracotta-100 px-2.5 py-1 rounded-md">
                      {`STEP ${item.step}`}
                    </span>
                    <Icon className="h-5 w-5 text-navy-700" />
                  </div>
                  <h3 className="font-bold text-base text-navy-950">{item.title}</h3>
                  <p className="text-xs text-sand-700 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust & Guarantee Pillar */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-6">
          <Badge variant="success">Traveller Protection Charter</Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-950 leading-tight">
            Your Belongings Are Never Held Hostage. Ever.
          </h2>
          <div className="space-y-4 text-sm text-sand-700 leading-relaxed">
            <p>
              Under our platform's <strong>Decoupled Mandatory Release Invariant</strong>, luggage
              return and billing disputes are strictly separate. Even if your train is delayed or
              arrival is overdue, our partner hosts are legally and contractually obligated to release
              your bags promptly upon QR or PIN verification.
            </p>
            <p>
              Any overdue fees or overtime surcharges are reviewed and authorized in-app with
              complete transparency—never extorted at the physical counter and never charged
              silently.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-white border border-sand-200 shadow-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mb-1" />
              <h4 className="font-bold text-sm text-navy-900">Serialized Security Seals</h4>
              <p className="text-xs text-sand-600 mt-0.5">
                Every zipper is secured with a tamper-evident numbered tag at check-in.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white border border-sand-200 shadow-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mb-1" />
              <h4 className="font-bold text-sm text-navy-900">LKR 250,000 Bailment Shield</h4>
              <p className="text-xs text-sand-600 mt-0.5">
                Comprehensive platform protection for damage or loss during custody.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 flex justify-center">
          <MascotIllustration
            mascot="suitcase-walk"
            size="lg"
            variant="hero"
            badgeText="Verified Custody Guarantee"
            caption="Travel Sri Lanka hands-free while vetted partners protect your luggage."
          />
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// PW-002: Web Search & Discovery (/search)
// ============================================================================
export function WebSearchDiscoveryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCity = searchParams.get("city") || "ALL";

  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [only24Hours, setOnly24Hours] = useState(false);
  const [onlyClimateControl, setOnlyClimateControl] = useState(false);
  const [sortBy, setSortBy] = useState<"RECOMMENDED" | "PRICE_ASC" | "RATING_DESC">("RECOMMENDED");
  const [selectedPinId, setSelectedPinId] = useState<string>(DEMO_LOCATIONS[0].id);
  const [liveLocations, setLiveLocations] = useState<PublicStorageLocation[]>([]);

  // Sync state if query changes
  useEffect(() => {
    const qCity = searchParams.get("city");
    if (qCity && qCity !== selectedCity) {
      setSelectedCity(qCity);
    }
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;
    async function fetchLive() {
      try {
        const res = await marketplaceApi.searchLocations({
          city: selectedCity !== "ALL" ? selectedCity : undefined,
          radiusMeters: 15000,
          amenities: [],
          page: 1,
          limit: 20
        });
        if (isMounted && res.locations) {
          setLiveLocations(res.locations);
        }
      } catch {
        // Fallback silently to mock demo state
      }
    }
    fetchLive();
    return () => { isMounted = false; };
  }, [selectedCity]);

  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev);
      if (city === "ALL") {
        updated.delete("city");
      } else {
        updated.set("city", city);
      }
      return updated;
    });
  };

  const filteredLocations = useMemo(() => {
    if (liveLocations.length > 0) {
      return liveLocations.map(mapPublicLocationToItem);
    }

    const list = DEMO_LOCATIONS.filter((loc) => {
      if (selectedCity !== "ALL" && loc.city.toLowerCase() !== selectedCity.toLowerCase()) {
        return false;
      }
      if (only24Hours && !loc.is24Hours) return false;
      if (onlyClimateControl && !loc.hasClimateControl) return false;
      return true;
    });

    if (sortBy === "PRICE_ASC") {
      list.sort((a, b) => a.hourlyRateLkr.MEDIUM - b.hourlyRateLkr.MEDIUM);
    } else if (sortBy === "RATING_DESC") {
      list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    }
    return list;
  }, [liveLocations, selectedCity, only24Hours, onlyClimateControl, sortBy]);

  const activeSelectedLocation =
    filteredLocations.find((l) => l.id === selectedPinId) || filteredLocations[0];

  return (
    <div className="space-y-6">
      {/* Header Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
          Find Luggage Storage in Sri Lanka
        </h1>
        <p className="text-sm text-sand-700 mt-1">
          Explore vetted storage hubs near railway corridors, bus stations, and airport terminals.
        </p>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white rounded-2xl border border-sand-200 p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-navy-900 flex items-center gap-1.5 mr-1">
              <SlidersHorizontal className="h-4 w-4 text-terracotta-600" />
              <span>City:</span>
            </span>
            {["ALL", "Colombo", "Ella", "Kandy", "Galle", "Katunayake"].map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => handleCityChange(city)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition min-h-[36px] ${
                  selectedCity.toLowerCase() === city.toLowerCase()
                    ? "bg-navy-900 text-white shadow-sm"
                    : "bg-sand-100 text-sand-800 hover:bg-sand-200"
                }`}
              >
                {city === "ALL" ? "All Sri Lanka" : city}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-sand-700">Sort by:</label>
            <select
              aria-label="Sort by"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "RECOMMENDED" | "PRICE_ASC" | "RATING_DESC")
              }
              className="bg-sand-50 border border-sand-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-navy-900 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
            >
              <option value="RECOMMENDED">Recommended</option>
              <option value="PRICE_ASC">Lowest Price (LKR)</option>
              <option value="RATING_DESC">Highest Rated</option>
            </select>
          </div>
        </div>

        <div className="pt-3 border-t border-sand-100 flex flex-wrap items-center gap-6 text-xs font-medium text-sand-800">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={only24Hours}
              onChange={(e) => setOnly24Hours(e.target.checked)}
              className="rounded border-sand-300 text-terracotta-600 focus:ring-terracotta-500 h-4 w-4"
            />
            <span>24/7 Access Only</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyClimateControl}
              onChange={(e) => setOnlyClimateControl(e.target.checked)}
              className="rounded border-sand-300 text-terracotta-600 focus:ring-terracotta-500 h-4 w-4"
            />
            <span>Climate-Controlled Vault</span>
          </label>
          <span className="text-sand-600 ml-auto font-semibold">
            {filteredLocations.length}{" "}
            {filteredLocations.length === 1 ? "hub available" : "hubs available"}
          </span>
        </div>
      </div>

      {/* Split View: Listings & Interactive Transit Corridor Map */}
      {filteredLocations.length === 0 ? (
        <div className="bg-white rounded-3xl border border-sand-200 p-12 text-center space-y-4 max-w-lg mx-auto">
          <MascotIllustration
            mascot="shrug"
            size="lg"
            variant="empty"
            badgeText="Zero Matching Hubs"
            caption="No storage locations matched your current filters. Try resetting the 24/7 or Climate-Control filters."
          />
          <Button
            variant="outline"
            onClick={() => {
              setSelectedCity("ALL");
              setOnly24Hours(false);
              setOnlyClimateControl(false);
            }}
          >
            Reset All Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Location Cards List */}
          <div className="lg:col-span-7 space-y-4">
            {filteredLocations.map((loc) => {
              const isSelected = loc.id === selectedPinId;
              return (
                <div
                  key={loc.id}
                  onClick={() => setSelectedPinId(loc.id)}
                  className={`bg-white rounded-2xl border p-5 transition cursor-pointer ${
                    isSelected
                      ? "border-terracotta-500 ring-2 ring-terracotta-100 shadow-md"
                      : "border-sand-200 hover:border-sand-300 shadow-sm"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="brand">{loc.city}</Badge>
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                          <span>{loc.rating !== null ? loc.rating.toFixed(1) : "New"}</span>
                          <span className="text-sand-600 font-normal">({loc.reviewCount})</span>
                        </span>
                        {loc.is24Hours && (
                          <Badge variant="success" dot>
                            24/7 Open
                          </Badge>
                        )}
                      </div>

                      <h3 className="font-bold text-lg text-navy-950 hover:text-terracotta-700 transition">
                        {loc.name}
                      </h3>

                      <p className="text-xs text-sand-700 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-sand-500 flex-shrink-0" />
                        <span>{loc.landmark}</span>
                      </p>

                      <p className="text-[11px] text-sand-600 pt-0.5">
                        Area: {loc.addressMasked}{" "}
                        <span className="text-sand-500 italic">
                          (Exact street address unlocked upon booking)
                        </span>
                      </p>
                    </div>

                    <div className="text-left sm:text-right flex-shrink-0">
                      <span className="text-xs text-sand-600 block">Standard Bag</span>
                      <span className="text-xl font-extrabold text-navy-950">
                        {formatLkr(loc.hourlyRateLkr.MEDIUM)}
                        <span className="text-xs font-normal text-sand-600"> / hr</span>
                      </span>
                      <span className="block text-[11px] text-emerald-800 font-semibold mt-0.5">
                        {loc.availableCapacity} slots available
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-sand-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs text-sand-700">
                      <span>Host: {loc.verifiedHost}</span>
                      <span>•</span>
                      <span>Hours: {loc.openHours}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to={`/locations/${loc.slug}`}>
                        <Button variant="outline" size="sm">
                          Details
                        </Button>
                      </Link>
                      <Link to={`/checkout/${loc.id}`}>
                        <Button variant="primary" size="sm">
                          Book Now
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Interactive Transit Corridor Map Canvas */}
          <div className="lg:col-span-5">
            <div className="sticky top-24 bg-navy-950 text-white rounded-3xl p-5 border border-navy-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-terracotta-400">
                    Sri Lanka Transit Corridor Map
                  </span>
                  <h3 className="text-base font-bold text-white">Interactive Station Canvas</h3>
                </div>
                <span className="text-xs bg-white/10 px-2.5 py-1 rounded-full text-sand-200">
                  {filteredLocations.length} Hubs Plotted
                </span>
              </div>

              {/* Graphic Corridor View */}
              <div className="relative h-80 rounded-2xl bg-gradient-to-b from-navy-900 via-navy-950 to-navy-900 border border-white/10 p-4 flex flex-col justify-between overflow-hidden">
                <div className="grid grid-cols-2 gap-2">
                  {filteredLocations.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setSelectedPinId(loc.id)}
                      className={`text-left p-2.5 rounded-xl border transition text-xs ${
                        selectedPinId === loc.id
                          ? "bg-terracotta-500 text-white border-terracotta-400 font-bold shadow-md"
                          : "bg-navy-900/80 text-sand-200 border-white/10 hover:bg-navy-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{loc.city}</span>
                        <span className="text-[11px] opacity-90">
                          {formatLkr(loc.hourlyRateLkr.MEDIUM)}/h
                        </span>
                      </div>
                      <p className="truncate text-[10px] opacity-80 mt-0.5">{loc.name}</p>
                    </button>
                  ))}
                </div>

                {activeSelectedLocation && (
                  <div className="bg-navy-900/95 border border-white/15 rounded-xl p-3.5 text-xs flex items-center justify-between gap-3 shadow-lg">
                    <div className="min-w-0">
                      <p className="font-bold text-terracotta-400 truncate">
                        {activeSelectedLocation.name}
                      </p>
                      <p className="text-sand-300 text-[11px] truncate">
                        GPS: {activeSelectedLocation.coordinates.lat.toFixed(4)}° N,{" "}
                        {activeSelectedLocation.coordinates.lng.toFixed(4)}° E •{" "}
                        {activeSelectedLocation.landmark}
                      </p>
                    </div>
                    <Link
                      to={`/locations/${activeSelectedLocation.slug}`}
                      className="flex-shrink-0"
                    >
                      <Button variant="primary" size="sm">
                        Inspect
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-sand-400 leading-relaxed">
                <Info className="h-3 w-3 inline mr-1 text-terracotta-400" />
                Transit corridor coordinates verified. Exact physical concierge desk and street
                navigation directions are provided on your confirmed custody pass.
              </p>
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
  const [liveLocation, setLiveLocation] = useState<PublicStorageLocation | null>(null);

  useEffect(() => {
    if (slug) {
      marketplaceApi.getPublicLocationDetails(slug)
        .then((loc) => setLiveLocation(loc))
        .catch(() => {});
    }
  }, [slug]);

  const location = useMemo(() => {
    if (liveLocation) {
      return mapPublicLocationToItem(liveLocation);
    }
    return DEMO_LOCATIONS.find((l) => l.slug === slug || l.id === slug) || DEMO_LOCATIONS[0];
  }, [liveLocation, slug]);

  const [hoursEstimate, setHoursEstimate] = useState(6);

  return (
    <div className="space-y-8">
      {/* Breadcrumb & Navigation */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-sand-600">
        <Link to="/search" className="hover:text-navy-950 transition">
          Find Storage
        </Link>
        <span>/</span>
        <span>{location.city}</span>
        <span>/</span>
        <span className="text-navy-950 truncate max-w-xs">{location.name}</span>
      </nav>

      {/* Main Header Card */}
      <div className="bg-white rounded-3xl border border-sand-200 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand">{location.city}</Badge>
            <span className="flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              <span>{location.rating !== null ? location.rating.toFixed(1) : "New Partner"}</span>
              <span className="text-sand-600 font-normal">({location.reviewCount} reviews)</span>
            </span>
            <Badge variant="success">Verified Host</Badge>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-navy-950 tracking-tight">
            {location.name}
          </h1>
          <p className="text-sm text-sand-700 flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-terracotta-600 flex-shrink-0" />
            <span>{location.landmark} • Operated by {location.verifiedHost}</span>
          </p>
        </div>

        <Link to={`/checkout/${location.id}`} className="flex-shrink-0">
          <Button variant="primary" size="lg" className="w-full sm:w-auto font-bold shadow-md">
            <span>Book This Hub</span>
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Hub Dossier */}
        <div className="lg:col-span-8 space-y-6">
          {/* About & Standards */}
          <div className="bg-white rounded-3xl border border-sand-200 p-6 sm:p-8 space-y-6 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-navy-950">About This Storage Facility</h2>
              <p className="text-sm text-sand-700 leading-relaxed mt-2">{location.description}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200/80">
                <span className="text-[10px] text-sand-600 uppercase font-bold tracking-wider block">
                  Operating Hours
                </span>
                <span className="text-xs font-bold text-navy-950 mt-0.5 block">
                  {location.openHours}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200/80">
                <span className="text-[10px] text-sand-600 uppercase font-bold tracking-wider block">
                  Protection
                </span>
                <span className="text-xs font-bold text-emerald-800 mt-0.5 block">
                  {formatLkr(location.insuranceLimitLkr)} / bag
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200/80">
                <span className="text-[10px] text-sand-600 uppercase font-bold tracking-wider block">
                  Available Slots
                </span>
                <span className="text-xs font-bold text-navy-900 mt-0.5 block">
                  {location.availableCapacity} / {location.totalCapacity} Free
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200/80">
                <span className="text-[10px] text-sand-600 uppercase font-bold tracking-wider block">
                  Security Protocol
                </span>
                <span className="text-xs font-bold text-navy-950 mt-0.5 block">
                  CCTV + QR / PIN
                </span>
              </div>
            </div>

            {/* Privacy Masking Card */}
            <div className="p-4 rounded-2xl bg-sand-50 border border-sand-200 text-xs text-navy-900 flex items-start gap-3">
              <Lock className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Privacy-Preserving Address Masking</p>
                <p className="text-sand-700 mt-0.5 leading-relaxed">
                  Approximate Area: <strong>{location.addressMasked}</strong>. To protect facility
                  security and guest privacy, the exact building number and concierge entrance
                  instructions are unlocked on your confirmed custody pass upon booking.
                </p>
              </div>
            </div>
          </div>

          {/* Pricing Rate Card & Estimator */}
          <div className="bg-white rounded-3xl border border-sand-200 p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-navy-950">Transparent LKR Pricing Card</h2>
                <p className="text-xs text-sand-700 mt-0.5">
                  Hourly rates with automatic daily cost caps. No surprise fees at the counter.
                </p>
              </div>
              <div className="flex items-center gap-3 bg-sand-50 border border-sand-200 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-bold text-navy-900">Duration: {hoursEstimate}h</span>
                <input
                  type="range"
                  min={1}
                  max={24}
                  value={hoursEstimate}
                  onChange={(e) => setHoursEstimate(Number(e.target.value))}
                  className="w-24 accent-terracotta-500"
                  aria-label="Storage duration hours"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(["SMALL", "MEDIUM", "LARGE", "OVERSIZED"] as const).map((tier) => {
                const hourly = location.hourlyRateLkr[tier];
                const cap = location.dailyCapLkr[tier];
                const raw = hourly * hoursEstimate;
                const effective = Math.min(raw, cap);
                return (
                  <div
                    key={tier}
                    className="p-4 rounded-2xl border border-sand-200 bg-sand-50/50 space-y-2"
                  >
                    <span className="text-xs font-extrabold text-navy-950 tracking-wider">
                      {tier}
                    </span>
                    <p className="text-xs text-sand-600">
                      {formatLkr(hourly)}/hr • Cap {formatLkr(cap)}
                    </p>
                    <div className="pt-2 border-t border-sand-200/80">
                      <span className="text-[10px] text-sand-500 block uppercase font-bold">
                        {hoursEstimate}h Estimated Total
                      </span>
                      <span className="text-base font-extrabold text-terracotta-700">
                        {formatLkr(effective)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dedicated Storage Zones */}
          <div className="bg-white rounded-3xl border border-sand-200 p-6 sm:p-8 space-y-4 shadow-sm">
            <h2 className="text-xl font-bold text-navy-950">Dedicated Storage Compartments</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {location.zones.map((z) => (
                <div
                  key={z.id}
                  className="flex items-center justify-between text-xs p-3.5 rounded-xl bg-sand-50 border border-sand-200/80"
                >
                  <div>
                    <span className="font-mono font-bold text-terracotta-700">{z.code}</span>
                    <p className="text-navy-900 font-semibold mt-0.5">{z.name}</p>
                  </div>
                  <span className="font-medium text-sand-700">
                    {z.capacity - z.occupied} / {z.capacity} slots free
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Reassurance & Quick Booking Widget */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl border border-sand-200 p-6 space-y-5 shadow-sm">
            <h3 className="font-bold text-lg text-navy-950">Ready to Book?</h3>
            <p className="text-xs text-sand-700 leading-relaxed">
              Reserve your storage slot instantly. Payment is held in secure platform escrow and only
              released to the partner upon verified drop-off.
            </p>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1 text-xs text-emerald-900">
              <span className="font-bold block">Free Cancellation Guarantee</span>
              <p>Cancel up to 24 hours before your drop-off window for a 100% full refund.</p>
            </div>

            <Link to={`/checkout/${location.id}`} className="block">
              <Button variant="primary" size="lg" className="w-full justify-center font-bold">
                Continue to Checkout
              </Button>
            </Link>
          </div>

          <MascotIllustration
            mascot="suitcase-hug"
            size="lg"
            variant="hero"
            badgeText="Verified Custody Hub"
            caption={`Bag reconciliation, serialized tamper-evident seal tags, and ${location.photoEvidencePolicy === "CONFIGURED_MANDATORY" ? "mandatory photo check-in logging" : "standard digital check-in"} at this location.`}
          />
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
  const [travellerName, setTravellerName] = useState("Maya Perera");
  const [travellerEmail, setTravellerEmail] = useState("maya.perera@example.com");

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

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalBags === 0) return;
    navigate(
      `/booking/confirm?loc=${location.id}&total=${totalPayableLkr}&bags=${totalBags}&name=${encodeURIComponent(travellerName)}`
    );
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
          Checkout & Custody Schedule
        </h1>
        <p className="text-sm text-sand-700 mt-1">
          Reserve capacity at {location.name} ({location.city}).
        </p>
      </div>

      <form onSubmit={handleCheckoutSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Schedule & Luggage Details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Drop-off & Pick-up */}
          <div className="bg-white rounded-3xl border border-sand-200 p-6 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-navy-950">1. Drop-off & Pick-up Schedule</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-sand-700 mb-1.5">
                  Drop-off Date & Time (IST)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={dropOffDate}
                  onChange={(e) => setDropOffDate(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-sand-700 mb-1.5">
                  Pick-up Date & Time (IST)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={pickUpDate}
                  onChange={(e) => setPickUpDate(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Bag Quantities */}
          <div className="bg-white rounded-3xl border border-sand-200 p-6 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-navy-950">2. Select Bag Sizes & Quantities</h2>
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
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-sand-50/70 border border-sand-200/80"
                >
                  <div>
                    <p className="text-sm font-bold text-navy-950">{item.label}</p>
                    <p className="text-xs text-sand-600">
                      Daily Rate: {formatLkr(location.dailyCapLkr[item.key])}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => adjustBag(item.key, -1)}
                      className="w-9 h-9 rounded-xl bg-white border border-sand-300 font-bold text-navy-900 hover:bg-sand-100 flex items-center justify-center transition"
                      aria-label={`Decrease ${item.key}`}
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold text-sm text-navy-950">
                      {bags[item.key]}
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustBag(item.key, 1)}
                      className="w-9 h-9 rounded-xl bg-navy-900 text-white font-bold hover:bg-navy-800 flex items-center justify-center transition"
                      aria-label={`Increase ${item.key}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3: Contact Info */}
          <div className="bg-white rounded-3xl border border-sand-200 p-6 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-navy-950">3. Traveller Custody Verification</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                required
                value={travellerName}
                onChange={(e) => setTravellerName(e.target.value)}
              />
              <Input
                label="Email Address"
                type="email"
                required
                value={travellerEmail}
                onChange={(e) => setTravellerEmail(e.target.value)}
                helperText="Digital pass and offline PIN sent here"
              />
            </div>
          </div>
        </div>

        {/* Right: Price Breakdown & Confirmation */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-sand-200 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-navy-950">Price Breakdown</h2>
            <div className="space-y-2 text-sm border-b border-sand-100 pb-4">
              <div className="flex justify-between text-sand-700">
                <span>Total Items</span>
                <span className="font-bold text-navy-950">{totalBags} Bags</span>
              </div>
              <div className="flex justify-between text-sand-700">
                <span>Storage Subtotal</span>
                <span className="font-semibold text-navy-900">{formatLkr(subtotalLkr)}</span>
              </div>
              <div className="flex justify-between text-emerald-800">
                <span>Promo Discount ({promoCode || "None"})</span>
                <span className="font-semibold">- {formatLkr(discountLkr)}</span>
              </div>
              <div className="flex justify-between text-sand-600 text-xs">
                <span>Tamper Seals & Protection Shield</span>
                <span className="font-semibold text-emerald-800">Included</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Promo Code"
                className="flex-1 rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              />
              <span className="text-xs text-emerald-800 font-bold">10% Applied</span>
            </div>

            <div className="flex justify-between items-baseline pt-2">
              <span className="text-base font-bold text-navy-950">Total Payable</span>
              <span className="text-2xl font-extrabold text-terracotta-700">
                {formatLkr(totalPayableLkr)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200/80 text-[11px] text-sand-700 space-y-1">
              <p className="font-bold text-navy-900">Late Collection Notice:</p>
              <p>{location.lateFeePolicyLabel}.</p>
              <p className="text-sand-600">
                <strong>No Silent Charges:</strong> Any overdue fees are requested in-app for your
                review and authorization—never auto-debited—and never prevent luggage return.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={totalBags === 0}
              className="w-full justify-center font-bold text-sm shadow-md"
            >
              Confirm Reservation & View Custody Pass
            </Button>
          </div>

          <Alert variant="info" title="Demo & Prototype Mode">
            Online checkout simulation active. Completing this step generates a verified digital
            custody pass without executing a live bank card debit.
          </Alert>
        </div>
      </form>
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Confirmation Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 sm:p-8 flex items-center gap-5 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            Booking Confirmed • Reference #LS-2026-8841
          </span>
          <h1 className="text-2xl font-extrabold text-navy-950 mt-0.5">
            Your Digital Custody Pass Is Ready
          </h1>
          <p className="text-xs text-emerald-900 mt-1">
            Exact concierge desk address has been unlocked: <strong>{location.addressExact}</strong>
          </p>
        </div>
      </div>

      {/* The Printable Digital Custody Pass */}
      <div className="bg-white rounded-3xl border-2 border-navy-900 overflow-hidden shadow-xl">
        {/* Pass Header */}
        <div className="bg-navy-950 text-white p-6 flex flex-wrap items-center justify-between gap-4 border-b border-navy-800">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-terracotta-400" />
            <div>
              <span className="text-[10px] font-mono tracking-widest text-sand-400 uppercase">
                Global Luggage Storage Marketplace
              </span>
              <h2 className="text-lg font-bold text-white">Digital Custody Pass</h2>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-sand-400 block">Booking Reference</span>
            <span className="font-mono font-bold text-amber-400 text-sm">#LS-2026-8841</span>
          </div>
        </div>

        {/* Pass Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-sand-100">
            <div>
              <span className="text-xs font-bold text-sand-600 uppercase">Storage Hub</span>
              <h3 className="text-lg font-bold text-navy-950 mt-0.5">{location.name}</h3>
              <p className="text-xs text-sand-700 mt-1">{location.addressExact}</p>
              <p className="text-xs text-sand-600 mt-0.5">Host: {location.verifiedHost}</p>
            </div>
            <div>
              <span className="text-xs font-bold text-sand-600 uppercase">Schedule Window</span>
              <p className="text-sm font-bold text-navy-950 mt-0.5">
                Drop-off: Today, 09:00 AM IST
              </p>
              <p className="text-sm font-bold text-navy-950">Pick-up: Today, 05:00 PM IST</p>
              <p className="text-xs text-sand-600 mt-1">
                Items: {bagsCount} Luggage Bags • Paid: {formatLkr(totalLkr)}
              </p>
            </div>
          </div>

          {/* Verification Code Box (QR + PIN) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            {/* Cryptographic QR */}
            <div className="bg-sand-50 rounded-2xl p-5 border border-sand-200 text-center space-y-2">
              <span className="text-[10px] font-mono uppercase font-bold text-navy-900 block">
                Counter QR Check-In
              </span>
              <div className="inline-block p-3 bg-white rounded-xl border border-sand-300 shadow-inner">
                <QrCode className="h-28 w-28 text-navy-950" />
              </div>
              <p className="text-[10px] font-mono text-sand-600">
                LS-CUSTODY://LS-2026-8841/HMAC-9F8A72B
              </p>
            </div>

            {/* Offline PIN Fallback */}
            <div className="bg-sand-50 rounded-2xl p-6 border border-sand-200 text-center space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sand-700 block">
                Offline 6-Digit PIN Fallback
              </span>
              <div className="text-4xl font-mono font-extrabold tracking-widest text-navy-950 py-2">
                482 910
              </div>
              <p className="text-xs text-sand-600 max-w-xs mx-auto leading-relaxed">
                If camera QR scanning is unavailable at the desk, provide this audited 6-digit PIN to
                the concierge.
              </p>
            </div>
          </div>

          {/* Security Seal Tag Info */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 text-xs text-amber-950 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-700 flex-shrink-0" />
              <span>
                Assigned Tamper-Evident Seal Tag Series:{" "}
                <strong className="font-mono">#SL-88410 – #SL-88411</strong>
              </span>
            </div>
            <span className="font-bold text-amber-900">Protected</span>
          </div>
        </div>

        {/* Pass Actions */}
        <div className="bg-sand-50 p-6 border-t border-sand-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              <span>Print / Save Pass</span>
            </Button>
            <Link to="/portal/bookings">
              <Button variant="outline">
                <span>View in My Bookings</span>
              </Button>
            </Link>
          </div>
          <Link to="/search">
            <Button variant="ghost">Book Another Hub</Button>
          </Link>
        </div>
      </div>
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
    <div className="space-y-12 sm:space-y-16">
      {/* Hero Banner */}
      <section className="bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 text-white rounded-3xl p-8 sm:p-14 border border-navy-800 shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-6">
            <Badge variant="brand">Partner Acquisition Program</Badge>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Monetize Unused Space. Become a Verified Storage Host.
            </h1>
            <p className="text-sand-200 text-base sm:text-lg max-w-2xl leading-relaxed">
              Hotels, station cafés, and retail shops earn <strong>85% net revenue</strong> on every
              bag stored. We supply serialized tamper-evident seal tags, QR scanner technology, and
              comprehensive platform protection coverage.
            </p>
            <div className="pt-2 flex flex-wrap gap-4">
              <Link to="/register">
                <Button variant="primary" size="lg" className="font-bold shadow-md">
                  Apply to Host in Sri Lanka
                </Button>
              </Link>
              <Link to="/host/dashboard">
                <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">
                  Preview Host Hub
                </Button>
              </Link>
            </div>
          </div>
          <div className="lg:col-span-4 flex justify-center">
            <MascotIllustration
              mascot="high-five"
              size="lg"
              variant="hero"
              badgeText="85% Host Share"
              caption="Join our vetted hospitality partner network across Sri Lanka."
            />
          </div>
        </div>
      </section>

      {/* Revenue Simulator Card */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 bg-white rounded-3xl border border-sand-200 p-6 sm:p-8 space-y-6 shadow-sm">
          <div>
            <Badge variant="success">Interactive Earnings Calculator</Badge>
            <h2 className="text-2xl font-bold text-navy-950 mt-2">
              Estimate Your Monthly Partner Earnings
            </h2>
            <p className="text-sm text-sand-700 mt-1">
              Based on standard 85% host net payout / 15% platform commission structure.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-sm font-bold text-navy-950 mb-1.5">
                <span>Average Bags Stored per Day</span>
                <span className="text-terracotta-700">{dailyBags} Bags / Day</span>
              </div>
              <input
                type="range"
                min={2}
                max={60}
                value={dailyBags}
                onChange={(e) => setDailyBags(Number(e.target.value))}
                className="w-full accent-terracotta-500"
                aria-label="Average Bags per Day"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm font-bold text-navy-950 mb-1.5">
                <span>Average Booking Value per Bag</span>
                <span className="text-terracotta-700">{formatLkr(avgRateLkr)}</span>
              </div>
              <input
                type="range"
                min={800}
                max={3000}
                step={50}
                value={avgRateLkr}
                onChange={(e) => setAvgRateLkr(Number(e.target.value))}
                className="w-full accent-terracotta-500"
                aria-label="Average Booking Value per Bag"
              />
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-navy-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs text-sand-400 uppercase font-bold block">
                Estimated Net Monthly Payout (85%)
              </span>
              <span className="text-3xl font-extrabold text-terracotta-400 mt-0.5 block">
                {formatLkr(hostNetMonthlyLkr)}{" "}
                <span className="text-xs font-normal text-sand-300">/ month</span>
              </span>
              <p className="text-xs text-sand-400 mt-1">
                Gross Volume: {formatLkr(grossMonthlyLkr)} • Weekly Direct Bank Transfer
              </p>
            </div>
            <Link to="/register">
              <Button variant="primary" className="font-bold">
                Get Started
              </Button>
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl border border-sand-200 p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-lg text-navy-950">Why Host With Us?</h3>
            <ul className="space-y-3 text-xs text-sand-700">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Zero Upfront Equipment:</strong> Manage check-ins directly on any smartphone
                  or tablet. No special hardware required.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Free Starter Security Pack:</strong> We ship serialized tamper-evident seal
                  tags and window signage directly to your venue.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Valuable Foot Traffic:</strong> Travellers storing luggage frequently buy
                  coffee, meals, and tourism services at partner locations.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>
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
      title: "Discover & Reserve Storage Online",
      desc: "Search verified hubs near your train station, airport, or hotel. Reserve your luggage slot with transparent pricing in LKR.",
      mascot: "wave" as const
    },
    {
      step: "02",
      title: "Drop Off & Apply Tamper-Evident Seals",
      desc: "Show your dynamic QR code or 6-digit PIN. Staff tag each bag with a serialized tamper-evident security seal and record photos.",
      mascot: "suitcase-hug" as const
    },
    {
      step: "03",
      title: "Explore Sri Lanka Completely Hands-Free",
      desc: "Take the train to Ella, hike Little Adam's Peak, or stroll Galle Fort unburdened by heavy bags and rolling suitcases.",
      mascot: "sun-hat" as const
    },
    {
      step: "04",
      title: "Guaranteed Counter Release",
      desc: "Present your pass to collect your luggage. Under our platform charter, luggage return is never withheld over billing disputes.",
      mascot: "jump" as const
    }
  ];

  return (
    <div className="space-y-12">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <Badge variant="brand">Traveller Guide</Badge>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-950 tracking-tight">
          How Our Custody & Protection Protocol Works
        </h1>
        <p className="text-sm sm:text-base text-sand-700 leading-relaxed">
          From booking online to picking up your luggage with a verified QR code, see how our
          tamper-evident protocol keeps your bags safe.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {steps.map((s) => (
          <div
            key={s.step}
            className="bg-white rounded-3xl border border-sand-200 p-8 shadow-sm flex flex-col justify-between space-y-6"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-extrabold px-3 py-1 rounded-md bg-terracotta-100 text-terracotta-800">
                  {`STEP ${s.step}`}
                </span>
                <MascotIllustration mascot={s.mascot} size="sm" />
              </div>
              <h2 className="text-xl font-bold text-navy-950">{s.title}</h2>
              <p className="text-sm text-sand-700 leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Mandatory Release Policy Card */}
      <div className="bg-sand-50 rounded-3xl border border-sand-200 p-8 sm:p-10 space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-2.5 text-navy-950 font-bold text-lg">
          <Shield className="h-6 w-6 text-terracotta-600" />
          <span>Our Core Promise: Decoupled Luggage Return</span>
        </div>
        <p className="text-sm text-sand-700 leading-relaxed">
          We strictly prohibit hosts from exercising possessory liens over luggage. Physical return
          of your bags and financial settlement of overtime charges are separate processes. If your
          train is delayed, your bags are always handed back immediately upon identity verification;
          any overtime fees are reviewed and approved in-app.
        </p>
        <div className="pt-2">
          <Link to="/search">
            <Button variant="primary">Find Storage Now</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PW-008: Help Centre & FAQs (/help)
// ============================================================================
export function HelpCentreFaqPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "What happens if counter QR scanning is unavailable at the storage hub?",
      a: "Every confirmed booking includes an audited 6-digit numeric PIN fallback alongside the dynamic QR code. If camera scanning or mobile reception is unavailable at the desk, host staff verify the booking using this rate-limited PIN, which is recorded in the platform custody log."
    },
    {
      q: "What is the cancellation and refund policy?",
      a: "Cancellations made more than 24 hours prior to scheduled drop-off receive a 100% full refund. Cancellations made within 24 hours receive a 50% refund. Every refund is processed transparently through a 7-stage settlement pipeline visible in your traveller portal."
    },
    {
      q: "Can a partner refuse to return my bags if I am delayed?",
      a: "Never. Under our platform charter and Decoupled Mandatory Release Invariant, physical luggage return and overdue fee settlement are strictly separate. Hosts must immediately release your luggage upon QR or PIN verification. Any applicable late collection fees are reviewed and paid in-app—never extorted at the counter."
    },
    {
      q: "Is my luggage insured against loss or damage?",
      a: "Yes. Every verified storage booking includes up to LKR 250,000 in comprehensive platform protection against loss or damage during custody."
    },
    {
      q: "Can I pay in cash directly at the counter?",
      a: "No. All bookings must be completed online through the platform. Online escrow payment is what authorizes insurance protection, serialized tamper-evident seal issuance, and guaranteed pricing."
    },
    {
      q: "What items are prohibited from storage?",
      a: "Prohibited items include illegal substances, firearms, explosives, hazardous chemicals, unpackaged perishable foods, live animals, and unregistered high-value bullion or cash."
    }
  ];

  const filteredFaqs = faqs.filter(
    (f) =>
      f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="text-center space-y-3">
        <Badge variant="brand">Support Desk</Badge>
        <h1 className="text-3xl font-extrabold text-navy-950 tracking-tight">
          Help Centre & Frequently Asked Questions
        </h1>
        <p className="text-sm text-sand-700">
          Find instant answers on custody seals, offline PIN verification, and cancellation policies.
        </p>
      </div>

      {/* Search Input */}
      <div className="bg-white rounded-2xl border border-sand-200 p-3 flex items-center gap-3 shadow-sm">
        <Search className="h-5 w-5 text-sand-400 ml-2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search FAQs (e.g., PIN, refund, overdue, safety)..."
          className="w-full text-sm text-navy-950 focus:outline-none"
        />
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {filteredFaqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-sand-200 overflow-hidden shadow-sm transition"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-base text-navy-950 hover:text-terracotta-700 transition"
              >
                <span>{faq.q}</span>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-sand-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-sand-500 flex-shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-sm text-sand-700 leading-relaxed border-t border-sand-100">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Still Need Help? */}
      <div className="p-6 rounded-3xl bg-sand-50 border border-sand-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-navy-950">Still have a question?</h3>
          <p className="text-xs text-sand-700 mt-0.5">
            Our 24/7 Colombo Support Operations desk is available around the clock.
          </p>
        </div>
        <Link to="/contact">
          <Button variant="secondary">Contact Support</Button>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// PW-009: Contact Us & Inquiries (/contact)
// ============================================================================
export function ContactUsPage() {
  const [submitted, setSubmitted] = useState(false);
  const [topic, setTopic] = useState("Booking / Custody Inquiry");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
          Contact Customer Care & Support
        </h1>
        <p className="text-sm text-sand-700 mt-1">
          Direct escalation for active travellers, partner hosts, and transit inquiries.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Support Inquiry Form */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-sand-200 p-6 sm:p-8 space-y-6 shadow-sm">
          {submitted ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                <Check className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-bold text-navy-950">Inquiry Received</h2>
              <p className="text-xs text-sand-700 max-w-sm mx-auto leading-relaxed">
                Your support ticket has been logged under reference{" "}
                <strong className="font-mono text-navy-900">#TKT-COL-2026-441</strong>. Our Colombo
                Trust & Safety desk responds to active custody requests within 15 minutes.
              </p>
              <Button variant="outline" onClick={() => setSubmitted(false)}>
                Send Another Message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-sand-700 mb-1.5">Inquiry Topic</label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                >
                  <option>Booking / Custody Inquiry</option>
                  <option>Host Partnership Onboarding</option>
                  <option>Refund or Payment Status</option>
                  <option>Urgent Overdue / Handover Assistance</option>
                </select>
              </div>

              <Input
                label="Your Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Maya Perera"
              />

              <Input
                label="Email Address"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="traveller@example.com"
              />

              <div>
                <label className="block text-xs font-bold text-sand-700 mb-1.5">Message</label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your inquiry or booking question..."
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              </div>

              <Button type="submit" variant="primary" className="w-full justify-center font-bold">
                Submit Support Request
              </Button>
            </form>
          )}
        </div>

        {/* Support Channels & Info */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-sand-200 p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-base text-navy-950">Colombo Operations Desk</h3>
            <div className="space-y-3 text-xs text-sand-700">
              <p className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-terracotta-600 flex-shrink-0" />
                <span>+94 11 234 5678 (24/7 Custody Hotline)</span>
              </p>
              <p className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-terracotta-600 flex-shrink-0" />
                <span>support@luggagestorage.lk</span>
              </p>
              <p className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-terracotta-600 flex-shrink-0" />
                <span>Active 24 Hours / 365 Days</span>
              </p>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-sand-50 border border-sand-200/80 space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-navy-950">
              Emergency Overdue Protection
            </h4>
            <p className="text-xs text-sand-700 leading-relaxed">
              If your train is delayed or you are encountering difficulty reaching a partner desk,
              call our 24/7 hotline immediately for expedited custody coordination.
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
  const [activeTab, setActiveTab] = useState<"TERMS" | "PRIVACY" | "CUSTODY">("TERMS");

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
          Terms of Service, Privacy & Legal Charter
        </h1>
        <p className="text-sm text-sand-700 mt-1">
          Binding platform policies governing luggage bailment, personal data protection, and
          custody rights.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-sand-200 pb-2">
        {[
          { id: "TERMS", label: "Marketplace Terms of Service" },
          { id: "PRIVACY", label: "Privacy & PDPA Policy" },
          { id: "CUSTODY", label: "Custody & Mandatory Release Charter" }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as "TERMS" | "PRIVACY" | "CUSTODY")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition min-h-[38px] ${
              activeTab === tab.id
                ? "bg-navy-900 text-white shadow-sm"
                : "bg-sand-100 text-sand-800 hover:bg-sand-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Document View */}
      <div className="bg-white rounded-3xl border border-sand-200 p-6 sm:p-8 space-y-6 text-sm text-sand-800 leading-relaxed shadow-sm">
        {activeTab === "TERMS" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-navy-950">
              Section 1 — Global Luggage Storage Marketplace Bailment Terms
            </h2>
            <p>
              By reserving storage capacity through this platform, travellers enter into a binding
              bailment agreement with the designated storage partner. The storage partner agrees to
              safeguard the luggage in a secure, designated storage zone for the scheduled duration.
            </p>
            <p>
              All reservations are authorized and settled online. Handing cash directly to partner
              hosts at physical counters is strictly prohibited and immediately voids platform
              insurance coverage and custody dispute resolution mechanisms.
            </p>
          </div>
        )}

        {activeTab === "PRIVACY" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-navy-950">
              Section 2 — Personal Data Protection Act (Sri Lanka PDPA & GDPR) Policy
            </h2>
            <p>
              We respect your personal privacy. Our platform implements Privacy-Preserving Address
              Masking: public search results display only neighborhood transit landmarks and
              approximate station corridors. The exact street address and concierge entrance
              instructions are unlocked only on confirmed custody passes issued to authorized
              travellers.
            </p>
            <p>
              Check-in verification photos captured at partner counters are encrypted in transit and
              at rest, accessible only for custody verification and dispute resolution.
            </p>
          </div>
        )}

        {activeTab === "CUSTODY" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-navy-950">
              Section 3 — Mandatory Release Invariant & Custody Integrity Charter
            </h2>
            <p>
              <strong>Decoupled Custody Protocol:</strong> Partner hosts are strictly forbidden from
              asserting possessory liens over traveller luggage. Physical luggage release and the
              settlement of overdue or overtime fees are completely decoupled. Upon presenting a
              valid QR code or audited 6-digit PIN, luggage must be returned to the traveller
              immediately.
            </p>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950">
              <strong>Overdue Fee Settlement:</strong> In the event of a late collection exceeding
              the location's published grace window, overtime fees are calculated transparently and
              requested in-app for traveller review and payment authorization. Silent or unexpected
              bank debits are strictly prohibited.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PW-011: Traveller Web Portal (/portal/bookings)
// ============================================================================
export function TravellerWebPortalPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "COMPLETED" | "REFUNDS">("ACTIVE");
  const [bookings, setBookings] = useState<DemoBookingRecord[]>(DEMO_BOOKINGS);
  const [selectedBookingForPass, setSelectedBookingForPass] = useState<DemoBookingRecord | null>(null);
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState<DemoBookingRecord | null>(null);

  const activeBookings = useMemo(
    () => bookings.filter((b) => b.status === "CHECKED_IN" || b.status === "CONFIRMED"),
    [bookings]
  );
  const completedBookings = useMemo(
    () => bookings.filter((b) => b.status === "COMPLETED"),
    [bookings]
  );
  const refundBookings = useMemo(
    () => bookings.filter((b) => b.status === "CANCELLED_REFUNDED" || b.refundStage !== undefined),
    [bookings]
  );

  const handleConfirmCancel = (id: string) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              status: "CANCELLED_REFUNDED" as const,
              refundStage: 2
            }
          : b
      )
    );
    setSelectedBookingForCancel(null);
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-sand-200 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-sand-600">
            Traveller Account Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 mt-0.5">
            {user ? `Welcome Back, ${user.displayName || user.email}` : "My Storage Bookings"}
          </h1>
          <p className="text-xs text-sand-700 mt-1">
            Track active storage sessions, view digital custody passes, and monitor refund statuses.
          </p>
        </div>

        <Link to="/search">
          <Button variant="primary">
            <Search className="h-4 w-4 mr-2" />
            <span>Book New Storage</span>
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-sand-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("ACTIVE")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition min-h-[38px] ${
            activeTab === "ACTIVE"
              ? "bg-navy-900 text-white shadow-sm"
              : "bg-sand-100 text-sand-800 hover:bg-sand-200"
          }`}
        >
          Active & Upcoming ({activeBookings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("COMPLETED")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition min-h-[38px] ${
            activeTab === "COMPLETED"
              ? "bg-navy-900 text-white shadow-sm"
              : "bg-sand-100 text-sand-800 hover:bg-sand-200"
          }`}
        >
          Past Trips ({completedBookings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("REFUNDS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition min-h-[38px] ${
            activeTab === "REFUNDS"
              ? "bg-navy-900 text-white shadow-sm"
              : "bg-sand-100 text-sand-800 hover:bg-sand-200"
          }`}
        >
          Refunds & Settlements ({refundBookings.length})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "ACTIVE" && (
        <div className="space-y-4">
          {activeBookings.length === 0 ? (
            <div className="bg-white rounded-3xl border border-sand-200 p-12 text-center space-y-3">
              <p className="text-sm font-bold text-navy-950">No active storage bookings right now.</p>
              <p className="text-xs text-sand-600">
                Ready to travel hands-free? Book storage near your upcoming destination.
              </p>
              <Link to="/search">
                <Button variant="primary">Find Storage</Button>
              </Link>
            </div>
          ) : (
            activeBookings.map((b) => (
              <div
                key={b.id}
                className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sand-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-navy-950">
                        {b.reference}
                      </span>
                      <Badge variant={b.status === "CHECKED_IN" ? "success" : "brand"}>
                        {b.status === "CHECKED_IN" ? "In Active Custody" : "Confirmed & Reserved"}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-base text-navy-950 mt-1">{b.locationName}</h3>
                    <p className="text-xs text-sand-600">{b.city} • Zone {b.zoneCode}</p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-xs text-sand-600 block">{b.totalBags} Luggage Items</span>
                    <span className="text-base font-extrabold text-navy-950">
                      {formatLkr(b.totalAmountLkr)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-sand-700">
                  <div className="p-3 rounded-xl bg-sand-50 border border-sand-100">
                    <span className="text-[10px] uppercase font-bold text-sand-500 block">
                      Pick-up Window
                    </span>
                    <span className="font-semibold text-navy-900 mt-0.5 block">
                      {new Date(b.pickUpIso).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}{" "}
                      (IST)
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-sand-50 border border-sand-100">
                    <span className="text-[10px] uppercase font-bold text-sand-500 block">
                      Security Seals
                    </span>
                    <span className="font-mono font-semibold text-navy-900 mt-0.5 block">
                      {b.sealIds.join(", ")}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-sand-50 border border-sand-100">
                    <span className="text-[10px] uppercase font-bold text-sand-500 block">
                      Verification PIN
                    </span>
                    <span className="font-mono font-bold text-terracotta-700 mt-0.5 block">
                      {b.pinCode}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setSelectedBookingForPass(b)}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    <span>View Digital Custody Pass</span>
                  </Button>

                  {b.status === "CONFIRMED" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-700 hover:text-rose-800 hover:bg-rose-50"
                      onClick={() => setSelectedBookingForCancel(b)}
                    >
                      Cancel Reservation
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "COMPLETED" && (
        <div className="space-y-4">
          {completedBookings.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-navy-950">{b.reference}</span>
                  <Badge variant="neutral">Completed & Handed Back</Badge>
                </div>
                <h3 className="font-bold text-base text-navy-950 mt-1">{b.locationName}</h3>
                <p className="text-xs text-sand-600">
                  {b.city} • Total Paid: {formatLkr(b.totalAmountLkr)} ({b.totalBags} Bags)
                </p>
              </div>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                <span>Download VAT Invoice</span>
              </Button>
            </div>
          ))}
        </div>
      )}

      {activeTab === "REFUNDS" && (
        <div className="space-y-4">
          {refundBookings.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-navy-950">{b.reference}</span>
                    <Badge variant="warning">Refund Processing</Badge>
                  </div>
                  <h3 className="font-bold text-base text-navy-950 mt-1">{b.locationName}</h3>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-xs text-sand-600 block">Refund Amount</span>
                  <span className="text-base font-extrabold text-emerald-800">
                    {formatLkr(b.totalAmountLkr)}
                  </span>
                </div>
              </div>

              {/* 7-Stage Settlement Progress Stepper */}
              <div className="pt-2 space-y-2">
                <span className="text-xs font-bold text-sand-700 block">
                  7-Stage Settlement Pipeline Progress:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
                  {REFUND_SEVEN_STAGES.map((st) => {
                    const isDone = (b.refundStage || 2) >= st.stage;
                    return (
                      <div
                        key={st.stage}
                        className={`p-2 rounded-xl text-center border text-[10px] ${
                          isDone
                            ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold"
                            : "bg-sand-50 border-sand-200 text-sand-500"
                        }`}
                      >
                        <span className="block font-mono">Stage {st.stage}</span>
                        <span className="truncate block mt-0.5">{st.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: View Digital Custody Pass */}
      {selectedBookingForPass && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-sand-200 relative">
            <button
              type="button"
              onClick={() => setSelectedBookingForPass(null)}
              className="absolute top-5 right-5 text-sand-500 hover:text-navy-950 transition"
              aria-label="Close Modal"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center space-y-1">
              <Badge variant="brand">Digital Custody Pass</Badge>
              <h3 className="text-xl font-extrabold text-navy-950">
                {selectedBookingForPass.reference}
              </h3>
              <p className="text-xs text-sand-600">{selectedBookingForPass.locationName}</p>
            </div>

            <div className="bg-sand-50 rounded-2xl p-4 text-center space-y-2 border border-sand-200">
              <div className="inline-block p-2 bg-white rounded-xl border border-sand-300">
                <QrCode className="h-32 w-32 text-navy-950" />
              </div>
              <p className="text-xs font-mono font-bold text-navy-950">
                PIN: {selectedBookingForPass.pinCode}
              </p>
              <p className="text-[10px] font-mono text-sand-600">
                {selectedBookingForPass.qrPayload}
              </p>
            </div>

            <div className="text-xs text-sand-700 space-y-1.5 border-t border-sand-100 pt-4">
              <p>
                <strong>Luggage Items:</strong> {selectedBookingForPass.totalBags} Bags
              </p>
              <p>
                <strong>Assigned Seal Tag:</strong>{" "}
                <span className="font-mono">{selectedBookingForPass.sealIds.join(", ")}</span>
              </p>
              <p>
                <strong>Zone Storage Bay:</strong> {selectedBookingForPass.zoneCode}
              </p>
            </div>

            <Button
              variant="secondary"
              className="w-full justify-center"
              onClick={() => setSelectedBookingForPass(null)}
            >
              Close Pass
            </Button>
          </div>
        </div>
      )}

      {/* Modal: Cancel Booking & 7-Stage Refund Calculation */}
      {selectedBookingForCancel && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-sand-200 relative">
            <button
              type="button"
              onClick={() => setSelectedBookingForCancel(null)}
              className="absolute top-5 right-5 text-sand-500 hover:text-navy-950 transition"
              aria-label="Close Cancel Modal"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <span className="text-xs font-bold text-rose-700 uppercase">Cancel Reservation</span>
              <h3 className="text-xl font-bold text-navy-950">Confirm Cancellation</h3>
              <p className="text-xs text-sand-600">
                Reference: {selectedBookingForCancel.reference}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-sand-50 border border-sand-200 text-xs text-sand-800 space-y-2">
              <p>
                <strong>Refund Calculation:</strong> Because cancellation is made at least 24 hours
                prior to scheduled drop-off, you are eligible for a <strong>100% full refund</strong>{" "}
                of {formatLkr(selectedBookingForCancel.totalAmountLkr)}.
              </p>
              <p className="text-sand-600">
                The refund will be credited back to your original payment method via our 7-stage
                settlement pipeline.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 justify-center"
                onClick={() => setSelectedBookingForCancel(null)}
              >
                Keep Booking
              </Button>
              <Button
                variant="danger"
                className="flex-1 justify-center font-bold"
                onClick={() => handleConfirmCancel(selectedBookingForCancel.id)}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
