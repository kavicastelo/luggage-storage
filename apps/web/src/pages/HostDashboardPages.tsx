import React, { useState, useMemo } from "react";
import { Link, Outlet, useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  LayoutDashboard,
  MapPin,
  Calendar,
  Layers,
  Tag,
  Briefcase,
  QrCode,
  Wallet,
  Building2,
  Star,
  Users,
  Settings,
  X,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ChevronRight,
  Search,
  Download,
  Plus,
  Phone,
  FileText,
  Check,
  RefreshCw,
  Luggage,
  ChevronDown,
  Info
} from "lucide-react";
import { MascotIllustration } from "@/components/ui/MascotIllustration";
import { useAuthStore } from "@/store/useAuthStore";
import { isDemoPreviewActive } from "@/config/demo-preview";
import {
  DEMO_LOCATIONS,
  DEMO_BOOKINGS,
  DemoBookingRecord,
  StorageLocationItem,
  formatLkr
} from "@/data/mock-marketplace";

// ============================================================================
// Shared Host Venue Context & Helper Hooks
// ============================================================================

interface HostContextType {
  currentLocation: StorageLocationItem;
  selectedLocationId: string;
  setSelectedLocationId: (id: string) => void;
  allLocations: StorageLocationItem[];
  effectiveHostRole: "HOST_OWNER" | "HOST_STAFF";
  setHostRoleMode: (role: "HOST_OWNER" | "HOST_STAFF") => void;
  canActAsHostOwner: boolean;
}

const HostVenueContext = React.createContext<HostContextType | null>(null);

export function useHostVenue(): HostContextType {
  const context = React.useContext(HostVenueContext);
  if (!context) {
    // Graceful fallback if rendered outside layout
    return {
      currentLocation: DEMO_LOCATIONS[0],
      selectedLocationId: DEMO_LOCATIONS[0].id,
      setSelectedLocationId: () => {},
      allLocations: DEMO_LOCATIONS,
      effectiveHostRole: "HOST_OWNER",
      setHostRoleMode: () => {},
      canActAsHostOwner: true
    };
  }
  return context;
}

