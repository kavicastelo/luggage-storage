import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useSearchParams } from "react-router-dom";
import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Layers,
  LayoutDashboard,
  Lock,
  MapPin,
  Phone,
  QrCode,
  Settings,
  ShieldCheck,
  Star,
  Tag,
  Users,
  Wallet
} from "lucide-react";
import { MascotIllustration } from "@/components/ui/MascotIllustration";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { isFeatureReviewsEnabled } from "@/config/feature-flags";
import { DEMO_LOCATIONS, type StorageLocationItem } from "@/data/mock-marketplace";
import {
  useHostLocationsQuery,
  useOwnedBusinessesQuery
} from "@/hooks/queries/use-host-portal";
import { useAuthStore } from "@/store/useAuthStore";
import { useHostContextStore } from "@/store/useHostContextStore";
import { mapApiLocationToItem } from "./host-helpers";

export interface HostContextType {
  currentLocation: StorageLocationItem | null;
  selectedBusinessId: string;
  selectedLocationId: string;
  setSelectedLocationId: (id: string) => void;
  allLocations: StorageLocationItem[];
  effectiveHostRole: "HOST_OWNER" | "HOST_STAFF";
  setHostRoleMode: (role: "HOST_OWNER" | "HOST_STAFF") => void;
  canActAsHostOwner: boolean;
  isDemoActive: boolean;
  querySuffix: string;
  locationsError: string | null;
  reloadLocations: () => Promise<void>;
}

const HostVenueContext = React.createContext<HostContextType | null>(null);

export function useHostVenue(): HostContextType {
  const context = React.useContext(HostVenueContext);
  if (!context) {
    const { isAuthenticated, user } = useAuthStore.getState();
    const isDemoActive =
      !isAuthenticated &&
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: typeof window !== "undefined" ? window.location.search : "",
        isAuthenticated
      });
    const fallbackLocations = isDemoActive ? DEMO_LOCATIONS : [];
    const canActAsHostOwner = !isAuthenticated
      ? true
      : Boolean(user?.roles?.includes("HOST_OWNER") || user?.roles?.includes("SUPERADMIN"));
    const effectiveHostRole: "HOST_OWNER" | "HOST_STAFF" = isAuthenticated
      ? canActAsHostOwner
        ? "HOST_OWNER"
        : "HOST_STAFF"
      : "HOST_OWNER";
    return {
      currentLocation: fallbackLocations[0] ?? null,
      selectedBusinessId: "",
      selectedLocationId: fallbackLocations[0]?.id ?? "",
      setSelectedLocationId: () => {},
      allLocations: fallbackLocations,
      effectiveHostRole,
      setHostRoleMode: () => {},
      canActAsHostOwner,
      isDemoActive,
      querySuffix: isDemoActive ? "?preview=demo" : "",
      locationsError: null,
      reloadLocations: async () => {}
    };
  }
  return context;
}

const HOST_STAFF_ALLOWED_PATHS = new Set([
  "/host",
  "/host/dashboard",
  "/host/operations",
  "/host/bookings",
  "/host/locations",
  "/host/reviews"
]);

