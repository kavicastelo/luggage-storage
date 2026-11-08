import React, { useState } from "react";
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
  Lock
} from "lucide-react";
import { MascotIllustration } from "@/components/ui/MascotIllustration";
import { ScreenHeaderBadge, DeferredBackendNotice } from "@/components/ui/DeferredBackendNotice";
import { useAuthStore } from "@/store/useAuthStore";
import { PermissionGate } from "@/components/auth/PermissionGate";
import {
  DEMO_LOCATIONS,
  DEMO_BOOKINGS,
  DemoBookingRecord,
  formatLkr,
  WEB_HOST_SCREENS
} from "@/data/mock-marketplace";

// ============================================================================
// Host Dashboard Shell (Enforces HOST_OWNER vs HOST_STAFF RBAC Boundaries)
// ============================================================================
export function HostDashboardLayout() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const [hostRoleMode, setHostRoleMode] = useState<"HOST_OWNER" | "HOST_STAFF">("HOST_OWNER");

  const searchParams = new URLSearchParams(location.search);
  const querySuffix = searchParams.get("preview") === "demo" ? "?preview=demo" : "";

  const canActAsHostOwner =
    !isAuthenticated ||
    Boolean(user?.roles?.includes("HOST_OWNER") || user?.roles?.includes("SUPERADMIN"));

  const effectiveHostRole: "HOST_OWNER" | "HOST_STAFF" = isAuthenticated
    ? canActAsHostOwner
      ? hostRoleMode
      : "HOST_STAFF"
    : hostRoleMode;

  const navItems = [
    { id: "HD-001", label: "Overview", to: "/host/dashboard", icon: LayoutDashboard, ownerOnly: false },
    { id: "HD-002", label: "Locations", to: "/host/locations", icon: MapPin, ownerOnly: false },
    { id: "HD-003", label: "Location Editor", to: "/host/locations/loc-cmb-fort-01", icon: Building2, ownerOnly: true },
    { id: "HD-004", label: "Schedule & Hours", to: "/host/locations/loc-cmb-fort-01/schedule", icon: Calendar, ownerOnly: true },
    { id: "HD-005", label: "Capacity & Zones", to: "/host/locations/loc-cmb-fort-01/capacity", icon: Layers, ownerOnly: true },
    { id: "HD-006", label: "Pricing Rules", to: "/host/locations/loc-cmb-fort-01/pricing", icon: Tag, ownerOnly: true },
    { id: "HD-007", label: "Bookings Hub", to: "/host/bookings", icon: Briefcase, ownerOnly: false },
    { id: "HD-009", label: "Check-In / Out Desk", to: "/host/operations", icon: QrCode, ownerOnly: false },
    { id: "HD-010", label: "Revenue & Ledger", to: "/host/finance", icon: Wallet, ownerOnly: true },
    { id: "HD-011", label: "Payout Accounts", to: "/host/payouts", icon: Building2, ownerOnly: true },
    { id: "HD-012", label: "Customer Reviews", to: "/host/reviews", icon: Star, ownerOnly: false },
    { id: "HD-013", label: "Staff & RBAC", to: "/host/staff", icon: Users, ownerOnly: true },
    { id: "HD-014", label: "Business Settings", to: "/host/settings", icon: Settings, ownerOnly: true }
  ];

  const activeNavItem = navItems.find((item) => location.pathname === item.to);
  const isBlockedByStaffRole = effectiveHostRole === "HOST_STAFF" && activeNavItem?.ownerOnly;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Sidebar */}
      <aside className="lg:col-span-3 space-y-4">
        <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold">
              Host Partner Hub (14 Screens)
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-white/10 font-mono">
              {effectiveHostRole}
            </span>
          </div>
          <p className="text-xs text-slate-300">
            {isAuthenticated && user
              ? `${user.displayName} (${user.email})`
              : "Ceylon Transit Hospitality (Pvt) Ltd • Demo Preview"}
          </p>
          {canActAsHostOwner ? (
            <div className="grid grid-cols-2 gap-1.5 bg-slate-800 p-1 rounded-xl text-xs">
              <button
                onClick={() => setHostRoleMode("HOST_OWNER")}
                className={`py-1.5 rounded-lg font-bold transition ${
                  effectiveHostRole === "HOST_OWNER" ? "bg-blue-600 text-white" : "text-slate-300"
                }`}
              >
                Host Owner
              </button>
              <button
                onClick={() => setHostRoleMode("HOST_STAFF")}
                className={`py-1.5 rounded-lg font-bold transition ${
                  effectiveHostRole === "HOST_STAFF" ? "bg-amber-500 text-slate-950" : "text-slate-300"
                }`}
              >
                Host Staff
              </button>
            </div>
          ) : (
            <div className="bg-slate-800 px-3 py-2 rounded-xl text-xs text-amber-300 font-mono">
              Authenticated Role: HOST_STAFF (Counter Scope Only)
            </div>
          )}
        </div>

        <nav className="bg-white rounded-2xl border border-slate-200 p-2.5 space-y-1 shadow-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            const restricted = effectiveHostRole === "HOST_STAFF" && item.ownerOnly;
            return (
              <Link
                key={item.id}
                to={`${item.to}${querySuffix}`}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : restricted
                    ? "text-slate-400 hover:bg-slate-50"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="flex items-center gap-1">
                  {restricted && <Lock className="h-3 w-3 text-amber-500" />}
                  <span
                    className={`font-mono text-[10px] ${
                      isActive ? "text-blue-100" : "text-slate-400"
                    }`}
                  >
                    {item.id}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="lg:col-span-9">
        {isBlockedByStaffRole ? (
          <div className="bg-white rounded-2xl border border-red-200 p-8 text-center space-y-4">
            <MascotIllustration
              mascot="key"
              size="lg"
              badgeText="RBAC Guard Active: HOST_OWNER Required"
              caption={`Screen ${activeNavItem?.id} (${activeNavItem?.label}) contains sensitive financial, pricing, or staff controls restricted to HOST_OWNER accounts (OQ-017).`}
            />
            <div className="flex justify-center gap-3">
              {canActAsHostOwner && (
                <PermissionGate requiredRoles={["HOST_OWNER", "SUPERADMIN"]} fallback={
                  !isAuthenticated ? (
                    <button
                      onClick={() => setHostRoleMode("HOST_OWNER")}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                    >
                      Switch Role Preview to HOST_OWNER
                    </button>
                  ) : null
                }>
                  <button
                    onClick={() => setHostRoleMode("HOST_OWNER")}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                  >
                    Return to HOST_OWNER View
                  </button>
                </PermissionGate>
              )}
              <Link
                to={`/host/operations${querySuffix}`}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
              >
                Go to Staff Check-In Desk (HD-009)
              </Link>
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HD-001: Host Overview Dashboard (/host/dashboard)
// ============================================================================
export function HostOverviewDashboardPage() {
  return (
    <div className="space-y-6" data-screen-id="HD-001">
      <ScreenHeaderBadge
        screenId="HD-001"
        title="Host Operations & Revenue Overview"
        subtitle="Real-time SLA queue, active custody occupancy, and 85% net host earnings summary."
        workflows={["WF-021", "WF-024", "WF-033"]}
        roleScope="Host Owner / Staff"
        backendStatus="HYBRID_PREVIEW"
        rightSlot={<MascotIllustration mascot="salute" size="sm" caption="Operations Ready" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-400 font-bold uppercase">15m SLA Queue</span>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">1 Request</p>
          <span className="text-[11px] text-slate-500">11 mins remaining before auto-expiry</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-400 font-bold uppercase">Bags in Custody</span>
          <p className="text-2xl font-extrabold text-blue-600 mt-1">28 Bags</p>
          <span className="text-[11px] text-emerald-700 font-semibold">Bag Counts Reconciled & Sealed (OQ-014)</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-400 font-bold uppercase">Net Host Balance (85%)</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{formatLkr(184500)}</p>
          <span className="text-[11px] text-slate-500">Next batch payout: Friday</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-400 font-bold uppercase">Overdue Alerts</span>
          <p className="text-2xl font-extrabold text-red-600 mt-1">1 Bag</p>
          <span className="text-[11px] text-red-600">BR-035 Mandatory Release Active</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">All 14 Host Dashboard Screens</h2>
          <Link to="/host/bookings" className="text-xs font-bold text-blue-600">
            Open Bookings Hub (HD-007) →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {WEB_HOST_SCREENS.map((scr) => (
            <Link
              key={scr.id}
              to={scr.route.replace(":id", "loc-cmb-fort-01").replace("?inspect=:bookingId", "?inspect=bkg-1001")}
              className="p-3 rounded-xl border border-slate-200 hover:border-blue-500 transition flex items-center justify-between text-xs"
            >
              <div>
                <span className="font-mono font-bold text-blue-700">{scr.id}</span>
                <p className="font-semibold text-slate-900">{scr.name}</p>
              </div>
              <span className="text-[10px] text-slate-400">{scr.actorScope}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HD-002: Location Management (/host/locations)
// ============================================================================
export function HostLocationManagementPage() {
  return (
    <div className="space-y-6" data-screen-id="HD-002">
      <ScreenHeaderBadge
        screenId="HD-002"
        title="Host Storage Location Directory"
        subtitle="Manage multi-hub capacity, operating schedules, and LKR pricing across your verified venues."
        workflows={["WF-010"]}
        roleScope="Host Owner"
        rightSlot={<MascotIllustration mascot="map" size="sm" caption="5 Active Locations" />}
      />

      <div className="space-y-4">
        {DEMO_LOCATIONS.map((loc) => (
          <div
            key={loc.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-bold">
                  ACTIVE
                </span>
                <span className="text-xs font-bold text-slate-500">{loc.city}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-1">{loc.name}</h3>
              <p className="text-xs text-slate-500">{loc.addressExact}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/host/locations/${loc.id}`}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
              >
                Profile (HD-003)
              </Link>
              <Link
                to={`/host/locations/${loc.id}/schedule`}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
              >
                Schedule (HD-004)
              </Link>
              <Link
                to={`/host/locations/${loc.id}/capacity`}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
              >
                Capacity (HD-005)
              </Link>
              <Link
                to={`/host/locations/${loc.id}/pricing`}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold"
              >
                Pricing (HD-006)
              </Link>
            </div>
          </div>
        ))}
      </div>
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
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-6" data-screen-id="HD-003">
      <ScreenHeaderBadge
        screenId="HD-003"
        title={`Location Profile Editor — ${loc.city}`}
        subtitle="Configure public-facing masked address, post-booking exact street coordinates, and security amenities."
        workflows={["WF-010"]}
        roleScope="Host Owner"
        rightSlot={<MascotIllustration mascot="pointing" size="sm" caption="Address Privacy Enabled" />}
      />
      <DeferredBackendNotice featureName="Location Metadata Update" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(true);
        }}
        className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Venue Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Transit Landmark</label>
            <input
              type="text"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          {saved && (
            <span className="text-xs font-bold text-emerald-700">
              Preview changes saved locally for {name}.
            </span>
          )}
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold"
          >
            Save Location Profile
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// HD-004: Schedule & Calendar Editor (/host/locations/:id/schedule)
// ============================================================================
export function HostScheduleCalendarEditorPage() {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return (
    <div className="space-y-6" data-screen-id="HD-004">
      <ScreenHeaderBadge
        screenId="HD-004"
        title="Operating Hours & Poya / Holiday Exception Calendar"
        subtitle="Prevent bookings outside active staff shifts or during Sri Lankan Poya & Mercantile holidays."
        workflows={["WF-011", "WF-012"]}
        roleScope="Host Owner"
        rightSlot={<MascotIllustration mascot="sleeping" size="sm" caption="Closed Hours Protected" />}
      />
      <DeferredBackendNotice featureName="Weekly Schedule & Exception Rules Engine" />

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
        {days.map((day) => (
          <div
            key={day}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
          >
            <span className="font-bold text-slate-900 w-28">{day}</span>
            <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
              Open: 06:00 IST – 23:00 IST
            </span>
            <span className="text-slate-500">Drop-off & Pick-up Allowed</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// HD-005: Capacity Pools & Zones (/host/locations/:id/capacity)
// ============================================================================
export function HostCapacityPoolsZonesPage() {
  const loc = DEMO_LOCATIONS[0];
  return (
    <div className="space-y-6" data-screen-id="HD-005">
      <ScreenHeaderBadge
        screenId="HD-005"
        title="Atomic Capacity Pools & Physical Storage Zones"
        subtitle="Configure rack limits, weighted bag slot equivalents, and physical tag bays."
        workflows={["WF-014", "WF-015"]}
        roleScope="Host Owner"
        rightSlot={<MascotIllustration mascot="suitcase-hug" size="sm" caption="Zero Overbooking" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loc.zones.map((z) => (
          <div key={z.id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
              {z.code}
            </span>
            <h3 className="font-bold text-slate-900 text-sm">{z.name}</h3>
            <p className="text-xs text-slate-500">
              Occupied: {z.occupied} / {z.capacity} slots
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// HD-006: Pricing Rules & Multipliers (/host/locations/:id/pricing)
// ============================================================================
export function HostPricingRulesMultipliersPage() {
  const loc = DEMO_LOCATIONS[0];
  const [gracePeriodMins, setGracePeriodMins] = useState<number>(loc.gracePeriodMinutes);
  const [lateFeeRule, setLateFeeRule] = useState<string>("STANDARD_HOURLY_OR_DAILY_TIER");

  return (
    <div className="space-y-6" data-screen-id="HD-006">
      <ScreenHeaderBadge
        screenId="HD-006"
        title="Pricing Rules, Daily Caps & Configurable Late Fee Policies"
        subtitle="Configure LKR rates per bag tier and location-specific configurable grace periods and late collection fee policies (OQ-015)."
        workflows={["WF-016"]}
        roleScope="Host Owner"
        rightSlot={<MascotIllustration mascot="blank-tag" size="sm" caption="LKR Pricing Rules" />}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(["SMALL", "MEDIUM", "LARGE", "OVERSIZED"] as const).map((tier) => (
          <div key={tier} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="font-bold text-xs text-slate-900">{tier}</span>
            <p className="text-xs text-slate-600">
              Hourly: <strong>{formatLkr(loc.hourlyRateLkr[tier])}</strong>
            </p>
            <p className="text-xs text-slate-600">
              Daily Cap: <strong>{formatLkr(loc.dailyCapLkr[tier])}</strong>
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          Configurable Late Collection Grace Period & Fee Policy (OQ-015)
        </h2>
        <p className="text-xs text-slate-600">
          Grace periods and late collection fees are configurable per location (no hardcoded
          platform-wide default) and disclosed to travellers before checkout.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Configurable Grace Period (Minutes)
            </label>
            <select
              aria-label="Configurable Grace Period"
              value={gracePeriodMins}
              onChange={(e) => setGracePeriodMins(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value={15}>15 Minutes (Illustrative Option)</option>
              <option value={30}>30 Minutes (Illustrative Option)</option>
              <option value={45}>45 Minutes (Illustrative Option)</option>
              <option value={60}>60 Minutes (Illustrative Option)</option>
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Configurable Late Collection Fee Policy
            </label>
            <select
              aria-label="Configurable Late Collection Fee Policy"
              value={lateFeeRule}
              onChange={(e) => setLateFeeRule(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="STANDARD_HOURLY_OR_DAILY_TIER">
                Standard Hourly / Daily Cap Extension
              </option>
              <option value="ILLUSTRATIVE_1_5X_DAILY">
                Illustrative 1.5x Daily Rate Tier (Disclosed Pre-Checkout)
              </option>
              <option value="FLAT_LATE_HANDLING_FEE">
                Configurable Flat Late Handling Fee (LKR)
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HD-007 & HD-008: Booking Management Hub & Investigation Modal
// ============================================================================
export function HostBookingManagementHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const inspectId = searchParams.get("inspect");
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

  return (
    <div className="space-y-6" data-screen-id="HD-007">
      <ScreenHeaderBadge
        screenId="HD-007"
        title="Host Booking Management Hub (with HD-008 Investigation Modal)"
        subtitle="Review 15-minute SLA approval requests, active check-ins, overdue bags, and full custody audit trails."
        workflows={["WF-021", "WF-024", "WF-025", "WF-026"]}
        roleScope="Host Owner / Staff"
        rightSlot={
          <button
            onClick={() => openInvestigationModal(DEMO_BOOKINGS[0])}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
          >
            Inspect Custody Evidence (HD-008)
          </button>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold">
              <th className="p-3.5">Reference</th>
              <th className="p-3.5">Traveller</th>
              <th className="p-3.5">Bags & Zone</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Host Net (85%)</th>
              <th className="p-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {DEMO_BOOKINGS.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50/80">
                <td className="p-3.5 font-mono font-bold text-blue-700">{b.reference}</td>
                <td className="p-3.5 font-semibold text-slate-900">{b.travellerName}</td>
                <td className="p-3.5 text-slate-600">
                  {b.totalBags} Bags • <span className="font-mono">{b.zoneCode}</span>
                </td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-800">
                    {b.status}
                  </span>
                </td>
                <td className="p-3.5 font-bold text-emerald-700">
                  {formatLkr(b.hostNetPayoutLkr)}
                </td>
                <td className="p-3.5 text-right">
                  <button
                    onClick={() => openInvestigationModal(b)}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold"
                  >
                    Investigate (HD-008)
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* HD-008: Booking Investigation Modal */}
      {inspectedBooking && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          data-screen-id="HD-008"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded bg-slate-900 text-white font-mono text-xs font-bold">
                  HD-008
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Booking Custody Investigation — {inspectedBooking.reference}
                </h3>
              </div>
              <button
                onClick={closeInvestigationModal}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <p className="font-bold text-slate-900">Server-Side Custody Verification (OQ-014)</p>
                <p>Traveller: {inspectedBooking.travellerName} ({inspectedBooking.travellerPhone})</p>
                <p>
                  Verification: QR Scan Primary • Rate-Limited PIN Fallback (
                  <strong className="font-mono">{inspectedBooking.pinCode}</strong>)
                </p>
                <p>
                  Reconciled Bag Count: <strong>{inspectedBooking.totalBags} Bags</strong> • Zone:{" "}
                  {inspectedBooking.zoneCode}
                </p>
                <p>Responsible Staff ID: <code className="font-mono">staff-usr-204</code></p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                <p className="font-bold text-slate-900">Seals & Configurable Photo Evidence</p>
                <p>
                  Seals:{" "}
                  {inspectedBooking.sealIds.length > 0
                    ? inspectedBooking.sealIds.join(", ")
                    : "Pending Check-In"}
                </p>
                <p>
                  Photo Evidence (Configurable per Location): {inspectedBooking.evidencePhotosCount}{" "}
                  Captured
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <MascotIllustration
                mascot="selfie"
                size="xs"
                caption="Timestamped Check-In & Seal Evidence Verified"
              />
              <button
                onClick={closeInvestigationModal}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Close Investigation (HD-008)
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
  const [verificationMode, setVerificationMode] = useState<"QR_SCAN" | "PIN_FALLBACK">("QR_SCAN");
  const [pinInput, setPinInput] = useState("482910");
  const [sealInput, setSealInput] = useState("SEAL-LK-90211");
  const [reconciledBags, setReconciledBags] = useState(3);
  const [verifiedMessage, setVerifiedMessage] = useState<string | null>(null);

  return (
    <div className="space-y-6" data-screen-id="HD-009">
      <ScreenHeaderBadge
        screenId="HD-009"
        title="Web Check-In & Check-Out Custody Desk"
        subtitle="Server-side QR verification (with rate-limited, audited PIN fallback when QR is unavailable), bag-count reconciliation, and decoupled custody release (OQ-014 / OQ-015)."
        workflows={["WF-024", "WF-025"]}
        roleScope="Host Owner / Staff"
        rightSlot={<MascotIllustration mascot="phone" size="sm" caption="QR Scan or PIN Fallback" />}
      />
      <DeferredBackendNotice featureName="Custody Handover State Transition" />

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setVerificationMode("QR_SCAN")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${
              verificationMode === "QR_SCAN"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Primary: Dynamic QR Scan
          </button>
          <button
            type="button"
            onClick={() => setVerificationMode("PIN_FALLBACK")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${
              verificationMode === "PIN_FALLBACK"
                ? "bg-amber-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Fallback: Audited 6-Digit PIN (When QR Unavailable)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {verificationMode === "QR_SCAN"
                ? "Scanned QR Token Payload"
                : "6-Digit Backup PIN (Rate-Limited & Audited)"}
            </label>
            <input
              type="text"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Reconciled Physical Bag Count (Mandatory)
            </label>
            <input
              type="number"
              min={1}
              value={reconciledBags}
              onChange={(e) => setReconciledBags(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tamper-Evident Security Seal Serial
            </label>
            <input
              type="text"
              value={sealInput}
              onChange={(e) => setSealInput(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              setVerifiedMessage(
                `Check-In Preview (${verificationMode}): Reconciled ${reconciledBags} bags, Staff ID logged, Seal ${sealInput}.`
              )
            }
            className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold"
          >
            Simulate Check-In Handover
          </button>
          <button
            type="button"
            onClick={() =>
              setVerifiedMessage(
                `Check-Out Release Preview (${verificationMode}): Reconciled ${reconciledBags} bags returned, Staff ID logged, Seal ${sealInput} verified.`
              )
            }
            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
          >
            Simulate Check-Out Release
          </button>
        </div>

        {verifiedMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900">
            {verifiedMessage}
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
  return (
    <div className="space-y-6" data-screen-id="HD-010">
      <ScreenHeaderBadge
        screenId="HD-010"
        title="Host Financial Revenue & Commission Ledger"
        subtitle="Itemized gross booking volume, 15% platform commission, and 85% net host earnings."
        workflows={["WF-033"]}
        roleScope="Host Owner Only"
        rightSlot={<MascotIllustration mascot="king-coconut" size="sm" caption="85% Net Earnings" />}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 text-xs">
        {DEMO_BOOKINGS.map((b) => (
          <div
            key={b.id}
            className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
          >
            <div>
              <span className="font-mono font-bold text-blue-700">{b.reference}</span>
              <span className="ml-2 text-slate-600">{b.travellerName}</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Gross: {formatLkr(b.totalAmountLkr)}</span>
              <span className="text-slate-500">Fee (15%): -{formatLkr(b.platformCommissionLkr)}</span>
              <span className="font-bold text-emerald-700">
                Net (85%): {formatLkr(b.hostNetPayoutLkr)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// HD-011: Payout Accounts & History (/host/payouts)
// ============================================================================
export function HostPayoutAccountsHistoryPage() {
  return (
    <div className="space-y-6" data-screen-id="HD-011">
      <ScreenHeaderBadge
        screenId="HD-011"
        title="Host Payout Bank Accounts & Settlement Receipts"
        subtitle="Manage Sri Lankan LKR settlement bank details (CEFT / SLIPS) and download batch payout advices."
        workflows={["WF-034", "WF-035"]}
        roleScope="Host Owner Only"
        rightSlot={<MascotIllustration mascot="key" size="sm" caption="Verified Bank Account" />}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 text-sm">
        <h3 className="font-bold text-slate-900">Primary LKR Settlement Account</h3>
        <p className="text-xs text-slate-600">
          Commercial Bank of Ceylon PLC • Colombo Fort Branch • Account Ending{" "}
          <code className="font-mono font-bold">**** 8821</code>
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// HD-012: Review Management (/host/reviews)
// ============================================================================
export function HostReviewManagementPage() {
  return (
    <div className="space-y-6" data-screen-id="HD-012">
      <ScreenHeaderBadge
        screenId="HD-012"
        title="Host Customer Reviews & Public Responses"
        subtitle="Read verified post-checkout traveller ratings and post official partner responses."
        workflows={["WF-037"]}
        roleScope="Host Owner / Staff"
        rightSlot={<MascotIllustration mascot="high-five" size="sm" caption="4.9 ★ Average" />}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
          <div className="flex justify-between font-bold text-slate-900">
            <span>Amaya Perera • Booking #LS-2026-8841</span>
            <span className="text-amber-600">★★★★★ 5.0</span>
          </div>
          <p className="text-slate-600">
            Super fast QR check-in right outside Colombo Fort Station! Loved seeing the numbered
            security seal placed on our backpacks.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HD-013: Staff Management & RBAC (/host/staff)
// ============================================================================
export function HostStaffManagementRbacPage() {
  return (
    <div className="space-y-6" data-screen-id="HD-013">
      <ScreenHeaderBadge
        screenId="HD-013"
        title="Host Staff Management & Operational RBAC"
        subtitle="Assign counter staff to specific storage locations with scoped HOST_STAFF check-in/out permissions."
        workflows={["WF-006"]}
        roleScope="Host Owner Only"
        backendStatus="HYBRID_PREVIEW"
        rightSlot={<MascotIllustration mascot="key" size="sm" caption="Scoped Staff Access" />}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 text-xs">
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <p className="font-bold text-slate-900">Roshan Fernando (Counter Supervisor)</p>
            <p className="text-slate-500">roshan.f@ceylontransit.lk • Colombo Fort Vault</p>
          </div>
          <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 font-mono font-bold">
            HOST_STAFF
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HD-014: Business Profile & Legal (/host/settings)
// ============================================================================
export function HostBusinessProfileLegalPage() {
  return (
    <div className="space-y-6" data-screen-id="HD-014">
      <ScreenHeaderBadge
        screenId="HD-014"
        title="Host Business Registration, KYC & Tax Profile"
        subtitle="Corporate registration certificate (BRN), Sri Lanka TIN/VAT status, and insurance compliance."
        workflows={["WF-004"]}
        roleScope="Host Owner Only"
        rightSlot={<MascotIllustration mascot="salute" size="sm" caption="KYC Approved" />}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-2 text-xs text-slate-700">
        <p>
          <strong>Legal Entity:</strong> Ceylon Transit Hospitality (Pvt) Ltd
        </p>
        <p>
          <strong>Registrar of Companies BRN:</strong> PV-00294812
        </p>
        <p>
          <strong>Verification Status:</strong>{" "}
          <span className="text-emerald-700 font-bold">APPROVED BY SUPERADMIN</span>
        </p>
      </div>
    </div>
  );
}