// ============================================================================
// Host Dashboard Shell & Layout (Enforces HOST_OWNER vs HOST_STAFF Boundaries)
// ============================================================================
export function HostDashboardLayout() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get("role")?.toUpperCase();
  const initialRole: "HOST_OWNER" | "HOST_STAFF" =
    roleParam === "HOST_STAFF" || roleParam === "STAFF" ? "HOST_STAFF" : "HOST_OWNER";
  const { isAuthenticated, user } = useAuthStore();
  const [hostRoleMode, setHostRoleMode] = useState<"HOST_OWNER" | "HOST_STAFF">(initialRole);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("loc-cmb-fort-01");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentLocation = useMemo(
    () => DEMO_LOCATIONS.find((l) => l.id === selectedLocationId) || DEMO_LOCATIONS[0],
    [selectedLocationId]
  );

  const isDemoActive = isDemoPreviewActive({
    allowDemoPreview: true,
    search: location.search,
    isAuthenticated
  });
  const querySuffix = isDemoActive ? "?preview=demo" : "";

  const canActAsHostOwner =
    !isAuthenticated ||
    Boolean(user?.roles?.includes("HOST_OWNER") || user?.roles?.includes("SUPERADMIN"));

  const effectiveHostRole: "HOST_OWNER" | "HOST_STAFF" = isAuthenticated
    ? canActAsHostOwner
      ? hostRoleMode
      : "HOST_STAFF"
    : hostRoleMode;

  // Canonical Host Navigation Items (Strictly Customer/Host Facing — Zero Developer Codes)
  const operationalNavItems = [
    { label: "Overview", to: "/host/dashboard", icon: LayoutDashboard, ownerOnly: false },
    { label: "Check-In & Out Desk", to: "/host/operations", icon: QrCode, ownerOnly: false, highlight: true },
    { label: "Bookings Hub", to: "/host/bookings", icon: Briefcase, ownerOnly: false },
    { label: "Storage Hubs", to: "/host/locations", icon: MapPin, ownerOnly: false },
    { label: "Customer Reviews", to: "/host/reviews", icon: Star, ownerOnly: false }
  ];

  const locationConfigNavItems = [
    { label: "Location Profile", to: `/host/locations/${selectedLocationId}`, icon: Building2, ownerOnly: true },
    { label: "Hours & Calendar", to: `/host/locations/${selectedLocationId}/schedule`, icon: Calendar, ownerOnly: true },
    { label: "Capacity & Zones", to: `/host/locations/${selectedLocationId}/capacity`, icon: Layers, ownerOnly: true },
    { label: "Pricing Rules", to: `/host/locations/${selectedLocationId}/pricing`, icon: Tag, ownerOnly: true }
  ];

  const businessNavItems = [
    { label: "Revenue & Ledger", to: "/host/finance", icon: Wallet, ownerOnly: true },
    { label: "Payout Accounts", to: "/host/payouts", icon: Building2, ownerOnly: true },
    { label: "Staff & Access", to: "/host/staff", icon: Users, ownerOnly: true },
    { label: "Business Settings", to: "/host/settings", icon: Settings, ownerOnly: true }
  ];

  const allNavItems = [...operationalNavItems, ...locationConfigNavItems, ...businessNavItems];
  const activeNavItem = allNavItems.find(
    (item) => location.pathname === item.to || location.pathname.startsWith(item.to + "/")
  );
  const isBlockedByStaffRole = effectiveHostRole === "HOST_STAFF" && activeNavItem?.ownerOnly;

  const contextValue: HostContextType = {
    currentLocation,
    selectedLocationId,
    setSelectedLocationId,
    allLocations: DEMO_LOCATIONS,
    effectiveHostRole,
    setHostRoleMode,
    canActAsHostOwner
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
              <p className="text-xs font-bold leading-tight truncate max-w-[180px]">{currentLocation.name}</p>
              <p className="text-[10px] text-sand-300">{currentLocation.city} • {effectiveHostRole === "HOST_OWNER" ? "Host Owner" : "Host Staff"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-xs font-semibold text-sand-100 flex items-center gap-1.5"
            aria-label="Toggle Host Menu"
          >
            <span>Menu</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mobileMenuOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Host Portal Sidebar */}
          <aside
            className={`lg:col-span-3 space-y-4 ${
              mobileMenuOpen ? "block" : "hidden lg:block"
            }`}
          >
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
                    : "Ceylon Transit Hospitality (Pvt) Ltd"}
                </p>
                <p className="text-[11px] text-sand-400 mt-0.5">Sample Host Partner Profile (Demo Preview)</p>
              </div>

              {/* Active Venue Selector */}
              <div className="space-y-1.5 pt-1 border-t border-navy-800/80">
                <label className="block text-[11px] font-semibold text-sand-300">
                  Active Storage Hub
                </label>
                <div className="relative">
                  <select
                    aria-label="Active Storage Hub"
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    className="w-full appearance-none rounded-xl bg-navy-900 border border-navy-700 px-3 py-2 text-xs text-sand-100 font-medium pr-8 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
                  >
                    {DEMO_LOCATIONS.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.city})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-sand-400 pointer-events-none" />
                </div>
              </div>

              {/* Role Switcher (Owner vs Staff preview) */}
              {canActAsHostOwner ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-sand-300 font-medium">
                    <span>Operating Role</span>
                    <span className="text-[10px] text-amber-400">Interactive Preview</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 bg-navy-900 p-1 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => setHostRoleMode("HOST_OWNER")}
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
                      onClick={() => setHostRoleMode("HOST_STAFF")}
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
              ) : (
                <div className="bg-navy-900 px-3 py-2 rounded-xl text-xs text-amber-300 font-medium flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Logged in as Staff (Counter Scope)</span>
                </div>
              )}
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
                      location.pathname === item.to ||
                      (item.to === "/host/dashboard" && location.pathname === "/host");
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
                          <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-white" : item.highlight ? "text-emerald-700" : "text-navy-500"}`} />
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

              {/* Location Configuration Section */}
              <div className="pt-2 border-t border-sand-100">
                <div className="flex items-center justify-between px-3 mb-1.5">
                  <p className="text-[10px] font-bold text-navy-400 uppercase tracking-wider">
                    Location Setup
                  </p>
                  {effectiveHostRole === "HOST_STAFF" && (
                    <span className="text-[9px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
                      Owner Only
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {locationConfigNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname.startsWith(item.to);
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
                          <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-white" : restricted ? "text-navy-300" : "text-navy-500"}`} />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {restricted && <Lock className="h-3 w-3 text-amber-500" />}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Financial & Business Section */}
              <div className="pt-2 border-t border-sand-100">
                <div className="flex items-center justify-between px-3 mb-1.5">
                  <p className="text-[10px] font-bold text-navy-400 uppercase tracking-wider">
                    Finance & Administration
                  </p>
                  {effectiveHostRole === "HOST_STAFF" && (
                    <span className="text-[9px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
                      Owner Only
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {businessNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.to;
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
                          <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-white" : restricted ? "text-navy-300" : "text-navy-500"}`} />
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
          <div className="lg:col-span-9">
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
                    Return to Check-In & Out Desk
                  </Link>
                  {canActAsHostOwner && (
                    <button
                      type="button"
                      onClick={() => setHostRoleMode("HOST_OWNER")}
                      className="px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold shadow-sm transition"
                    >
                      Switch to Host Owner Role
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </div>
      </div>
    </HostVenueContext.Provider>
  );
}

// ============================================================================
// HD-001: Host Overview Dashboard (/host/dashboard)
// ============================================================================
export function HostOverviewDashboardPage() {
  const { currentLocation } = useHostVenue();

  // Operational metrics
  const activeBagsInVault = 28;
  const totalCapacitySlots = currentLocation.totalCapacity;
  const occupancyPercentage = Math.round((activeBagsInVault / totalCapacitySlots) * 100);

  const todaysCheckInsCount = 6;
  const todaysCollectionsCount = 5;
  const netEarningsLkr = 184500;

  const overdueBookings = DEMO_BOOKINGS.filter((b) => b.status === "OVERDUE");

  return (
    <div className="space-y-6">
      {/* CWCP Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-navy-100 text-navy-900 border border-navy-200">
                Active Storage Hub
              </span>
              <span className="text-xs text-navy-600 font-medium">{currentLocation.city}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              {currentLocation.name}
            </h1>
            <p className="text-xs text-navy-600">
              Live custody workstation, capacity utilization, and today&apos;s customer handovers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/host/operations"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition"
            >
              <QrCode className="h-4 w-4" />
              <span>Open Check-In Desk</span>
            </Link>
            <Link
              to="/host/bookings"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-sand-300 text-navy-800 hover:bg-sand-50 text-xs font-bold transition"
            >
              <Briefcase className="h-3.5 w-3.5 text-navy-600" />
              <span>All Bookings</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Key Operational Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Bags in Vault */}
        <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-navy-500">
            <span>Bags in Vault</span>
            <Luggage className="h-4 w-4 text-terracotta-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-extrabold text-navy-950">
              {activeBagsInVault} <span className="text-sm font-semibold text-navy-500">/ {totalCapacitySlots} slots</span>
            </p>
            <span className="text-xs font-bold text-emerald-700">{occupancyPercentage}% full</span>
          </div>
          <div className="w-full bg-sand-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-terracotta-500 h-1.5 rounded-full transition-all"
              style={{ width: `${occupancyPercentage}%` }}
            />
          </div>
          <p className="text-[11px] text-navy-600 font-medium">Reconciled and sealed with tamper tags</p>
        </div>

        {/* Card 2: Today's Check-Ins */}
        <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-navy-500">
            <span>Today&apos;s Arrivals</span>
            <ArrowRight className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-navy-950">{todaysCheckInsCount} Bags</p>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>3 checked in • 3 pending arrival</span>
          </div>
          <p className="text-[11px] text-navy-500">Next arrival scheduled at 11:30 IST</p>
        </div>

        {/* Card 3: Today's Collections */}
        <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-navy-500">
            <span>Today&apos;s Pickups</span>
            <Clock className="h-4 w-4 text-sky-600" />
          </div>
          <p className="text-2xl font-extrabold text-navy-950">{todaysCollectionsCount} Bags</p>
          <div className="flex items-center gap-1.5 text-[11px] text-navy-700 font-semibold">
            <span>4 completed • 1 overdue notice</span>
          </div>
          <p className="text-[11px] text-amber-700 font-semibold">30m grace window monitored</p>
        </div>

        {/* Card 4: Net Host Balance */}
        <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-navy-500">
            <span>Net Cleared Earnings</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-navy-950">{formatLkr(netEarningsLkr)}</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
            <span>85% net host share</span>
          </div>
          <p className="text-[11px] text-navy-500">Next batch payout: Friday (CEFT)</p>
        </div>
      </div>

      {/* Overdue Bag Urgent Alert Banner */}
      {overdueBookings.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-200/70 text-amber-900 mt-0.5">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                  Overdue Custody Notice
                </span>
                <span className="text-xs font-mono font-bold text-navy-900">
                  {overdueBookings[0].reference}
                </span>
              </div>
              <p className="text-xs text-navy-800 font-medium mt-1">
                Traveller <strong className="font-semibold">{overdueBookings[0].travellerName}</strong> was scheduled for collection at 20:00 IST. The 30-minute grace window has elapsed. Disclosed late rate active.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={`tel:${overdueBookings[0].travellerPhone}`}
              className="px-3 py-1.5 rounded-xl border border-amber-400 bg-white text-navy-900 text-xs font-bold hover:bg-amber-100/50 transition flex items-center gap-1.5"
            >
              <Phone className="h-3.5 w-3.5 text-terracotta-600" />
              <span>Call Traveller</span>
            </a>
            <Link
              to={`/host/bookings?inspect=${overdueBookings[0].id}`}
              className="px-3 py-1.5 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800 transition"
            >
              Inspect Booking
            </Link>
          </div>
        </div>
      )}

      {/* Main Two-Column Operations Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Today's Custody Movement Queue */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-navy-950">Today&apos;s Custody Movement Queue</h2>
                <p className="text-xs text-navy-600">Upcoming arrivals, active vault storage, and pending handovers</p>
              </div>
              <Link
                to="/host/bookings"
                className="text-xs font-bold text-terracotta-600 hover:text-terracotta-700 flex items-center gap-1"
              >
                <span>Full Ledger</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-sand-200 text-navy-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-2.5">Reference</th>
                    <th className="pb-2.5">Traveller</th>
                    <th className="pb-2.5">Bags & Zone</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 text-right">Counter Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {DEMO_BOOKINGS.slice(0, 5).map((booking) => {
                    const isCheckedIn = booking.status === "CHECKED_IN";
                    const isOverdue = booking.status === "OVERDUE";
                    const isConfirmed = booking.status === "CONFIRMED";
                    const isPending = booking.status === "PENDING_HOST_APPROVAL";

                    return (
                      <tr key={booking.id} className="hover:bg-sand-50/60 transition">
                        <td className="py-3 font-mono font-bold text-navy-900">
                          {booking.reference}
                        </td>
                        <td className="py-3">
                          <p className="font-semibold text-navy-900">{booking.travellerName}</p>
                          <p className="text-[10px] text-navy-500">{booking.travellerPhone}</p>
                        </td>
                        <td className="py-3">
                          <span className="font-semibold text-navy-800">{booking.totalBags} Bags</span>
                          <span className="text-[10px] text-navy-500 ml-1.5 px-1.5 py-0.5 rounded bg-sand-100 font-mono">
                            {booking.zoneCode}
                          </span>
                        </td>
                        <td className="py-3">
                          {isCheckedIn && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              In Custody
                            </span>
                          )}
                          {isOverdue && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              Overdue
                            </span>
                          )}
                          {isConfirmed && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Confirmed
                            </span>
                          )}
                          {isPending && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                              Approval SLA (11m)
                            </span>
                          )}
                          {booking.status === "COMPLETED" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Completed
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {isCheckedIn ? (
                            <Link
                              to={`/host/operations?ref=${booking.reference}&mode=checkout`}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-xs"
                            >
                              Check-Out
                            </Link>
                          ) : isConfirmed ? (
                            <Link
                              to={`/host/operations?ref=${booking.reference}&mode=checkin`}
                              className="px-2.5 py-1 rounded-lg bg-terracotta-500 hover:bg-terracotta-600 text-white font-bold text-[11px] transition shadow-xs"
                            >
                              Check-In
                            </Link>
                          ) : (
                            <Link
                              to={`/host/bookings?inspect=${booking.id}`}
                              className="px-2.5 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 text-navy-800 font-bold text-[11px] transition"
                            >
                              Inspect
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Physical Zone Capacity Meters */}
          <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-navy-950">Physical Zone Capacity</h3>
                <p className="text-xs text-navy-600">Real-time rack and compartment occupancy</p>
              </div>
              <Link
                to={`/host/locations/${currentLocation.id}/capacity`}
                className="text-xs font-bold text-terracotta-600 hover:text-terracotta-700"
              >
                Manage Zones →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {currentLocation.zones.map((zone) => {
                const zonePercent = Math.round((zone.occupied / zone.capacity) * 100);
                return (
                  <div
                    key={zone.id}
                    className="p-3.5 rounded-xl bg-sand-50/70 border border-sand-200 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-navy-900">{zone.code}</span>
                      <span className="text-xs font-semibold text-navy-700">{zonePercent}%</span>
                    </div>
                    <p className="text-xs font-medium text-navy-800 truncate">{zone.name}</p>
                    <div className="w-full bg-sand-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          zonePercent > 80 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${zonePercent}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-navy-500">
                      {zone.occupied} of {zone.capacity} occupied
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Staff on Duty & Trust Protocols */}
        <div className="lg:col-span-4 space-y-6">
          {/* Staff on Duty */}
          <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-navy-950">Staff on Counter Duty</h3>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-sand-50 border border-sand-200">
              <div className="h-10 w-10 rounded-full bg-navy-900 text-white flex items-center justify-center font-bold text-sm">
                RF
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-navy-900 truncate">Roshan Fernando</p>
                <p className="text-[11px] text-navy-600">Counter Supervisor • Fort Hub</p>
                <p className="text-[10px] text-emerald-700 font-semibold">14 handovers completed today</p>
              </div>
            </div>
            <p className="text-[11px] text-navy-600">
              Responsible for physical seal application, camera evidence checks, and rate-limited PIN releases.
            </p>
          </div>

          {/* Recent Verified Review */}
          <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-navy-950">Recent Guest Review</h3>
              <div className="flex items-center text-amber-500 text-xs">
                <span>★★★★★</span>
              </div>
            </div>
            <blockquote className="text-xs text-navy-700 italic border-l-2 border-terracotta-500 pl-3">
              &ldquo;Super fast QR check-in right outside Colombo Fort Station! Loved seeing the numbered security seal placed on our backpacks.&rdquo;
            </blockquote>
            <div className="flex items-center justify-between text-[11px] text-navy-500 pt-1">
              <span>Amaya Perera (Sri Lanka)</span>
              <span>Yesterday</span>
            </div>
          </div>

          {/* Custody Best Practices Card */}
          <div className="bg-navy-950 text-white rounded-2xl p-5 shadow-sm space-y-3 border border-navy-800">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" />
              <span>Custody Verification Rules</span>
            </div>
            <ul className="text-xs text-sand-200 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-terracotta-400 font-bold">•</span>
                <span>Tamper-evident seals are mandatory on every zipper before storage.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-terracotta-400 font-bold">•</span>
                <span>Reconcile physical bag count against booking before handing receipt.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-terracotta-400 font-bold">•</span>
                <span>6-digit PIN fallback is logged and rate-limited for security audit.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HD-002: Location Management (/host/locations)
// ============================================================================
export function HostLocationManagementPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredLocations = useMemo(() => {
    return DEMO_LOCATIONS.filter(
      (loc) =>
        loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.landmark.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Storage Locations
            </h1>
            <p className="text-xs text-navy-600 mt-1">
              Manage multi-hub capacity, operating schedules, and LKR rates across Sri Lankan transit hubs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition"
          >
            <Plus className="h-4 w-4" />
            <span>Register New Storage Hub</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="mt-5 relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-navy-400" />
          <input
            type="text"
            placeholder="Search by hub name, city (e.g. Colombo, Ella, Kandy), or landmark..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-sand-300 pl-10 pr-4 py-2.5 text-xs text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
          />
        </div>
      </div>

      {/* Location Directory Cards */}
      <div className="space-y-4">
        {filteredLocations.map((loc) => (
          <div
            key={loc.id}
            className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm hover:border-sand-300 transition space-y-4"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                    Active Storage Venue
                  </span>
                  <span className="text-xs font-bold text-navy-600">{loc.city} • {loc.district}</span>
                  <span className="text-xs text-amber-600 font-bold flex items-center gap-1">
                    ★ {loc.rating} ({loc.reviewCount} reviews)
                  </span>
                </div>
                <h2 className="text-lg font-bold text-navy-950">{loc.name}</h2>
                <p className="text-xs text-navy-600 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-terracotta-600 flex-shrink-0" />
                  <span>{loc.landmark}</span>
                </p>
                <p className="text-[11px] text-navy-500">
                  <strong className="text-navy-700">Public Masked Address:</strong> {loc.addressMasked}
                </p>
              </div>

              {/* Status and Capacity */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-t lg:border-t-0 pt-3 lg:pt-0 border-sand-100">
                <div className="text-left sm:text-right">
                  <p className="text-xs font-bold text-navy-900">
                    {loc.availableCapacity} of {loc.totalCapacity} Slots Available
                  </p>
                  <p className="text-[11px] text-navy-500">
                    Operating: <span className="font-semibold text-navy-700">{loc.openHours}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action Navigation Grid */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-sand-100">
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="px-2.5 py-1 rounded-lg bg-sand-100 text-navy-700 font-medium">
                  {loc.is24Hours ? "24/7 Access" : "Shift Hours"}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-sand-100 text-navy-700 font-medium">
                  {loc.hasClimateControl ? "Climate Control" : "Standard Vault"}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-sand-100 text-navy-700 font-medium">
                  LKR 250k Protection
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/host/locations/${loc.id}`}
                  className="px-3 py-1.5 rounded-lg border border-sand-300 text-xs font-bold text-navy-800 hover:bg-sand-50 transition"
                >
                  Edit Profile
                </Link>
                <Link
                  to={`/host/locations/${loc.id}/schedule`}
                  className="px-3 py-1.5 rounded-lg border border-sand-300 text-xs font-bold text-navy-800 hover:bg-sand-50 transition"
                >
                  Hours & Calendar
                </Link>
                <Link
                  to={`/host/locations/${loc.id}/capacity`}
                  className="px-3 py-1.5 rounded-lg border border-sand-300 text-xs font-bold text-navy-800 hover:bg-sand-50 transition"
                >
                  Capacity & Zones
                </Link>
                <Link
                  to={`/host/locations/${loc.id}/pricing`}
                  className="px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition shadow-xs"
                >
                  Pricing Rules
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Location Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-sand-200 max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <h3 className="text-base font-bold text-navy-950">Register New Storage Location</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-sand-100 text-navy-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-navy-600">
              New locations are submitted to platform operations for address verification, CCTV check, and physical security inspection before going live.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-navy-900 mb-1">Proposed Hub Name</label>
                <input
                  type="text"
                  placeholder="e.g. Mirissa Beach Surf & Transit Lounge"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-navy-900 mb-1">City / Town</label>
                  <input
                    type="text"
                    placeholder="e.g. Mirissa"
                    className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-navy-900 mb-1">Initial Slot Capacity</label>
                  <input
                    type="number"
                    defaultValue={40}
                    className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl border border-sand-300 text-xs font-bold text-navy-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-terracotta-500 text-white text-xs font-bold"
              >
                Submit for Verification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HD-003: Location Profile Editor (/host/locations/:id)
// ============================================================================
export function HostLocationProfileEditorPage() {
  const { id } = useParams<{ id: string }>();
  const loc = DEMO_LOCATIONS.find((l) => l.id === id) || DEMO_LOCATIONS[0];

  const [name, setName] = useState(loc.name);
  const [landmark, setLandmark] = useState(loc.landmark);
  const [description, setDescription] = useState(loc.description);
  const [addressMasked, setAddressMasked] = useState(loc.addressMasked);
  const [addressExact, setAddressExact] = useState(loc.addressExact);
  const [photoPolicy, setPhotoPolicy] = useState<string>(loc.photoEvidencePolicy);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link to="/host/locations" className="text-xs font-bold text-terracotta-600 hover:underline">
                ← Storage Locations
              </Link>
              <span className="text-xs text-navy-400">•</span>
              <span className="text-xs font-medium text-navy-600">{loc.city}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Location Profile Editor
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Public display name, privacy-preserving address masking, and storage amenities.
            </p>
          </div>
          <button
            type="submit"
            form="location-profile-form"
            className="px-5 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition"
          >
            Save Location Profile
          </button>
        </div>
      </div>

      {savedNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>Location profile updated successfully for {name}. Changes saved to local session.</span>
        </div>
      )}

      {/* Editor Form */}
      <form id="location-profile-form" onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Public Identity */}
        <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-navy-950">Public Profile Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Venue Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-sand-300 px-3.5 py-2 text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">Transit Landmark</label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                className="w-full rounded-xl border border-sand-300 px-3.5 py-2 text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-navy-900 mb-1">Public Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-sand-300 px-3.5 py-2 text-xs text-navy-900 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            />
          </div>
        </div>

        {/* Section 2: Address Privacy & Masking */}
        <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-navy-950">Address Privacy & Masked Coordinates</h2>
            <p className="text-xs text-navy-600">
              To prevent crowding and ensure verified bookings, exact street numbers are hidden until a traveller confirms their reservation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">
                Masked Address (Shown to Public Pre-Booking)
              </label>
              <input
                type="text"
                value={addressMasked}
                onChange={(e) => setAddressMasked(e.target.value)}
                className="w-full rounded-xl border border-sand-300 px-3.5 py-2 text-xs text-navy-900 font-medium"
              />
              <p className="text-[10px] text-navy-500 mt-1">General area and nearest intersection only.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-navy-900 mb-1">
                Exact Street Address (Revealed Only Post-Booking)
              </label>
              <input
                type="text"
                value={addressExact}
                onChange={(e) => setAddressExact(e.target.value)}
                className="w-full rounded-xl border border-sand-300 px-3.5 py-2 text-xs text-navy-900 font-medium"
              />
              <p className="text-[10px] text-navy-500 mt-1">Includes building number, entrance floor, and counter suite.</p>
            </div>
          </div>
        </div>

        {/* Section 3: Amenities & Security */}
        <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-navy-950">Security & Operational Policies</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-navy-900 mb-1">Check-in Photo Evidence Requirement</label>
              <select
                aria-label="Check-in Photo Evidence Requirement"
                value={photoPolicy}
                onChange={(e) => setPhotoPolicy(e.target.value)}
                className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-medium text-navy-900"
              >
                <option value="CONFIGURED_MANDATORY">
                  Mandatory Bag Photos (Recommended for High-Traffic Hubs)
                </option>
                <option value="OPTIONAL_BY_DEFAULT">
                  Optional Bag Photos (Speed-First Counter Protocol)
                </option>
              </select>
              <p className="text-[10px] text-navy-500 mt-1">
                Mandatory photo capture attaches intake photos to the custody audit log. (Prototype Option: DEC-001 Pending PO Sign-Off)
              </p>
            </div>
            <div className="space-y-2">
              <label className="block font-bold text-navy-900">Active Venue Amenities</label>
              <div className="space-y-1.5 text-xs text-navy-800">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded text-terracotta-500" />
                  <span>24/7 Monitored CCTV Recording</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded text-terracotta-500" />
                  <span>Climate-Controlled &amp; Dehumidified Air</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded text-terracotta-500" />
                  <span>Tamper-Evident Security Seals Supplied</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded text-terracotta-500" />
                  <span>Ground Floor Easy Luggage Access</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// HD-004: Schedule & Calendar Editor (/host/locations/:id/schedule)
// ============================================================================
export function HostScheduleCalendarEditorPage() {
  const { id } = useParams<{ id: string }>();
  const loc = DEMO_LOCATIONS.find((l) => l.id === id) || DEMO_LOCATIONS[0];

  const daysOfWeek = [
    { day: "Monday", open: "06:00", close: "23:00", is24h: false },
    { day: "Tuesday", open: "06:00", close: "23:00", is24h: false },
    { day: "Wednesday", open: "06:00", close: "23:00", is24h: false },
    { day: "Thursday", open: "06:00", close: "23:00", is24h: false },
    { day: "Friday", open: "06:00", close: "23:00", is24h: false },
    { day: "Saturday", open: "06:00", close: "23:00", is24h: false },
    { day: "Sunday", open: "06:00", close: "23:00", is24h: false }
  ];

  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link to="/host/locations" className="text-xs font-bold text-terracotta-600 hover:underline">
                ← Storage Locations
              </Link>
              <span className="text-xs text-navy-400">•</span>
              <span className="text-xs font-medium text-navy-600">{loc.name}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Operating Hours &amp; Holiday Exceptions
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Prevent bookings outside active staff shifts and configure Sri Lankan Poya &amp; mercantile holiday closures.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 3000);
            }}
            className="px-5 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition"
          >
            Save Schedule
          </button>
        </div>
      </div>

      {saved && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>Weekly schedule updated successfully. Saved to local session.</span>
        </div>
      )}

      {/* 7-Day Matrix */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy-950">Standard Weekly Schedule</h2>
          <span className="text-xs text-navy-500">Sri Lanka Standard Time (IST, UTC+5:30)</span>
        </div>

        <div className="space-y-2">
          {daysOfWeek.map((item) => (
            <div
              key={item.day}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-sand-50/70 border border-sand-200 text-xs gap-3"
            >
              <div className="flex items-center gap-3 w-36">
                <input type="checkbox" defaultChecked className="rounded text-terracotta-500" />
                <span className="font-bold text-navy-900">{item.day}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-navy-600">Open:</span>
                <input
                  type="text"
                  defaultValue={item.open}
                  className="w-20 px-2 py-1 rounded-lg border border-sand-300 font-mono text-center text-xs"
                />
                <span className="text-navy-600">to</span>
                <input
                  type="text"
                  defaultValue={item.close}
                  className="w-20 px-2 py-1 rounded-lg border border-sand-300 font-mono text-center text-xs"
                />
              </div>
              <div className="flex items-center gap-4 text-[11px] text-navy-600">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" defaultChecked className="rounded text-terracotta-500" />
                  <span>Drop-Off</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" defaultChecked className="rounded text-terracotta-500" />
                  <span>Pick-Up</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sri Lankan Poya & Public Holidays Calendar */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-navy-950">Sri Lankan Poya &amp; Mercantile Exceptions</h2>
          <p className="text-xs text-navy-600">
            Sri Lanka observes monthly Full Moon Poya statutory holidays. Set special hours or close counter operations on these dates.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-navy-900">Unduvap Full Moon Poya</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                Special Hours
              </span>
            </div>
            <p className="text-navy-600 text-[11px]">23 December 2026 • 08:00 – 18:00 IST</p>
          </div>
          <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-navy-900">Duruthu Full Moon Poya</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Normal Hours
              </span>
            </div>
            <p className="text-navy-600 text-[11px]">22 January 2027 • 06:00 – 23:00 IST</p>
          </div>
          <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-navy-900">National Independence Day</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                Closed
              </span>
            </div>
            <p className="text-navy-600 text-[11px]">04 February 2027 • Counter Closed</p>
          </div>
          <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-navy-900">Navam Full Moon Poya</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                Special Hours
              </span>
            </div>
            <p className="text-navy-600 text-[11px]">20 February 2027 • 08:00 – 18:00 IST</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HD-005: Capacity Pools & Zones (/host/locations/:id/capacity)
// ============================================================================
export function HostCapacityPoolsZonesPage() {
  const { id } = useParams<{ id: string }>();
  const loc = DEMO_LOCATIONS.find((l) => l.id === id) || DEMO_LOCATIONS[0];
  const [showAddZone, setShowAddZone] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link to="/host/locations" className="text-xs font-bold text-terracotta-600 hover:underline">
                ← Storage Locations
              </Link>
              <span className="text-xs text-navy-400">•</span>
              <span className="text-xs font-medium text-navy-600">{loc.name}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Capacity Pools &amp; Storage Zones
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Manage physical storage compartments, rack limits, and bag size weight equivalents.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddZone(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Storage Zone</span>
          </button>
        </div>
      </div>

      {/* Aggregate Capacity Overview */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sand-100 pb-4">
          <div>
            <h2 className="text-sm font-bold text-navy-950">Aggregate Venue Capacity</h2>
            <p className="text-xs text-navy-600">80 Total Compartment Units across 3 active zones</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-navy-500">Occupied:</span>{" "}
              <strong className="text-navy-950 font-bold">28 slots (35%)</strong>
            </div>
            <div>
              <span className="text-navy-500">Available:</span>{" "}
              <strong className="text-emerald-700 font-bold">52 slots</strong>
            </div>
          </div>
        </div>

        {/* Slot Weight Multiplier Reference */}
        <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 text-xs space-y-2">
          <p className="font-bold text-navy-900">Bag Category Slot Weight Equivalents</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-navy-700">
            <div>Small Backpack: <strong className="font-semibold">0.5 slots</strong></div>
            <div>Cabin Trolley: <strong className="font-semibold">1.0 slot</strong></div>
            <div>Large Checked Bag: <strong className="font-semibold">1.5 slots</strong></div>
            <div>Oversized Surf/Golf: <strong className="font-semibold">2.0 slots</strong></div>
          </div>
        </div>
      </div>

      {/* Zone Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loc.zones.map((zone) => {
          const percent = Math.round((zone.occupied / zone.capacity) * 100);
          return (
            <div
              key={zone.id}
              className="bg-white rounded-2xl border border-sand-200 p-5 space-y-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-navy-100 text-navy-900 border border-navy-200">
                  {zone.code}
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  {zone.capacity - zone.occupied} Free
                </span>
              </div>
              <div>
                <h3 className="font-bold text-navy-950 text-sm">{zone.name}</h3>
                <p className="text-xs text-navy-500 mt-0.5">
                  Occupied: {zone.occupied} of {zone.capacity} slots ({percent}%)
                </p>
              </div>
              <div className="w-full bg-sand-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-terracotta-500 h-2 rounded-full transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <button
                type="button"
                className="w-full py-1.5 rounded-lg border border-sand-300 text-xs font-bold text-navy-800 hover:bg-sand-50 transition"
              >
                Configure Zone Limits
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Zone Modal */}
      {showAddZone && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-sand-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <h3 className="text-base font-bold text-navy-950">Add Physical Storage Zone</h3>
              <button
                type="button"
                onClick={() => setShowAddZone(false)}
                className="p-1 rounded-lg hover:bg-sand-100 text-navy-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-navy-900 mb-1">Zone Code Prefix</label>
                <input
                  type="text"
                  placeholder="e.g. LOCKER-D"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Zone Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. High-Security Electronic Lockers"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Slot Capacity</label>
                <input
                  type="number"
                  defaultValue={20}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddZone(false)}
                className="px-4 py-2 rounded-xl border border-sand-300 text-xs font-bold text-navy-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowAddZone(false)}
                className="px-4 py-2 rounded-xl bg-terracotta-500 text-white text-xs font-bold"
              >
                Add Zone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HD-006: Pricing Rules & Multipliers (/host/locations/:id/pricing)
// ============================================================================
export function HostPricingRulesMultipliersPage() {
  const { id } = useParams<{ id: string }>();
  const loc = DEMO_LOCATIONS.find((l) => l.id === id) || DEMO_LOCATIONS[0];

  const [gracePeriodMins, setGracePeriodMins] = useState<number>(loc.gracePeriodMinutes);
  const [lateFeeRule, setLateFeeRule] = useState<string>("STANDARD_HOURLY_OR_DAILY_TIER");
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link to="/host/locations" className="text-xs font-bold text-terracotta-600 hover:underline">
                ← Storage Locations
              </Link>
              <span className="text-xs text-navy-400">•</span>
              <span className="text-xs font-medium text-navy-600">{loc.name}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Pricing Rules &amp; Multipliers
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Configure LKR rates per bag tier and location-specific configurable grace periods and late collection fee policies.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 3000);
            }}
            className="px-5 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition"
          >
            Save Pricing Rules
          </button>
        </div>
      </div>

      {saved && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>Pricing rules updated successfully. Saved to local session.</span>
        </div>
      )}

      {/* 4-Tier Pricing Grid */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-navy-950">Standard Tiered Storage Rates (LKR)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(["SMALL", "MEDIUM", "LARGE", "OVERSIZED"] as const).map((tier) => (
            <div
              key={tier}
              className="p-4 rounded-xl bg-sand-50/70 border border-sand-200 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-navy-900">{tier} BAG</span>
                <span className="text-[10px] text-navy-500">Tier Rates</span>
              </div>
              <div className="space-y-1 text-xs">
                <label className="block text-[11px] text-navy-600 font-medium">Hourly Rate (LKR)</label>
                <input
                  type="number"
                  defaultValue={loc.hourlyRateLkr[tier]}
                  className="w-full px-3 py-1.5 rounded-lg border border-sand-300 font-mono text-xs font-bold text-navy-900"
                />
              </div>
              <div className="space-y-1 text-xs">
                <label className="block text-[11px] text-navy-600 font-medium">Daily Cap (LKR)</label>
                <input
                  type="number"
                  defaultValue={loc.dailyCapLkr[tier]}
                  className="w-full px-3 py-1.5 rounded-lg border border-sand-300 font-mono text-xs font-bold text-navy-900"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Configurable Grace Period & Late Fee Policy */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-navy-950">
            Late Collection Grace Period &amp; Fee Policy (DEC-002 Pending PO Sign-Off)
          </h2>
          <p className="text-xs text-navy-600">
            Grace periods and late collection fees are configurable per location and disclosed to travellers before checkout. In accordance with platform policy, baggage release is never withheld for overdue fee collection.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-navy-900 mb-1">
              Configurable Grace Period (Minutes)
            </label>
            <select
              aria-label="Configurable Grace Period"
              value={gracePeriodMins}
              onChange={(e) => setGracePeriodMins(Number(e.target.value))}
              className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-medium text-navy-900"
            >
              <option value={15}>15 Minutes</option>
              <option value={30}>30 Minutes (Recommended)</option>
              <option value={45}>45 Minutes (Train Delay Buffer)</option>
              <option value={60}>60 Minutes (Airport Flight Buffer)</option>
            </select>
          </div>
          <div>
            <label className="block font-bold text-navy-900 mb-1">
              Late Collection Surcharge Policy (Illustrative Prototype)
            </label>
            <select
              aria-label="Late Collection Surcharge Policy"
              value={lateFeeRule}
              onChange={(e) => setLateFeeRule(e.target.value)}
              className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-medium text-navy-900"
            >
              <option value="STANDARD_HOURLY_OR_DAILY_TIER">
                Standard Hourly Extension (No Additional Surcharge)
              </option>
              <option value="ILLUSTRATIVE_1_5X_DAILY">
                1.5x Hourly Late Extension (Disclosed Pre-Checkout)
              </option>
              <option value="FLAT_LATE_HANDLING_FEE">
                Flat Handling Fee (LKR 500 per Bag)
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HD-007 & HD-008: Booking Management Hub & Custody Investigation Drawer
// ============================================================================
export function HostBookingManagementHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const inspectId = searchParams.get("inspect");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [inspectedBooking, setInspectedBooking] = useState<DemoBookingRecord | null>(() =>
    inspectId ? DEMO_BOOKINGS.find((b) => b.id === inspectId) || DEMO_BOOKINGS[0] : null
  );

  const openInvestigationModal = (b: DemoBookingRecord) => {
    setInspectedBooking(b);
    setSearchParams({ inspect: b.id });
  };

  const closeInvestigationModal = () => {
    setInspectedBooking(null);
    setSearchParams({});
  };

  const filteredBookings = useMemo(() => {
    return DEMO_BOOKINGS.filter((b) => {
      const matchesSearch =
        b.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.travellerName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "CHECKED_IN" && b.status === "CHECKED_IN") ||
        (statusFilter === "CONFIRMED" && b.status === "CONFIRMED") ||
        (statusFilter === "OVERDUE" && b.status === "OVERDUE") ||
        (statusFilter === "COMPLETED" && b.status === "COMPLETED");

      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Booking Management Hub
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Review 15-minute SLA approval requests, active check-ins, overdue bags, and full custody audit trails.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openInvestigationModal(DEMO_BOOKINGS[0])}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold shadow-sm transition"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Inspect Custody Evidence</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-navy-400" />
            <input
              type="text"
              placeholder="Search by reference (e.g. LS-2026-8841) or traveller name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-sand-300 pl-10 pr-4 py-2.5 text-xs text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["ALL", "CHECKED_IN", "CONFIRMED", "OVERDUE", "COMPLETED"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === st
                    ? "bg-navy-900 text-white"
                    : "bg-sand-100 text-navy-700 hover:bg-sand-200"
                }`}
              >
                {st === "ALL" ? "All Bookings" : st.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl border border-sand-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-sand-50 border-b border-sand-200 text-navy-500 uppercase font-bold text-[10px] tracking-wider">
                <th className="p-3.5">Reference</th>
                <th className="p-3.5">Traveller &amp; Contact</th>
                <th className="p-3.5">Bags &amp; Zone</th>
                <th className="p-3.5">Custody Status</th>
                <th className="p-3.5">Host Net (85%)</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {filteredBookings.map((b) => (
                <tr key={b.id} className="hover:bg-sand-50/70 transition">
                  <td className="p-3.5 font-mono font-bold text-navy-900">{b.reference}</td>
                  <td className="p-3.5">
                    <p className="font-semibold text-navy-950">{b.travellerName}</p>
                    <p className="text-[10px] text-navy-500">{b.travellerPhone}</p>
                  </td>
                  <td className="p-3.5 text-navy-700">
                    <span className="font-semibold">{b.totalBags} Bags</span> •{" "}
                    <span className="font-mono text-[11px] px-1 py-0.5 rounded bg-sand-100">{b.zoneCode}</span>
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                        b.status === "CHECKED_IN"
                          ? "bg-blue-50 text-blue-800 border border-blue-200"
                          : b.status === "OVERDUE"
                          ? "bg-rose-50 text-rose-800 border border-rose-200"
                          : b.status === "CONFIRMED"
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {b.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="p-3.5 font-bold text-emerald-700">
                    {formatLkr(b.hostNetPayoutLkr)}
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => openInvestigationModal(b)}
                      className="px-3 py-1.5 rounded-lg bg-navy-100 hover:bg-navy-200 text-navy-900 font-bold text-xs transition"
                    >
                      Investigate Custody
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* HD-008: Booking Custody Investigation Modal / Drawer */}
      {inspectedBooking && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-sand-200 max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-navy-900 text-white font-mono text-xs font-bold">
                  Custody Audit
                </span>
                <h3 className="text-base font-bold text-navy-950">
                  Custody Evidence — {inspectedBooking.reference}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeInvestigationModal}
                className="p-1.5 rounded-lg hover:bg-sand-100 text-navy-500"
                aria-label="Close investigation modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Custody Lifecycle Audit Timeline */}
            <div className="space-y-2 text-xs">
              <p className="font-bold text-navy-900 uppercase text-[10px] tracking-wider">
                Custody Lifecycle Events
              </p>
              <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200 space-y-2 text-navy-800">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-navy-950">1. Reservation Confirmed</strong>
                    <p className="text-[11px] text-navy-500">Gross {formatLkr(inspectedBooking.totalAmountLkr)} • Host Net {formatLkr(inspectedBooking.hostNetPayoutLkr)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-navy-950">2. Physical Intake Handover</strong>
                    <p className="text-[11px] text-navy-500">Prototype Intake: Handover recorded against demo session fixture • Backup PIN: <span className="font-mono">{inspectedBooking.pinCode}</span></p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-navy-950">3. Tamper-Evident Security Seals Applied</strong>
                    <p className="text-[11px] text-navy-500">
                      {inspectedBooking.sealIds.length > 0
                        ? inspectedBooking.sealIds.join(", ")
                        : "Pending seal application"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-navy-950">4. Vault Compartment Assigned</strong>
                    <p className="text-[11px] text-navy-500">Placed in Zone {inspectedBooking.zoneCode} • Attributed to Staff <span className="font-mono">staff-usr-204</span></p>
                  </div>
                </div>
              </div>
            </div>

            {/* Traveller & Contact Dossier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 space-y-1.5">
                <p className="font-bold text-navy-950">Traveller Information</p>
                <p className="text-navy-700">Name: <strong className="text-navy-900">{inspectedBooking.travellerName}</strong></p>
                <p className="text-navy-700">Email: {inspectedBooking.travellerEmail}</p>
                <p className="text-navy-700">
                  Phone:{" "}
                  <a
                    href={`tel:${inspectedBooking.travellerPhone}`}
                    className="font-bold text-terracotta-600 hover:underline"
                  >
                    {inspectedBooking.travellerPhone}
                  </a>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 space-y-1.5">
                <p className="font-bold text-navy-950">Custody Audit Details</p>
                <p className="text-navy-700">Reconciled Bags: <strong className="text-navy-900">{inspectedBooking.totalBags} Bags</strong></p>
                <p className="text-navy-700">Photo Evidence: {inspectedBooking.evidencePhotosCount} photos captured</p>
                <p className="text-navy-700">Responsible Counter Staff: <span className="font-mono text-navy-900 font-bold">Roshan Fernando</span></p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-sand-100">
              <span className="text-[11px] text-navy-500">
                Timestamped intake &amp; seal evidence verified
              </span>
              <button
                type="button"
                onClick={closeInvestigationModal}
                className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition"
              >
                Close Audit Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HD-009: Web Check-in/Out Operations (/host/operations)
// ============================================================================
export function HostWebCheckInOutOperationsPage() {
  const [operationMode, setOperationMode] = useState<"CHECK_IN" | "CHECK_OUT">("CHECK_IN");
  const [verificationMethod, setVerificationMethod] = useState<"QR_SCAN" | "PIN_FALLBACK">("QR_SCAN");
  const [lookupQuery, setLookupQuery] = useState("LS-2026-8841");
  const [pinInput, setPinInput] = useState("482910");
  const [reconciledBags, setReconciledBags] = useState(3);
  const [sealInput, setSealInput] = useState("SEAL-LK-90211");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [handoverSuccessMessage, setHandoverSuccessMessage] = useState<string | null>(null);

  const handleSimulateHandover = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setHandoverSuccessMessage(
        operationMode === "CHECK_IN"
          ? `Local Prototype Simulation: Custody Handover logged to workstation session for booking ${lookupQuery}. Reconciled ${reconciledBags} bags. Numbered Seal ${sealInput} logged. Acting staff: Roshan Fernando (staff-usr-204). (Requires API integration in Phase 3+)`
          : `Local Prototype Simulation: Baggage Release logged to workstation session for booking ${lookupQuery} via ${verificationMethod}. Reconciled ${reconciledBags} bags returned to guest. Custody cleared. (Requires API integration in Phase 3+)`
      );
    }, 700);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Desk Counter Active
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Check-In &amp; Check-Out Desk
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Physical counter intake and release workstation with QR scan, 6-digit backup PIN, bag reconciliation, and tamper seal verification.
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-sand-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setOperationMode("CHECK_IN");
                setHandoverSuccessMessage(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                operationMode === "CHECK_IN"
                  ? "bg-terracotta-500 text-white shadow-xs"
                  : "text-navy-700 hover:text-navy-900"
              }`}
            >
              Intake Handover
            </button>
            <button
              type="button"
              onClick={() => {
                setOperationMode("CHECK_OUT");
                setHandoverSuccessMessage(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                operationMode === "CHECK_OUT"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-navy-700 hover:text-navy-900"
              }`}
            >
              Release Pick-Up
            </button>
          </div>
        </div>
      </div>

      {/* Honest Prototype Notice */}
      <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
        <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-navy-950">Desktop Counter Workstation (Local Prototype Simulation):</strong> Supports manual barcode scanner input, booking lookup, or 6-digit backup PIN verification. Physical intake and releases in this prototype session update client state and will connect to the live backend custody API in Phase 3+. Optical camera scanning requires a mobile companion or dedicated USB barcode hardware.
        </div>
      </div>

      {/* Counter Workstation Card */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-5 shadow-sm">
        {/* Quick Demo Pre-fill */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-bold text-navy-500">Quick Test Records:</span>
          <button
            type="button"
            onClick={() => {
              setLookupQuery("LS-2026-8841");
              setPinInput("482910");
              setReconciledBags(3);
              setSealInput("SEAL-LK-90211");
            }}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 font-mono text-navy-900 font-bold"
          >
            LS-2026-8841 (Amaya)
          </button>
          <button
            type="button"
            onClick={() => {
              setLookupQuery("LS-2026-8842");
              setPinInput("739204");
              setReconciledBags(2);
              setSealInput("SEAL-LK-90214");
            }}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 font-mono text-navy-900 font-bold"
          >
            LS-2026-8842 (Liam)
          </button>
          <button
            type="button"
            onClick={() => {
              setLookupQuery("LS-2026-8835");
              setPinInput("661928");
              setReconciledBags(2);
              setSealInput("SEAL-LK-88101");
            }}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 font-mono text-navy-900 font-bold"
          >
            LS-2026-8835 (Henrik - Overdue)
          </button>
        </div>

        {/* Verification Method Toggle */}
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => setVerificationMethod("QR_SCAN")}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition ${
              verificationMethod === "QR_SCAN"
                ? "bg-navy-900 text-white"
                : "bg-sand-100 text-navy-700 hover:bg-sand-200"
            }`}
          >
            Dynamic QR Scan Token (Primary)
          </button>
          <button
            type="button"
            onClick={() => setVerificationMethod("PIN_FALLBACK")}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition ${
              verificationMethod === "PIN_FALLBACK"
                ? "bg-amber-600 text-white"
                : "bg-sand-100 text-navy-700 hover:bg-sand-200"
            }`}
          >
            6-Digit Backup PIN (Rate-Limited Fallback)
          </button>
        </div>

        {/* Counter Form Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-bold text-navy-900 mb-1">
              Booking Reference or Lookup
            </label>
            <input
              type="text"
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono font-bold text-navy-900"
            />
          </div>

          <div>
            <label className="block font-bold text-navy-900 mb-1">
              {verificationMethod === "QR_SCAN"
                ? "QR Token Payload"
                : "6-Digit Backup PIN"}
            </label>
            <input
              type="text"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono font-bold text-navy-900"
            />
          </div>

          <div>
            <label className="block font-bold text-navy-900 mb-1">
              Reconciled Physical Bag Count
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={reconciledBags}
              onChange={(e) => setReconciledBags(Number(e.target.value))}
              className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono font-bold text-navy-900"
            />
          </div>
        </div>

        {/* Seal and Zone Assignment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-navy-900 mb-1">
              Tamper-Evident Security Seal Serial
            </label>
            <input
              type="text"
              value={sealInput}
              onChange={(e) => setSealInput(e.target.value)}
              className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono font-bold text-navy-900"
            />
            <p className="text-[10px] text-navy-500 mt-1">
              Inspect zip tag and apply physical seal before moving to vault.
            </p>
          </div>
          <div>
            <label className="block font-bold text-navy-900 mb-1">
              Assigned Vault Compartment
            </label>
            <select
              aria-label="Assigned Vault Compartment"
              defaultValue="RACK-A"
              className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-bold text-navy-900"
            >
              <option value="RACK-A">RACK-A: Main Steel Compartment A (Slot 12)</option>
              <option value="VAULT-B">VAULT-B: Back Climate-Controlled Bay (Slot 04)</option>
              <option value="SURF-C">SURF-C: Oversized Surf / Gear Bay</option>
            </select>
            <p className="text-[10px] text-navy-500 mt-1">Logged to staff member Roshan Fernando.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSimulateHandover}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-sm transition flex items-center gap-2 ${
              operationMode === "CHECK_IN"
                ? "bg-terracotta-500 hover:bg-terracotta-600 disabled:bg-sand-400"
                : "bg-emerald-600 hover:bg-emerald-700 disabled:bg-sand-400"
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Verifying Handover...</span>
              </>
            ) : operationMode === "CHECK_IN" ? (
              <>
                <Check className="h-4 w-4" />
                <span>Confirm Check-In Handover</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Verify &amp; Release Bags</span>
              </>
            )}
          </button>
        </div>

        {/* Feedback Message */}
        {handoverSuccessMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-950 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p>{handoverSuccessMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HD-010: Financial Revenue & Ledger (/host/finance)
// ============================================================================
export function HostFinancialRevenueLedgerPage() {
  const [downloadNotice, setDownloadNotice] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Financial Revenue &amp; Commission Ledger
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Itemized gross booking volume, illustrative 15% platform commission, and 85% net host earnings (DEC-006 Pending PO Sign-Off).
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDownloadNotice(true);
              setTimeout(() => setDownloadNotice(false), 3000);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-sand-300 hover:bg-sand-50 text-navy-900 text-xs font-bold shadow-xs transition"
          >
            <Download className="h-4 w-4 text-terracotta-600" />
            <span>Export CSV Ledger</span>
          </button>
        </div>
      </div>

      {/* Honest Prototype Notice */}
      <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
        <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-navy-950">Financial Ledger (Demo Figures):</strong> Financial volumes, deductions, and batch settlement dates are calculated from local mock bookings for Fort Hub demonstration. Export actions generate simulated client exports. Production ledger queries will connect to the payments service in Phase 3+.
        </div>
      </div>

      {downloadNotice && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600" />
          <span>Generating financial ledger export (CSV). Download starting shortly (Demo Action).</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Gross Booking Volume</span>
          <p className="text-2xl font-extrabold text-navy-950">{formatLkr(217058)}</p>
          <span className="text-[11px] text-navy-500">Total customer checkout value</span>
        </div>

        <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Platform Fee (15%)</span>
          <p className="text-2xl font-extrabold text-navy-600">-{formatLkr(32558)}</p>
          <span className="text-[11px] text-navy-500">Payment processing &amp; platform insurance</span>
        </div>

        <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Net Host Payout (85%)</span>
          <p className="text-2xl font-extrabold text-emerald-700">{formatLkr(184500)}</p>
          <span className="text-[11px] text-emerald-800 font-semibold">Illustrative Friday batch estimate (DEC-006)</span>
        </div>
      </div>

      {/* Itemized Transactions Table */}
      <div className="bg-white rounded-2xl border border-sand-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-sand-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy-950">Recent Completed &amp; Cleared Bookings</h2>
          <span className="text-xs text-navy-500">Settled to Commercial Bank of Ceylon PLC</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-sand-50 border-b border-sand-200 text-navy-500 uppercase font-bold text-[10px] tracking-wider">
                <th className="p-3.5">Booking Ref</th>
                <th className="p-3.5">Traveller</th>
                <th className="p-3.5">Gross (LKR)</th>
                <th className="p-3.5">Platform Fee (15%)</th>
                <th className="p-3.5">Host Net (85%)</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {DEMO_BOOKINGS.map((b) => (
                <tr key={b.id} className="hover:bg-sand-50/70 transition">
                  <td className="p-3.5 font-mono font-bold text-navy-900">{b.reference}</td>
                  <td className="p-3.5 font-semibold text-navy-950">{b.travellerName}</td>
                  <td className="p-3.5 text-navy-800">{formatLkr(b.totalAmountLkr)}</td>
                  <td className="p-3.5 text-navy-500">-{formatLkr(b.platformCommissionLkr)}</td>
                  <td className="p-3.5 font-bold text-emerald-700">{formatLkr(b.hostNetPayoutLkr)}</td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Cleared
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HD-011: Payout Accounts & History (/host/payouts)
// ============================================================================
export function HostPayoutAccountsHistoryPage() {
  const [showEditBankModal, setShowEditBankModal] = useState(false);

  const payoutBatches = [
    {
      id: "BATCH-2026-W44",
      date: "06 Nov 2026",
      amountLkr: 64850,
      method: "CEFT Transfer",
      ref: "CEFT-LK-90281",
      status: "Completed"
    },
    {
      id: "BATCH-2026-W43",
      date: "30 Oct 2026",
      amountLkr: 72400,
      method: "CEFT Transfer",
      ref: "CEFT-LK-89104",
      status: "Completed"
    },
    {
      id: "BATCH-2026-W42",
      date: "23 Oct 2026",
      amountLkr: 47250,
      method: "CEFT Transfer",
      ref: "CEFT-LK-87890",
      status: "Completed"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Payout Accounts &amp; Settlement History
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Manage Sri Lankan LKR settlement bank details (CEFT / SLIPS) and review weekly batch transfer statements (Illustrative Friday Schedule: DEC-006 Pending PO Sign-Off).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowEditBankModal(true)}
            className="px-4 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition"
          >
            Update Bank Details
          </button>
        </div>
      </div>

      {/* Honest Prototype Notice */}
      <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
        <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-navy-950">Payout Accounts (Demo Record):</strong> Bank beneficiary details and batch settlement records are illustrative fixtures for Ceylon Transit Hospitality demonstration. Bank verification and CEFT/SLIPS disbursement integration will connect in Phase 3+.
        </div>
      </div>

      {/* Primary Settlement Bank Card */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-navy-900 text-white flex items-center justify-center font-bold">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-navy-950">Commercial Bank of Ceylon PLC</h2>
              <p className="text-xs text-navy-600">Colombo Fort Corporate Branch (Code 001)</p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
            Sample Bank Record (Demo)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
          <div>
            <span className="text-navy-500">Account Beneficiary:</span>
            <p className="font-bold text-navy-900">Ceylon Transit Hospitality (Pvt) Ltd</p>
          </div>
          <div>
            <span className="text-navy-500">Masked Account Number:</span>
            <p className="font-mono font-bold text-navy-900">**** **** **** 8821</p>
          </div>
          <div>
            <span className="text-navy-500">Clearing Method:</span>
            <p className="font-bold text-navy-900">CEFT / SLIPS (Same-Day Clearing)</p>
          </div>
        </div>
      </div>

      {/* Batch Settlement History */}
      <div className="bg-white rounded-2xl border border-sand-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-sand-200">
          <h3 className="text-sm font-bold text-navy-950">Recent Weekly Batch Transfers</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-sand-50 border-b border-sand-200 text-navy-500 uppercase font-bold text-[10px] tracking-wider">
                <th className="p-3.5">Batch ID</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Amount (LKR)</th>
                <th className="p-3.5">Transfer Ref</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Advice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {payoutBatches.map((batch) => (
                <tr key={batch.id} className="hover:bg-sand-50/70 transition">
                  <td className="p-3.5 font-mono font-bold text-navy-900">{batch.id}</td>
                  <td className="p-3.5 text-navy-700">{batch.date}</td>
                  <td className="p-3.5 font-bold text-emerald-700">{formatLkr(batch.amountLkr)}</td>
                  <td className="p-3.5 font-mono text-navy-600">{batch.ref}</td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {batch.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      type="button"
                      className="text-terracotta-600 hover:text-terracotta-700 font-bold"
                    >
                      Download Sample PDF (Demo Action)
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Bank Modal */}
      {showEditBankModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-sand-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <h3 className="text-base font-bold text-navy-950">Update Settlement Bank Details</h3>
              <button
                type="button"
                onClick={() => setShowEditBankModal(false)}
                className="p-1 rounded-lg hover:bg-sand-100 text-navy-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-navy-600">
              For security compliance, bank account changes undergo 24-hour compliance verification before active disbursement.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-navy-900 mb-1">Bank Name</label>
                <input
                  type="text"
                  defaultValue="Commercial Bank of Ceylon PLC"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Account Number</label>
                <input
                  type="text"
                  placeholder="Enter 10-12 digit account number"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEditBankModal(false)}
                className="px-4 py-2 rounded-xl border border-sand-300 text-xs font-bold text-navy-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowEditBankModal(false)}
                className="px-4 py-2 rounded-xl bg-terracotta-500 text-white text-xs font-bold"
              >
                Save for Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HD-012: Review Management (/host/reviews)
// ============================================================================
export function HostReviewManagementPage() {
  const [replyText, setReplyText] = useState("");
  const [replyPublished, setReplyPublished] = useState(false);

  const reviews = [
    {
      id: "rev-1",
      author: "Amaya Perera",
      country: "Sri Lanka",
      date: "Yesterday",
      bookingRef: "LS-2026-8841",
      rating: 5,
      content:
        "Super fast QR check-in right outside Colombo Fort Station! Loved seeing the numbered security seal placed on our backpacks.",
      reply: "Thank you Amaya! We are delighted our Fort Station vault made your city excursion hassle-free."
    },
    {
      id: "rev-2",
      author: "Liam O'Connor",
      country: "Ireland",
      date: "07 Nov 2026",
      bookingRef: "LS-2026-8842",
      rating: 5,
      content:
        "Left two large suitcases before boarding the scenic train to Ella. Bags were in perfect condition with intact seals when we collected them.",
      reply: null
    },
    {
      id: "rev-3",
      author: "Sophie Laurent",
      country: "France",
      date: "04 Nov 2026",
      bookingRef: "LS-2026-8799",
      rating: 4,
      content:
        "Very convenient location. Only 2 minutes walk from the station exit. Prompt service.",
      reply: "Merci Sophie! Hope you enjoyed your holiday across the island."
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Customer Reviews &amp; Reputation
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Read verified post-checkout traveller ratings and publish official partner responses.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-sand-100 px-3.5 py-1.5 rounded-xl">
            <span className="text-amber-500 font-bold text-sm">★ 4.9</span>
            <span className="text-xs text-navy-700 font-semibold">214 Verified Reviews</span>
          </div>
        </div>
      </div>

      {/* Honest Prototype Notice */}
      <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
        <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-navy-950">Customer Reviews (Demo Data):</strong> Sample feedback ratings and reviews shown for Fort Hub demonstration. Replies are held in local state and will connect to the live review publication endpoint in Phase 3+.
        </div>
      </div>

      {replyPublished && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>Local Prototype: Official host response previewed in workstation session (not published to public travellers).</span>
        </div>
      )}

      {/* Reviews Feed */}
      <div className="space-y-4">
        {reviews.map((r) => (
          <div
            key={r.id}
            className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-navy-900 text-white flex items-center justify-center font-bold text-xs">
                  {r.author.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-bold text-navy-950">{r.author} ({r.country})</p>
                  <p className="text-[10px] text-navy-500 font-mono">Booking #{r.bookingRef} • {r.date}</p>
                </div>
              </div>
              <div className="text-amber-500 text-xs font-bold">
                {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} ({r.rating}.0)
              </div>
            </div>

            <p className="text-xs text-navy-800 leading-relaxed">{r.content}</p>

            {r.reply ? (
              <div className="p-3.5 rounded-xl bg-sand-50 border-l-4 border-terracotta-500 text-xs space-y-1">
                <span className="font-bold text-navy-900 text-[11px]">Official Host Response:</span>
                <p className="text-navy-700 text-xs">{r.reply}</p>
              </div>
            ) : (
              <div className="pt-2 border-t border-sand-100 space-y-2">
                <label className="block text-[11px] font-bold text-navy-700">
                  Reply to {r.author}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type official reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-1 rounded-xl border border-sand-300 px-3 py-1.5 text-xs text-navy-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (replyText.trim()) {
                        setReplyPublished(true);
                        setReplyText("");
                        setTimeout(() => setReplyPublished(false), 3000);
                      }
                    }}
                    className="px-4 py-1.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition"
                  >
                    Reply
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// HD-013: Staff Management & RBAC (/host/staff)
// ============================================================================
export function HostStaffManagementRbacPage() {
  const [showInviteModal, setShowInviteModal] = useState(false);

  const staffMembers = [
    {
      id: "usr-204",
      name: "Roshan Fernando",
      email: "roshan.f@ceylontransit.lk",
      role: "HOST_STAFF",
      assignedVenue: "Colombo Fort Station Heritage Vault",
      status: "Active"
    },
    {
      id: "usr-205",
      name: "Nuwan Bandara",
      email: "nuwan.b@ceylontransit.lk",
      role: "HOST_STAFF",
      assignedVenue: "Ella Railway & Nine Arch Trail Hub",
      status: "Active"
    },
    {
      id: "usr-201",
      name: "Priyantha Wickramasinghe",
      email: "priyantha@ceylontransit.lk",
      role: "HOST_OWNER",
      assignedVenue: "All Storage Locations",
      status: "Active"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Staff Management &amp; Operational Access
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Assign counter staff to specific storage locations with scoped permissions for check-in/out and custody logs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition"
          >
            <Plus className="h-4 w-4" />
            <span>Invite Staff Member</span>
          </button>
        </div>
      </div>

      {/* Honest Prototype Notice */}
      <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
        <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-navy-950">Team Management (Demo State):</strong> Staff directory is populated with demo counter supervisors for Fort Hub. Modal invitations simulate the staff onboarding journey and will connect to RBAC identity provisioning in Phase 3+.
        </div>
      </div>

      {/* Role Scopes Guide */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-sand-200 p-5 space-y-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-navy-900 text-white text-[11px] font-bold">
              Host Owner Scope
            </span>
          </div>
          <p className="text-xs text-navy-700 leading-relaxed">
            Full management authority: pricing rules, storage capacity pools, bank payout accounts, financial ledger, and team member invitations.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-sand-200 p-5 space-y-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-sand-200 text-navy-900 text-[11px] font-bold">
              Host Staff Scope
            </span>
          </div>
          <p className="text-xs text-navy-700 leading-relaxed">
            Scoped counter authority: physical check-in/out desk, bag count reconciliation, seal application, and guest review responses.
          </p>
        </div>
      </div>

      {/* Staff Directory Table */}
      <div className="bg-white rounded-2xl border border-sand-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-sand-200">
          <h2 className="text-sm font-bold text-navy-950">Active Team Directory</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-sand-50 border-b border-sand-200 text-navy-500 uppercase font-bold text-[10px] tracking-wider">
                <th className="p-3.5">Staff Member</th>
                <th className="p-3.5">Assigned Storage Venue</th>
                <th className="p-3.5">Role Scope</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {staffMembers.map((member) => (
                <tr key={member.id} className="hover:bg-sand-50/70 transition">
                  <td className="p-3.5">
                    <p className="font-bold text-navy-950">{member.name}</p>
                    <p className="text-[11px] text-navy-500">{member.email}</p>
                  </td>
                  <td className="p-3.5 text-navy-800 font-medium">{member.assignedVenue}</td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        member.role === "HOST_OWNER"
                          ? "bg-navy-900 text-white"
                          : "bg-amber-100 text-navy-950"
                      }`}
                    >
                      {member.role === "HOST_OWNER" ? "Host Owner" : "Host Staff"}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {member.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      type="button"
                      className="text-navy-600 hover:text-navy-900 font-bold"
                    >
                      Edit Scope
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Staff Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-sand-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <h3 className="text-base font-bold text-navy-950">Invite Team Member</h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg hover:bg-sand-100 text-navy-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-navy-900 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dinesh Jayawardena"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="dinesh@ceylontransit.lk"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Role Permission</label>
                <select aria-label="Role Permission" className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs">
                  <option value="HOST_STAFF">Host Staff (Counter Operations Desk)</option>
                  <option value="HOST_OWNER">Host Owner (Full Business &amp; Financial Scope)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 rounded-xl border border-sand-300 text-xs font-bold text-navy-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 rounded-xl bg-terracotta-500 text-white text-xs font-bold"
              >
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HD-014: Business Profile & Legal (/host/settings)
// ============================================================================
export function HostBusinessProfileLegalPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Business Profile &amp; Legal Compliance
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Corporate registration certificate (BRN), Sri Lanka TIN/VAT status, and verified insurance compliance.
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-sand-100 text-navy-800 border border-sand-300 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-terracotta-600" />
            <span>KYC Profile Preview (Demo Simulation)</span>
          </span>
        </div>
      </div>

      {/* Honest Prototype Notice */}
      <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
        <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-navy-950">Business Profile &amp; KYC (Demo Simulation):</strong> Corporate entities, tax identifiers (BRN/TIN), and insurance certificates displayed here are sample fixtures for Fort Hub onboarding demonstration. Production verification and document uploads will connect to Superadmin compliance workflows in Phase 3+.
        </div>
      </div>

      {/* Corporate Registration Dossier */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-navy-950">Corporate Registration Certificate</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-navy-500">Registered Legal Entity:</span>
            <p className="font-bold text-navy-950">Ceylon Transit Hospitality (Pvt) Ltd</p>
          </div>
          <div>
            <span className="text-navy-500">Registrar of Companies BRN:</span>
            <p className="font-mono font-bold text-navy-950">PV-00294812</p>
          </div>
          <div>
            <span className="text-navy-500">Inland Revenue Department TIN:</span>
            <p className="font-mono font-bold text-navy-950">TIN-10928472-0001</p>
          </div>
          <div>
            <span className="text-navy-500">VAT Status:</span>
            <p className="font-bold text-emerald-700">Registered (VAT-10928472-7000)</p>
          </div>
          <div className="sm:col-span-2">
            <span className="text-navy-500">Registered Office Address:</span>
            <p className="font-medium text-navy-900">
              Level 4, East Tower, World Trade Center, Colombo 01, Sri Lanka
            </p>
          </div>
        </div>
      </div>

      {/* Verified KYC Documents */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-navy-950">Verified Compliance Documentation</h2>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl bg-sand-50 border border-sand-200">
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-terracotta-600" />
              <div>
                <p className="font-bold text-navy-900">Certificate of Incorporation (Form 1 / Form 20)</p>
                <p className="text-[10px] text-navy-500">Verified by Superadmin Compliance</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-navy-700 bg-sand-100 px-2 py-0.5 rounded border border-sand-300">
              Sample Verification Status
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-sand-50 border border-sand-200">
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-terracotta-600" />
              <div>
                <p className="font-bold text-navy-900">Commercial Premises Lease &amp; Insurance Cover</p>
                <p className="text-[10px] text-navy-500">LKR 10,000,000 Public Liability Insurance Policy</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-navy-700 bg-sand-100 px-2 py-0.5 rounded border border-sand-300">
              Sample Verification Status
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-sand-100/80 text-[11px] text-navy-700">
          <strong className="text-navy-900">Compliance Notice:</strong> Corporate registration and bank details are read-only once verified. To request changes, contact Superadmin Compliance Support at <span className="font-semibold text-terracotta-700">compliance@ceylonstorage.lk</span>.
        </div>
      </div>
    </div>
  );
}