export function HostDashboardLayout() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get("role")?.toUpperCase();
  const initialDemoRole: "HOST_OWNER" | "HOST_STAFF" =
    roleParam === "HOST_STAFF" || roleParam === "STAFF" ? "HOST_STAFF" : "HOST_OWNER";

  const { isAuthenticated, user } = useAuthStore();
  const isDemoActive = isDemoPreviewActive({
    allowDemoPreview: true,
    search: location.search,
    isAuthenticated
  });
  const querySuffix = !isAuthenticated && isDemoActive ? "?preview=demo" : "";

  const storedLocationId = useHostContextStore((state) => state.selectedLocationId);
  const setStoredLocationId = useHostContextStore((state) => state.setSelectedLocationId);
  const storedBusinessId = useHostContextStore((state) => state.selectedBusinessId);
  const setStoredBusinessId = useHostContextStore((state) => state.setSelectedBusinessId);

  const [demoRoleMode, setDemoRoleMode] = useState<"HOST_OWNER" | "HOST_STAFF">(initialDemoRole);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canActAsHostOwner = !isAuthenticated
    ? true
    : Boolean(user?.roles?.includes("HOST_OWNER") || user?.roles?.includes("SUPERADMIN"));

  // SEC-03: In authenticated sessions, role mode derives strictly from verified server roles.
  const effectiveHostRole: "HOST_OWNER" | "HOST_STAFF" = isAuthenticated
    ? canActAsHostOwner
      ? "HOST_OWNER"
      : "HOST_STAFF"
    : isDemoActive
      ? demoRoleMode
      : "HOST_STAFF";

  const businessesQuery = useOwnedBusinessesQuery({
    enabled: isAuthenticated && canActAsHostOwner
  });
  const locationsQuery = useHostLocationsQuery({ enabled: isAuthenticated });

  const allLocations: StorageLocationItem[] = useMemo(() => {
    if (isAuthenticated) {
      return (locationsQuery.data ?? []).map(mapApiLocationToItem);
    }
    return isDemoActive ? DEMO_LOCATIONS : [];
  }, [isAuthenticated, isDemoActive, locationsQuery.data]);

  const effectiveSelectedLocationId = useMemo(() => {
    if (allLocations.some((l) => l.id === storedLocationId)) {
      return storedLocationId;
    }
    return allLocations[0]?.id ?? "";
  }, [allLocations, storedLocationId]);

  useEffect(() => {
    if (effectiveSelectedLocationId && effectiveSelectedLocationId !== storedLocationId) {
      setStoredLocationId(effectiveSelectedLocationId);
    }
  }, [effectiveSelectedLocationId, storedLocationId, setStoredLocationId]);

  const effectiveSelectedBusinessId = useMemo(() => {
    const businesses = businessesQuery.data ?? [];
    if (businesses.some((b) => b.id === storedBusinessId)) {
      return storedBusinessId;
    }
    return businesses[0]?.id ?? "";
  }, [businessesQuery.data, storedBusinessId]);

  useEffect(() => {
    if (effectiveSelectedBusinessId && effectiveSelectedBusinessId !== storedBusinessId) {
      setStoredBusinessId(effectiveSelectedBusinessId);
    }
  }, [effectiveSelectedBusinessId, storedBusinessId, setStoredBusinessId]);

  const currentLocation = useMemo(
    () => allLocations.find((l) => l.id === effectiveSelectedLocationId) || allLocations[0] || null,
    [allLocations, effectiveSelectedLocationId]
  );

  const locationsError = useMemo(() => {
    if (!isAuthenticated || !locationsQuery.isError) {
      return null;
    }
    const err = locationsQuery.error;
    return err instanceof Error ? err.message : "Unable to load your host storage locations.";
  }, [isAuthenticated, locationsQuery.isError, locationsQuery.error]);

  const reloadLocations = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    if (canActAsHostOwner) {
      await Promise.all([businessesQuery.refetch(), locationsQuery.refetch()]);
    } else {
      await locationsQuery.refetch();
    }
  }, [isAuthenticated, canActAsHostOwner, businessesQuery, locationsQuery]);

  const navLocationId =
    effectiveSelectedLocationId ||
    (!isAuthenticated && isDemoActive ? DEMO_LOCATIONS[0].id : "select");

  const showReviewsNav = (!isAuthenticated && isDemoActive) || isFeatureReviewsEnabled();
  const operationalNavItems = [
    { label: "Overview", to: "/host/dashboard", icon: LayoutDashboard, ownerOnly: false },
    {
      label: "Check-In & Out Desk",
      to: "/host/operations",
      icon: QrCode,
      ownerOnly: false,
      highlight: true
    },
    { label: "Bookings Hub", to: "/host/bookings", icon: Briefcase, ownerOnly: false },
    { label: "Storage Hubs", to: "/host/locations", icon: MapPin, ownerOnly: false },
    ...(showReviewsNav
      ? [{ label: "Customer Reviews", to: "/host/reviews", icon: Star, ownerOnly: false }]
      : [])
  ];

  const locationConfigNavItems = [
    { label: "Location Profile", to: `/host/locations/${navLocationId}`, icon: Building2, ownerOnly: true },
    { label: "Hours & Calendar", to: `/host/locations/${navLocationId}/schedule`, icon: Calendar, ownerOnly: true },
    { label: "Capacity & Zones", to: `/host/locations/${navLocationId}/capacity`, icon: Layers, ownerOnly: true },
    { label: "Pricing Rules", to: `/host/locations/${navLocationId}/pricing`, icon: Tag, ownerOnly: true }
  ];

  const businessNavItems = [
    { label: "Revenue & Ledger", to: "/host/finance", icon: Wallet, ownerOnly: true },
    { label: "Payout Accounts", to: "/host/payouts", icon: Building2, ownerOnly: true },
    { label: "Staff & Access", to: "/host/staff", icon: Users, ownerOnly: true },
    { label: "Business Settings", to: "/host/settings", icon: Settings, ownerOnly: true }
  ];

  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
  const isBlockedByStaffRole =
    effectiveHostRole === "HOST_STAFF" &&
    !HOST_STAFF_ALLOWED_PATHS.has(normalizedPath) &&
    !normalizedPath.startsWith("/host/bookings/");

  const needsBusinessOnboarding =
    isAuthenticated &&
    canActAsHostOwner &&
    businessesQuery.isSuccess &&
    (businessesQuery.data?.length ?? 0) === 0;

  const contextValue: HostContextType = {
    currentLocation,
    selectedBusinessId: effectiveSelectedBusinessId,
    selectedLocationId: effectiveSelectedLocationId,
    setSelectedLocationId: setStoredLocationId,
    allLocations,
    effectiveHostRole,
    setHostRoleMode: setDemoRoleMode,
    canActAsHostOwner,
    isDemoActive,
    querySuffix,
    locationsError,
    reloadLocations
  };

  return (
    <HostVenueContext.Provider value={contextValue}>
      <div className="space-y-6">
        {/* Mobile Venue & Navigation Bar */}
        <div className="lg:hidden flex items-center justify-between p-3.5 bg-navy-950 text-white rounded-2xl shadow-md border border-navy-800">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-terracotta-500 flex items-center justify-center font-bold text-white text-sm">
              CL
            </div>
            <div>
              <p className="text-xs font-bold leading-tight truncate max-w-[180px]">
                {currentLocation?.name || "Host Partner Portal"}
              </p>
              <p className="text-[10px] text-sand-300">
                {currentLocation?.city || "Sri Lanka"} •{" "}
                {effectiveHostRole === "HOST_OWNER" ? "Host Owner" : "Host Staff"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-xs font-semibold text-sand-100 flex items-center gap-1.5"
            aria-label="Toggle Host Menu"
          >
            <span>Menu</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${mobileMenuOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Host Portal Sidebar */}
          <aside className={`lg:col-span-3 space-y-4 ${mobileMenuOpen ? "block" : "hidden lg:block"}`}>
            {/* Host Identity & Venue Switcher */}
            <div className="bg-navy-950 text-white rounded-2xl p-4 sm:p-5 space-y-4 shadow-md border border-navy-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-sans uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                  Host Partner Portal
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 font-medium text-sand-200">
                  {effectiveHostRole === "HOST_OWNER" ? "Owner View" : "Staff View"}
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold text-sand-200">
                  {isAuthenticated && user
                    ? user.displayName || user.email
                    : isDemoActive
                      ? "Ceylon Transit Hospitality (Pvt) Ltd"
                      : "Host Workstation"}
                </p>
                <p className="text-[11px] text-sand-400 mt-0.5">
                  {isAuthenticated
                    ? "Verified Host Account"
                    : isDemoActive
                      ? "Sample Host Partner Profile (Demo Preview)"
                      : "Sign in to load host venues"}
                </p>
              </div>

              {locationsError && (
                <div
                  role="alert"
                  className="p-2.5 rounded-lg bg-red-950/60 border border-red-400/40 text-red-100 text-[11px] font-semibold space-y-1.5"
                >
                  <p>{locationsError}</p>
                  <button
                    type="button"
                    onClick={() => void reloadLocations()}
                    className="px-2 py-0.5 rounded bg-white text-red-900 font-bold"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Active Venue Selector */}
              <div className="space-y-1.5 pt-1 border-t border-navy-800/80">
                <label className="block text-[11px] font-semibold text-sand-300">
                  Active Storage Hub
                </label>
                <div className="relative">
                  <select
                    aria-label="Active Storage Hub"
                    value={effectiveSelectedLocationId}
                    disabled={allLocations.length === 0}
                    onChange={(e) => setStoredLocationId(e.target.value)}
                    className="w-full appearance-none rounded-xl bg-navy-900 border border-navy-700 px-3 py-2 text-xs text-sand-100 font-medium pr-8 focus:outline-none focus:ring-1 focus:ring-terracotta-500 disabled:opacity-60"
                  >
                    {allLocations.length === 0 ? (
                      <option value="">No storage hubs loaded</option>
                    ) : (
                      allLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.city})
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-sand-400 pointer-events-none" />
                </div>
              </div>

              {/* Interactive Preview Role Switcher ONLY in unauthenticated demo mode */}
              {!isAuthenticated && isDemoActive ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-sand-300 font-medium">
                    <span>Operating Role</span>
                    <span className="text-[10px] text-amber-400">Interactive Preview</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 bg-navy-900 p-1 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => setDemoRoleMode("HOST_OWNER")}
                      className={`py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 ${
                        effectiveHostRole === "HOST_OWNER"
                          ? "bg-terracotta-500 text-white shadow-sm"
                          : "text-sand-300 hover:text-white"
                      }`}
                    >
                      Host Owner
                    </button>
                    <button
                      type="button"
                      onClick={() => setDemoRoleMode("HOST_STAFF")}
                      className={`py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 ${
                        effectiveHostRole === "HOST_STAFF"
                          ? "bg-amber-500 text-navy-950 shadow-sm"
                          : "text-sand-300 hover:text-white"
                      }`}
                    >
                      Host Staff
                    </button>
                  </div>
                </div>
              ) : effectiveHostRole === "HOST_STAFF" ? (
                <div className="bg-navy-900 px-3 py-2 rounded-xl text-xs text-amber-300 font-medium flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Logged in as Staff (Counter Scope)</span>
                </div>
              ) : null}
            </div>

            {/* Navigation Menus */}
            <nav className="bg-white rounded-2xl border border-sand-200 p-3 space-y-4 shadow-sm">
              {/* Operations Section */}
              <div>
                <p className="px-3 text-[10px] font-bold text-navy-400 uppercase tracking-wider mb-1.5">
                  Daily Operations
                </p>
                <div className="space-y-1">
                  {operationalNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      normalizedPath === item.to ||
                      (item.to === "/host/dashboard" && normalizedPath === "/host") ||
                      (item.to === "/host/bookings" && normalizedPath.startsWith("/host/bookings/"));
                    return (
                      <Link
                        key={item.label}
                        to={`${item.to}${querySuffix}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                          isActive
                            ? "bg-terracotta-500 text-white shadow-sm"
                            : item.highlight
                              ? "bg-emerald-50 text-emerald-900 hover:bg-emerald-100/80 font-bold"
                              : "text-navy-900 hover:bg-sand-50"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <Icon
                            className={`h-4 w-4 flex-shrink-0 ${
                              isActive
                                ? "text-white"
                                : item.highlight
                                  ? "text-emerald-700"
                                  : "text-navy-500"
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.highlight && !isActive && (
                          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Location Configuration Section (Exact Route Matching) */}
              <div className="pt-2 border-t border-sand-100">
                <div className="flex items-center justify-between px-3 mb-1.5">
                  <p className="text-[10px] font-bold text-navy-400 uppercase tracking-wider">
                    Location Setup
                  </p>
                  {effectiveHostRole === "HOST_STAFF" && (
                    <Lock className="h-3 w-3 text-amber-600" />
                  )}
                </div>
                <div className="space-y-1">
                  {locationConfigNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = normalizedPath === item.to;
                    const restricted = effectiveHostRole === "HOST_STAFF" && item.ownerOnly;
                    return (
                      <Link
                        key={item.label}
                        to={`${item.to}${querySuffix}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                          isActive
                            ? "bg-navy-900 text-white shadow-sm"
                            : restricted
                              ? "text-navy-300 hover:bg-sand-50/50 cursor-pointer"
                              : "text-navy-800 hover:bg-sand-50"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <Icon
                            className={`h-4 w-4 flex-shrink-0 ${
                              isActive
                                ? "text-white"
                                : restricted
                                  ? "text-navy-300"
                                  : "text-navy-500"
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {restricted && <Lock className="h-3 w-3 text-amber-500" />}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Finance & Administration Section */}
              <div className="pt-2 border-t border-sand-100">
                <div className="flex items-center justify-between px-3 mb-1.5">
                  <p className="text-[10px] font-bold text-navy-400 uppercase tracking-wider">
                    Finance &amp; Administration
                  </p>
                  {effectiveHostRole === "HOST_STAFF" && (
                    <Lock className="h-3 w-3 text-amber-600" />
                  )}
                </div>
                <div className="space-y-1">
                  {businessNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = normalizedPath === item.to;
                    const restricted = effectiveHostRole === "HOST_STAFF" && item.ownerOnly;
                    return (
                      <Link
                        key={item.label}
                        to={`${item.to}${querySuffix}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                          isActive
                            ? "bg-navy-900 text-white shadow-sm"
                            : restricted
                              ? "text-navy-300 hover:bg-sand-50/50 cursor-pointer"
                              : "text-navy-800 hover:bg-sand-50"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <Icon
                            className={`h-4 w-4 flex-shrink-0 ${
                              isActive
                                ? "text-white"
                                : restricted
                                  ? "text-navy-300"
                                  : "text-navy-500"
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {restricted && <Lock className="h-3 w-3 text-amber-500" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </nav>

            {/* Quick Assistance Card */}
            <div className="bg-sand-100 rounded-2xl p-4 border border-sand-200 text-xs space-y-2">
              <div className="flex items-center gap-2 text-navy-900 font-bold">
                <Phone className="h-4 w-4 text-terracotta-600" />
                <span>Host Support Desk</span>
              </div>
              <p className="text-[11px] text-navy-700">
                Need urgent assistance with an overdue bag or custody handover?
              </p>
              <p className="font-semibold text-terracotta-700 text-xs">+94 11 234 5678 (Toll-Free)</p>
            </div>
          </aside>

          {/* Main Host Workstation Surface */}
          <div className="lg:col-span-9 space-y-5">
            {needsBusinessOnboarding && normalizedPath !== "/host/onboarding" && (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 text-xs text-amber-950">
                  <ClipboardCheck className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Host Business Onboarding Incomplete</p>
                    <p className="text-amber-800 mt-0.5">
                      Register your Sri Lanka partner business and upload KYC documents before adding public storage locations.
                    </p>
                  </div>
                </div>
                <Link
                  to="/host/onboarding"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold whitespace-nowrap transition"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Complete Host Onboarding</span>
                </Link>
              </div>
            )}

            {isBlockedByStaffRole ? (
              <div className="bg-white rounded-2xl border border-sand-200 p-8 sm:p-12 text-center space-y-6 shadow-sm">
                <div className="flex justify-center">
                  <MascotIllustration
                    mascot="key"
                    size="md"
                    badgeText="Host Owner Authorization Required"
                    caption="Staff account permissions restricted to counter operations."
                  />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h2 className="text-xl font-bold text-navy-900">
                    Host Owner Authorization Required
                  </h2>
                  <p className="text-xs text-navy-600 leading-relaxed">
                    This section contains sensitive business pricing, capacity configuration,
                    financial ledger, or team administration controls restricted to Host Owner accounts.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Link
                    to={`/host/operations${querySuffix}`}
                    className="px-5 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition"
                  >
                    Return to Check-In &amp; Out Desk
                  </Link>
                  {!isAuthenticated && isDemoActive && canActAsHostOwner && (
                    <button
                      type="button"
                      onClick={() => setDemoRoleMode("HOST_OWNER")}
                      className="px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold shadow-sm transition"
                    >
                      Switch to Host Owner Role
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <Outlet context={contextValue} />
            )}
          </div>
        </div>
      </div>
    </HostVenueContext.Provider>
  );
}
