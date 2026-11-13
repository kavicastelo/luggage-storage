import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import {
  Shield,
  Users,
  Building2,
  MapPin,
  Briefcase,
  CreditCard,
  RotateCcw,
  Layers,
  Send,
  BookOpen,
  LifeBuoy,
  MessageSquare,
  AlertOctagon,
  Star,
  Sparkles,
  Settings,
  FileSearch,
  KeyRound,
  Lock
} from "lucide-react";
import {
  SecurityAuditEvent,
  HostVerificationQueueItem,
  LocationModerationQueueItem,
  BookingDetail,
  CustodyRecordDetail,
  PaymentTransactionRecord,
  RefundRecord,
  AdminTransitionRefundRequest,
  AdminLedgerResponse,
  RefundStatus
} from "@luggage-storage/contracts";
import { MascotIllustration } from "@/components/ui/MascotIllustration";
import { ScreenHeaderBadge, DeferredBackendNotice } from "@/components/ui/DeferredBackendNotice";
import { useAuthStore } from "@/store/useAuthStore";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { authApi } from "@/services/auth-api";
import { marketplaceApi } from "@/services/marketplace-api";
import { isDemoPreviewActive } from "@/config/demo-preview";
import {
  DEMO_LOCATIONS,
  DEMO_BOOKINGS,
  REFUND_SEVEN_STAGES,
  formatLkr,
  WEB_ADMIN_SCREENS
} from "@/data/mock-marketplace";

// ============================================================================
// Superadmin Dashboard Layout (Enforces SUPERADMIN vs SUPPORT RBAC Boundaries)
// ============================================================================
export function AdminDashboardLayout() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const [adminRoleMode, setAdminRoleMode] = useState<"SUPERADMIN" | "SUPPORT">("SUPERADMIN");

  const isDemoActive = isDemoPreviewActive({
    allowDemoPreview: true,
    search: location.search,
    isAuthenticated
  });
  const querySuffix = isDemoActive ? "?preview=demo" : "";

  const canActAsSuperadmin =
    !isAuthenticated || Boolean(user?.roles?.includes("SUPERADMIN"));

  const effectiveAdminRole: "SUPERADMIN" | "SUPPORT" = isAuthenticated
    ? canActAsSuperadmin
      ? adminRoleMode
      : "SUPPORT"
    : adminRoleMode;

  const navItems = [
    { id: "AD-001", label: "Command Dashboard", to: "/admin", icon: Shield, superadminOnly: true },
    { id: "AD-002", label: "Host KYC Queue", to: "/admin/hosts/review", icon: Building2, superadminOnly: true },
    { id: "AD-003", label: "Host Directory", to: "/admin/hosts", icon: Users, superadminOnly: false },
    { id: "AD-004", label: "Location Moderation", to: "/admin/locations", icon: MapPin, superadminOnly: true },
    { id: "AD-005", label: "Global Bookings", to: "/admin/bookings", icon: Briefcase, superadminOnly: false },
    { id: "AD-006", label: "Payment Log", to: "/admin/payments", icon: CreditCard, superadminOnly: true },
    { id: "AD-007", label: "Refund Queue", to: "/admin/refunds", icon: RotateCcw, superadminOnly: true },
    { id: "AD-008", label: "Payout Batches", to: "/admin/payouts/batches", icon: Layers, superadminOnly: true },
    { id: "AD-009", label: "Manual Disbursement", to: "/admin/payouts/disburse", icon: Send, superadminOnly: true },
    { id: "AD-010", label: "Double-Entry Ledger", to: "/admin/finance/ledger", icon: BookOpen, superadminOnly: true },
    { id: "AD-011", label: "Support Triage", to: "/admin/support", icon: LifeBuoy, superadminOnly: false },
    { id: "AD-012", label: "Ticket Resolution", to: "/admin/support/TKT-9042", icon: MessageSquare, superadminOnly: false },
    { id: "AD-013", label: "Incident & Disputes", to: "/admin/incidents", icon: AlertOctagon, superadminOnly: true },
    { id: "AD-014", label: "Review Moderation", to: "/admin/reviews", icon: Star, superadminOnly: true },
    { id: "AD-015", label: "Promotions Engine", to: "/admin/promotions", icon: Sparkles, superadminOnly: true },
    { id: "AD-016", label: "System Settings", to: "/admin/settings", icon: Settings, superadminOnly: true },
    { id: "AD-017", label: "Security Audit Log", to: "/admin/audit", icon: FileSearch, superadminOnly: true },
    { id: "AD-018", label: "Admin Staff & RBAC", to: "/admin/staff", icon: KeyRound, superadminOnly: true }
  ];

  const activeNav = navItems.find((item) => location.pathname === item.to);
  const blockedForSupport = effectiveAdminRole === "SUPPORT" && activeNav?.superadminOnly;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <aside className="lg:col-span-3 space-y-4">
        <div className="bg-slate-950 text-white rounded-2xl p-4 space-y-3 shadow-md border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-purple-300 font-bold">
              Platform Governance (18 Screens)
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 font-mono">
              {effectiveAdminRole}
            </span>
          </div>
          {canActAsSuperadmin ? (
            <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-xl text-xs">
              <button
                onClick={() => setAdminRoleMode("SUPERADMIN")}
                className={`py-1.5 rounded-lg font-bold transition ${
                  effectiveAdminRole === "SUPERADMIN" ? "bg-purple-600 text-white" : "text-slate-400"
                }`}
              >
                Superadmin
              </button>
              <button
                onClick={() => setAdminRoleMode("SUPPORT")}
                className={`py-1.5 rounded-lg font-bold transition ${
                  effectiveAdminRole === "SUPPORT" ? "bg-amber-500 text-slate-950" : "text-slate-400"
                }`}
              >
                Support Agent
              </button>
            </div>
          ) : (
            <div className="bg-slate-900 px-3 py-2 rounded-xl text-xs text-amber-300 font-mono">
              Authenticated Role: SUPPORT (Non-Financial Queue Scope)
            </div>
          )}
        </div>

        <nav className="bg-white rounded-2xl border border-slate-200 p-2.5 space-y-1 shadow-sm max-h-[75vh] overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            const restricted = effectiveAdminRole === "SUPPORT" && item.superadminOnly;
            return (
              <Link
                key={item.id}
                to={`${item.to}${querySuffix}`}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? "bg-purple-700 text-white shadow-sm"
                    : restricted
                    ? "text-slate-400 hover:bg-slate-50"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="flex items-center gap-1">
                  {restricted && <Lock className="h-3 w-3 text-amber-500" />}
                  <span
                    className={`font-mono text-[10px] ${
                      isActive ? "text-purple-100" : "text-slate-400"
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

      <div className="lg:col-span-9">
        {blockedForSupport ? (
          <div className="bg-white rounded-2xl border border-red-200 p-8 text-center space-y-4">
            <MascotIllustration
              mascot="key"
              size="lg"
              badgeText="RBAC Guard Active: SUPERADMIN Required"
              caption={`Screen ${activeNav?.id} (${activeNav?.label}) is restricted to SUPERADMIN governance (OQ-016). SUPPORT agents are scoped to AD-003, AD-005, AD-011, and AD-012.`}
            />
            <div className="flex justify-center gap-3">
              {canActAsSuperadmin && (
                <PermissionGate requiredRoles={["SUPERADMIN"]} fallback={
                  !isAuthenticated ? (
                    <button
                      onClick={() => setAdminRoleMode("SUPERADMIN")}
                      className="px-4 py-2 rounded-xl bg-purple-700 text-white text-xs font-bold"
                    >
                      Elevate Role Preview to SUPERADMIN
                    </button>
                  ) : null
                }>
                  <button
                    onClick={() => setAdminRoleMode("SUPERADMIN")}
                    className="px-4 py-2 rounded-xl bg-purple-700 text-white text-xs font-bold"
                  >
                    Return to SUPERADMIN View
                  </button>
                </PermissionGate>
              )}
              <Link
                to={`/admin/support${querySuffix}`}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
              >
                Go to Support Triage Queue (AD-011)
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
// AD-001: Platform Command Dashboard (/admin)
// ============================================================================
export function AdminCommandDashboardPage() {
  return (
    <div className="space-y-6" data-screen-id="AD-001">
      <ScreenHeaderBadge
        screenId="AD-001"
        title="Superadmin Platform Command Dashboard"
        subtitle="Global GMV, 15% commission revenue, KYC review queues, and custody incident telemetry."
        workflows={["WF-005", "WF-031", "WF-034", "WF-041"]}
        roleScope="Superadmin"
        backendStatus="HYBRID_PREVIEW"
        rightSlot={<MascotIllustration mascot="salute" size="sm" caption="Platform Command" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-400 font-bold uppercase">Monthly GMV</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{formatLkr(4280000)}</p>
          <span className="text-[11px] text-emerald-700 font-semibold">15% Take Rate: {formatLkr(642000)}</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-400 font-bold uppercase">Pending Host KYC</span>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">3 Hosts</p>
          <span className="text-[11px] text-slate-500">Queue in AD-002</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-400 font-bold uppercase">Unearned Liability Held</span>
          <p className="text-2xl font-extrabold text-blue-600 mt-1">{formatLkr(912400)}</p>
          <span className="text-[11px] text-slate-500">Double-entry balanced (AD-010)</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-400 font-bold uppercase">Security Audit Events</span>
          <p className="text-2xl font-extrabold text-purple-700 mt-1">Immutable</p>
          <span className="text-[11px] text-emerald-700 font-semibold">Live Phase 1B DB Triggers</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="text-base font-bold text-slate-900">All 18 Superadmin Dashboard Screens</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {WEB_ADMIN_SCREENS.map((scr) => (
            <Link
              key={scr.id}
              to={scr.route.replace(":id", "TKT-9042")}
              className="p-3 rounded-xl border border-slate-200 hover:border-purple-500 transition flex items-center justify-between text-xs"
            >
              <div>
                <span className="font-mono font-bold text-purple-700">{scr.id}</span>
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
// AD-002: Host Verification Queue (/admin/hosts/review)
// ============================================================================
export function AdminHostVerificationQueuePage() {
  const [items, setItems] = useState<HostVerificationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await marketplaceApi.getPendingVerifications(1, 20);
      setItems(res.queue || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load verification applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleReview = async (
    verificationId: string,
    decision: "APPROVE" | "REJECT" | "REQUEST_INFO"
  ) => {
    setActionLoading(verificationId);
    setErrorMsg(null);
    setSuccessMsg(null);

    let reason: string | undefined = undefined;
    if (decision === "REJECT" || decision === "REQUEST_INFO") {
      const input = window.prompt(
        decision === "REJECT"
          ? "Provide a mandatory rejection reason for the applicant:"
          : "Provide details on what additional information is required:"
      );
      if (!input || !input.trim()) {
        setActionLoading(null);
        return;
      }
      reason = input.trim();
    }

    try {
      await marketplaceApi.reviewVerification(verificationId, {
        decision,
        rejectionReason: reason,
        adminNotes: `Superadmin action: ${decision}`
      });
      setSuccessMsg(`Application successfully processed (${decision}).`);
      await fetchQueue();
    } catch (err: any) {
      setErrorMsg(err.message || "Action failed. Verify your permissions and try again.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6" data-screen-id="AD-002">
      <ScreenHeaderBadge
        screenId="AD-002"
        title="Host KYC & Business Verification Queue"
        subtitle="Inspect Registrar of Companies BRN certificates, NIC/Passport scans, and storage room photos."
        workflows={["WF-005"]}
        roleScope="Superadmin"
        rightSlot={<MascotIllustration mascot="selfie" size="sm" caption="KYC Document Review" />}
      />

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
          Loading verification applications...
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <p className="text-sm font-bold text-slate-700">Verification Queue is Empty</p>
          <p className="text-xs text-slate-500">
            All submitted host business applications have been reviewed. New submissions will appear here automatically.
          </p>
          <button
            onClick={fetchQueue}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
          >
            Refresh Queue
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((verif) => (
            <div key={verif.verificationId} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 text-xs font-bold">
                      PENDING REVIEW
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {verif.entityType.replace(/_/g, " ")}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    {verif.tradeName} ({verif.legalBusinessName})
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Contact: {verif.ownerEmail} • {verif.ownerDisplayName}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Status: {verif.status} • Submitted: {new Date(verif.submittedAt).toLocaleDateString()} • {verif.documentCount} Document(s) Attached
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={actionLoading === verif.verificationId}
                    onClick={() => handleReview(verif.verificationId, "APPROVE")}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 transition"
                  >
                    {actionLoading === verif.verificationId ? "Processing..." : "Approve & Activate"}
                  </button>
                  <button
                    disabled={actionLoading === verif.verificationId}
                    onClick={() => handleReview(verif.verificationId, "REQUEST_INFO")}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-50 transition"
                  >
                    Request Info
                  </button>
                  <button
                    disabled={actionLoading === verif.verificationId}
                    onClick={() => handleReview(verif.verificationId, "REJECT")}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-50 transition"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AD-003: Host Directory & Management (/admin/hosts)
// ============================================================================
export function AdminHostDirectoryManagementPage() {
  return (
    <div className="space-y-6" data-screen-id="AD-003">
      <ScreenHeaderBadge
        screenId="AD-003"
        title="Global Host Partner Directory & Account Lifecycle"
        subtitle="Inspect verified host entities, SLA compliance rates, and account suspension controls."
        workflows={["WF-005", "WF-013"]}
        roleScope="Superadmin / Support"
        backendStatus="HYBRID_PREVIEW"
        rightSlot={<MascotIllustration mascot="high-five" size="sm" caption="Verified Hosts" />}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 text-xs">
        {DEMO_LOCATIONS.map((loc) => (
          <div
            key={loc.id}
            className="flex flex-wrap items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200"
          >
            <div>
              <p className="font-bold text-slate-900">{loc.verifiedHost}</p>
              <p className="text-slate-500">
                Primary Hub: {loc.name} ({loc.city}) • Rating ★ {loc.rating}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-bold">
              ACTIVE PARTNER
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// AD-004: Storage Location Moderation (/admin/locations)
// ============================================================================
export function AdminStorageLocationModerationPage() {
  const [locations, setLocations] = useState<LocationModerationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchLocations = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await marketplaceApi.getPendingLocationsQueue(1, 20);
      setLocations(res.queue || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load pending locations queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleReview = async (locationId: string, decision: "APPROVE" | "REJECT") => {
    setActionLoading(locationId);
    setErrorMsg(null);
    setSuccessMsg(null);

    let reason: string | undefined = undefined;
    if (decision === "REJECT") {
      const input = window.prompt("Enter the mandatory rejection reason for the host:");
      if (!input || !input.trim()) {
        setActionLoading(null);
        return;
      }
      reason = input.trim();
    }

    try {
      await marketplaceApi.reviewLocation(locationId, {
        decision,
        rejectionReason: reason,
        adminNotes: `Superadmin moderation: ${decision}`
      });
      setSuccessMsg(`Location listing successfully ${decision === "APPROVE" ? "approved and activated" : "rejected"}.`);
      await fetchLocations();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to moderate location. Check permissions and try again.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6" data-screen-id="AD-004">
      <ScreenHeaderBadge
        screenId="AD-004"
        title="Storage Location Moderation & Safety Audit"
        subtitle="Verify CCTV coverage, physical rack capacities, and geospatial pin accuracy."
        workflows={["WF-010", "WF-013"]}
        roleScope="Superadmin"
        rightSlot={<MascotIllustration mascot="map" size="sm" caption="Geospatial Audit" />}
      />

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
          Loading storage locations pending review...
        </div>
      ) : locations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <p className="text-sm font-bold text-slate-700">Location Moderation Queue is Clean</p>
          <p className="text-xs text-slate-500">
            No locations are currently awaiting administrative review. New host location listings will appear here.
          </p>
          <button
            onClick={fetchLocations}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
          >
            Refresh Queue
          </button>
        </div>
      ) : (
        <div className="space-y-3 text-xs">
          {locations.map((loc) => (
            <div
              key={loc.locationId}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold text-[10px]">
                      {loc.status}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{loc.name}</span>
                    <span className="text-slate-500 text-xs">• {loc.businessName}</span>
                  </div>
                  <p className="text-slate-600 mt-1">
                    {loc.addressLine1}, {loc.city}
                  </p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Images: {loc.imageCount} attached • Submitted: {new Date(loc.submittedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={actionLoading === loc.locationId}
                    onClick={() => handleReview(loc.locationId, "APPROVE")}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition disabled:opacity-50"
                  >
                    {actionLoading === loc.locationId ? "Processing..." : "Approve Listing"}
                  </button>
                  <button
                    disabled={actionLoading === loc.locationId}
                    onClick={() => handleReview(loc.locationId, "REJECT")}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AD-005: Global Bookings Ledger (/admin/bookings)
// ============================================================================
export function AdminGlobalBookingsLedgerPage() {
  const { isAuthenticated, user } = useAuthStore();
  const canReadBookings = Boolean(
    isAuthenticated &&
      (user?.roles?.includes("SUPERADMIN") || user?.roles?.includes("SUPPORT"))
  );
  const [liveBookings, setLiveBookings] = useState<BookingDetail[]>([]);
  const [selectedCustody, setSelectedCustody] = useState<CustodyRecordDetail | null>(null);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!canReadBookings) return;
    let active = true;
    marketplaceApi
      .getAdminBookings()
      .then((res) => {
        if (active) setLiveBookings(res.bookings);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [canReadBookings]);

  const handleAdminCancel = async (bookingId: string) => {
    setAdminNotice(null);
    try {
      const updated = await marketplaceApi.adminCancelBooking(bookingId, {
        reason: "Administrative operational cancellation"
      });
      setLiveBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
      setAdminNotice(
        `Booking ${updated.referenceCode} cancelled (${updated.status}). Refund evaluation recorded.`
      );
    } catch (err: unknown) {
      setAdminNotice(err instanceof Error ? err.message : "Cancellation failed.");
    }
  };

  const handleInspectCustody = async (bookingId: string) => {
    setAdminNotice(null);
    try {
      const detail = await marketplaceApi.getAdminCustodyDetail(bookingId);
      setSelectedCustody(detail);
    } catch (err: unknown) {
      setAdminNotice(err instanceof Error ? err.message : "Could not load custody events.");
    }
  };

  return (
    <div className="space-y-6" data-screen-id="AD-005">
      <ScreenHeaderBadge
        screenId="AD-005"
        title="Global Platform Bookings & Custody Ledger"
        subtitle="Cross-location visibility into every active, completed, overdue, and refunded booking."
        workflows={["WF-018", "WF-028", "WF-029"]}
        roleScope="Superadmin / Support"
        backendStatus="LIVE_PHASE_1B"
        rightSlot={<MascotIllustration mascot="suitcase-hug" size="sm" caption="Global Custody" />}
      />

      {adminNotice && (
        <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs font-bold text-purple-950">
          {adminNotice}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-2.5 text-xs">
        {liveBookings.length > 0
          ? liveBookings.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100"
              >
                <div>
                  <span className="font-mono font-bold text-purple-700">{b.referenceCode}</span>
                  <span className="ml-2 font-bold text-slate-900">
                    Traveller {b.travellerUserId.slice(0, 8)}
                  </span>
                  <span className="ml-2 text-slate-500">• {b.location.name}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">
                    {formatLkr(Math.round(b.totalAmountMinor / 100))}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono">
                    {b.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleInspectCustody(b.id)}
                    className="px-2.5 py-1 rounded bg-slate-800 text-white font-bold"
                  >
                    Custody Trail
                  </button>
                  {(b.status === "CONFIRMED" ||
                    b.status === "PENDING_PAYMENT" ||
                    b.status === "PENDING_HOST_APPROVAL") && (
                    <button
                      type="button"
                      onClick={() => handleAdminCancel(b.id)}
                      className="px-2.5 py-1 rounded bg-rose-600 text-white font-bold"
                    >
                      Admin Cancel
                    </button>
                  )}
                </div>
              </div>
            ))
          : DEMO_BOOKINGS.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
              >
                <div>
                  <span className="font-mono font-bold text-purple-700">{b.reference}</span>
                  <span className="ml-2 font-bold text-slate-900">{b.travellerName}</span>
                  <span className="ml-2 text-slate-500">• {b.locationName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{formatLkr(b.totalAmountLkr)}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono">
                    {b.status}
                  </span>
                </div>
              </div>
            ))}
      </div>

      {selectedCustody && (
        <div className="bg-white rounded-2xl border border-slate-300 p-5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <strong className="text-slate-900">
              Custody Audit Trail — Booking {selectedCustody.bookingId}
            </strong>
            <button
              type="button"
              onClick={() => setSelectedCustody(null)}
              className="text-slate-500 hover:text-slate-900 font-bold"
            >
              Close
            </button>
          </div>
          {selectedCustody.events.length === 0 ? (
            <p className="text-slate-500">No physical custody events recorded yet.</p>
          ) : (
            selectedCustody.events.map((evt) => (
              <div key={evt.id} className="p-2 rounded bg-slate-50 border font-mono">
                [{evt.eventType}] actor={evt.actorRole} • status={evt.newStatus} • at=
                {evt.createdAt}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AD-006: Payment Transactions Log (/admin/payments)
// ============================================================================
export function AdminPaymentTransactionsLogPage() {
  const { isAuthenticated, user } = useAuthStore();
  const isSuperadmin = Boolean(isAuthenticated && user?.roles?.includes("SUPERADMIN"));
  const [transactions, setTransactions] = useState<PaymentTransactionRecord[]>([]);

  useEffect(() => {
    if (!isSuperadmin) return;
    let active = true;
    marketplaceApi
      .getAdminPaymentTransactions()
      .then((res) => {
        if (active) setTransactions(res.transactions);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isSuperadmin]);

  return (
    <div className="space-y-6" data-screen-id="AD-006">
      <ScreenHeaderBadge
        screenId="AD-006"
        title="Payment Gateway Transactions & Signed Webhook Log"
        subtitle="Inspect verified HMAC webhook signatures, provider order IDs, and LKR payment captures."
        workflows={["WF-019", "WF-020"]}
        roleScope="Superadmin"
        backendStatus="LIVE_PHASE_1B"
        rightSlot={<MascotIllustration mascot="phone" size="sm" caption="Gateway Webhooks" />}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-2.5 text-xs">
        {transactions.length > 0
          ? transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
              >
                <div>
                  <span className="font-mono font-bold text-slate-900">
                    {tx.provider} • {tx.providerTransactionId || tx.id.slice(0, 8)}
                  </span>
                  <span className="ml-2 text-slate-500">
                    Booking {tx.referenceCode || tx.bookingId.slice(0, 8)} • sigVerified=
                    {String(tx.signatureVerified)}
                  </span>
                </div>
                <span className="font-bold text-emerald-700">
                  {tx.status} • {formatLkr(Math.round(tx.amountMinor / 100))}
                </span>
              </div>
            ))
          : DEMO_BOOKINGS.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
              >
                <div>
                  <span className="font-mono font-bold text-slate-900">
                    PAYHERE-{b.id.toUpperCase()}
                  </span>
                  <span className="ml-2 text-slate-500">Booking {b.reference}</span>
                </div>
                <span className="font-bold text-emerald-700">
                  CAPTURED • {formatLkr(b.totalAmountLkr)}
                </span>
              </div>
            ))}
      </div>
    </div>
  );
}

// ============================================================================
// AD-007: Refund Management Queue (/admin/refunds)
// ============================================================================
export function AdminRefundManagementQueuePage() {
  const { isAuthenticated, user } = useAuthStore();
  const canReadRefunds = Boolean(
    isAuthenticated &&
      (user?.roles?.includes("SUPERADMIN") || user?.roles?.includes("SUPPORT"))
  );
  const canExecuteRefunds = Boolean(isAuthenticated && user?.roles?.includes("SUPERADMIN"));
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [refundNotice, setRefundNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!canReadRefunds) return;
    let active = true;
    marketplaceApi
      .getAdminRefunds()
      .then((res) => {
        if (active) setRefunds(res.refunds);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [canReadRefunds]);

  const nextRefundStage = (
    current: RefundStatus
  ): AdminTransitionRefundRequest["targetStatus"] | null => {
    switch (current) {
      case "REQUESTED":
        return "AUTHORIZED";
      case "AUTHORIZED":
        return "INITIATED";
      case "INITIATED":
        return "PROCESSING";
      case "PROCESSING":
        return "SUCCEEDED";
      default:
        return null;
    }
  };

  const handleAdvanceRefund = async (item: RefundRecord) => {
    const next = nextRefundStage(item.status);
    if (!next) return;
    setRefundNotice(null);
    try {
      const updated = await marketplaceApi.adminTransitionRefund(item.id, {
        targetStatus: next,
        providerRefundId: next === "INITIATED" ? `RFD-GW-${Date.now()}` : undefined,
        notes: `Advanced to ${next} via Superadmin Queue`
      });
      setRefunds((prev) => prev.map((r) => (r.id === item.id ? updated : r)));
      setRefundNotice(
        `Refund ${updated.referenceCode || updated.bookingId.slice(0, 8)} transitioned to ${updated.status}.`
      );
    } catch (err: unknown) {
      setRefundNotice(err instanceof Error ? err.message : "Refund transition failed.");
    }
  };

  return (
    <div className="space-y-6" data-screen-id="AD-007">
      <ScreenHeaderBadge
        screenId="AD-007"
        title="Refund Management & 7-Stage Settlement Queue"
        subtitle="Adjudicate cancellation policy windows (>2h 100%, <=2h 50%) and execute gateway reversals."
        workflows={["WF-030", "WF-031", "WF-032"]}
        roleScope="Superadmin / Support (Read-Only)"
        backendStatus="LIVE_PHASE_1B"
        rightSlot={
          <MascotIllustration mascot="sitting-suitcase" size="sm" caption="7-Stage Tracking" />
        }
      />

      {refundNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-950">
          {refundNotice}
        </div>
      )}

      {refunds.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 text-xs">
          {refunds.map((item) => {
            const next = nextRefundStage(item.status);
            return (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <span className="font-mono font-bold text-purple-700">
                    {item.referenceCode || item.bookingId.slice(0, 8)}
                  </span>
                  <span className="ml-2 font-bold text-slate-900">
                    {formatLkr(Math.round(item.amountMinor / 100))} ({item.refundPercentage}%)
                  </span>
                  <p className="text-slate-600 mt-0.5">
                    Reason: {item.reasonCategory} • Current Stage: <strong>{item.status}</strong>
                  </p>
                </div>
                {canExecuteRefunds && next && (
                  <button
                    type="button"
                    onClick={() => handleAdvanceRefund(item)}
                    className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold"
                  >
                    Advance to {next}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 text-xs">
          <p className="font-bold text-slate-900">
            Active Refund #RFD-8799 — Sophie Laurent ({formatLkr(15980)} • 100% Policy Window)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {REFUND_SEVEN_STAGES.map((s) => (
              <div key={s.stage} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-mono font-bold text-purple-700">Stage {s.stage}:</span>{" "}
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AD-008: Host Payout Batch Generation (/admin/payouts/batches)
// ============================================================================
export function AdminHostPayoutBatchGenerationPage() {
  return (
    <div className="space-y-6" data-screen-id="AD-008">
      <ScreenHeaderBadge
        screenId="AD-008"
        title="Host Payout Batch Generation Engine"
        subtitle="Aggregate completed bookings into weekly LKR settlement batches (85% Host Net / 15% Commission)."
        workflows={["WF-034"]}
        roleScope="Superadmin"
        rightSlot={<MascotIllustration mascot="alarm-clock" size="sm" caption="Weekly Settlement" />}
      />
      <DeferredBackendNotice featureName="Automated Payout Batch Compilation" />
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs space-y-2">
        <p className="font-bold text-slate-900">
          Batch #BATCH-2026-W45 • 5 Verified Host Entities • Net Disbursement: {formatLkr(642800)}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// AD-009: Manual Payout Disbursement (/admin/payouts/disburse)
// ============================================================================
export function AdminManualPayoutDisbursementPage() {
  return (
    <div className="space-y-6" data-screen-id="AD-009">
      <ScreenHeaderBadge
        screenId="AD-009"
        title="Manual Payout Disbursement & Bank Reference Recording"
        subtitle="Record CEFT/SLIPS bank transfer reference numbers and upload settlement receipts."
        workflows={["WF-035"]}
        roleScope="Superadmin"
        rightSlot={<MascotIllustration mascot="jump" size="sm" caption="CEFT / SLIPS Settlement" />}
      />
      <DeferredBackendNotice featureName="Disbursement Execution & Ledger Posting" />
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs">
        <p className="font-bold text-slate-900">
          Awaiting Bank Reference Confirmation: Batch #BATCH-2026-W45 (Commercial Bank CEFT)
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// AD-010: Double-Entry Financial Ledger (/admin/finance/ledger)
// ============================================================================
export function AdminDoubleEntryFinancialLedgerPage() {
  const { isAuthenticated, user } = useAuthStore();
  const isSuperadmin = Boolean(isAuthenticated && user?.roles?.includes("SUPERADMIN"));
  const [liveLedger, setLiveLedger] = useState<AdminLedgerResponse | null>(null);

  useEffect(() => {
    if (!isSuperadmin) return;
    let active = true;
    marketplaceApi
      .getAdminLedger()
      .then((res) => {
        if (active && res.entries.length > 0) {
          setLiveLedger(res);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isSuperadmin]);

  const demoEntries = [
    {
      id: "JRN-901",
      account: "PLATFORM_CLEARING_RECEIVABLE",
      debit: 3800,
      credit: 0,
      ref: "LS-2026-8841"
    },
    { id: "JRN-902", account: "HOST_PAYABLE_LIABILITY", debit: 0, credit: 3230, ref: "LS-2026-8841" },
    { id: "JRN-903", account: "PLATFORM_COMMISSION_REVENUE", debit: 0, credit: 570, ref: "LS-2026-8841" }
  ];
  return (
    <div className="space-y-6" data-screen-id="AD-010">
      <ScreenHeaderBadge
        screenId="AD-010"
        title="Immutable Double-Entry Financial Ledger"
        subtitle="Append-only non-escrow marketplace settlement ledger balanced across clearing, unearned liability, commission revenue, host payable, and refund liability."
        workflows={["WF-036"]}
        roleScope="Superadmin"
        backendStatus="LIVE_PHASE_1B"
        rightSlot={
          <MascotIllustration mascot="blank-tag" size="sm" caption="Balanced Debit = Credit" />
        }
      />

      {liveLedger && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-emerald-950">
            Ledger Trial Balance:{" "}
            {liveLedger.totals.isBalanced ? "BALANCED (0 Discrepancy)" : "UNBALANCED"}
          </span>
          <span className="font-mono font-bold text-emerald-900">
            Total Debits: {formatLkr(Math.round(liveLedger.totals.totalDebitsMinor / 100))} | Total
            Credits: {formatLkr(Math.round(liveLedger.totals.totalCreditsMinor / 100))}
          </span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-2 text-xs font-mono">
        {liveLedger
          ? liveLedger.entries.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
              >
                <span>
                  {e.transactionGroupId.slice(0, 8)} • {e.accountCode} ({e.referenceType})
                </span>
                <span>
                  {e.entryType === "DEBIT"
                    ? `DR: ${formatLkr(Math.round(e.amountMinor / 100))} | CR: LKR 0`
                    : `DR: LKR 0 | CR: ${formatLkr(Math.round(e.amountMinor / 100))}`}
                </span>
              </div>
            ))
          : demoEntries.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
              >
                <span>
                  {e.id} • {e.account} ({e.ref})
                </span>
                <span>
                  DR: {formatLkr(e.debit)} | CR: {formatLkr(e.credit)}
                </span>
              </div>
            ))}
      </div>
    </div>
  );
}

// ============================================================================
// AD-011: Support Ticket Triage Queue (/admin/support)
// ============================================================================
export function AdminSupportTicketTriageQueuePage() {
  return (
    <div className="space-y-6" data-screen-id="AD-011">
      <ScreenHeaderBadge
        screenId="AD-011"
        title="Support Ticket Triage Queue"
        subtitle="Prioritized traveller and host support inquiries with SLA timers."
        workflows={["WF-039", "WF-040"]}
        roleScope="Support / Superadmin"
        rightSlot={<MascotIllustration mascot="thinking" size="sm" caption="Support Triage" />}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-between text-xs">
        <div>
          <span className="font-mono font-bold text-purple-700">#TKT-9042</span>
          <p className="font-bold text-slate-900 mt-0.5">
            Train Delayed at Peradeniya — Requesting 2-Hour Pick-Up Extension
          </p>
        </div>
        <Link
          to="/admin/support/TKT-9042"
          className="px-4 py-2 rounded-xl bg-purple-700 text-white font-bold"
        >
          Resolve Ticket (AD-012)
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// AD-012: Support Ticket Resolution View (/admin/support/:id)
// ============================================================================
export function AdminSupportTicketResolutionViewPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-6" data-screen-id="AD-012">
      <ScreenHeaderBadge
        screenId="AD-012"
        title={`Support Ticket Resolution Workspace — ${id || "TKT-9042"}`}
        subtitle="Unified conversation thread with linked booking custody metadata and resolution macros."
        workflows={["WF-040"]}
        roleScope="Support / Superadmin"
        rightSlot={<MascotIllustration mascot="phone" size="sm" caption="Active Thread" />}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 text-xs">
        <p className="font-bold text-slate-900">
          Linked Booking: #LS-2026-8841 • Traveller: Amaya Perera
        </p>
        <p className="text-slate-600">
          Host notified of 2-hour scenic rail delay; grace note attached to custody record.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// AD-013: Incident & Dispute Investigation (/admin/incidents)
// ============================================================================
export function AdminIncidentDisputeInvestigationPage() {
  return (
    <div className="space-y-6" data-screen-id="AD-013">
      <ScreenHeaderBadge
        screenId="AD-013"
        title="Custody Incident, Overdue Dispute & Seal Investigation"
        subtitle="Adjudicate decoupled Mandatory Release (OQ-015 / BR-035) handovers, audited PIN fallbacks, and seal or bag-count exceptions."
        workflows={["WF-027", "WF-041", "WF-042"]}
        roleScope="Superadmin"
        rightSlot={<MascotIllustration mascot="shrug" size="sm" caption="OQ-015 / BR-035 Enforcement" />}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs space-y-2">
        <p className="font-bold text-slate-900">
          Incident #INC-2026-14 — Decoupled Overdue Release & Fee Dispute (Booking #LS-2026-8835)
        </p>
        <p className="text-slate-600">
          Physical luggage custody released immediately to traveller upon QR/PIN verification and
          bag-count reconciliation under OQ-015 & Invariant BR-035 (custody completion and financial
          dispute handling are strictly separated). Location&apos;s disclosed, configurable late fee
          request (illustrative demo policy: 1.5x daily rate after illustrative 30m grace window) is
          logged for in-app review and dispute resolution—no silent charge was executed.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// AD-014: Review Moderation Queue (/admin/reviews)
// ============================================================================
export function AdminReviewModerationQueuePage() {
  return (
    <div className="space-y-6" data-screen-id="AD-014">
      <ScreenHeaderBadge
        screenId="AD-014"
        title="Traveller Review & Rating Moderation Queue"
        subtitle="Verify authentic post-checkout reviews and moderate flagged content."
        workflows={["WF-038"]}
        roleScope="Superadmin"
        rightSlot={<MascotIllustration mascot="high-five" size="sm" caption="Verified Reviews" />}
      />
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs">
        <p className="font-bold text-slate-900">All 931 published reviews verified via completed check-out tokens.</p>
      </div>
    </div>
  );
}

// ============================================================================
// AD-015: Promotion & Marketing Engine (/admin/promotions)
// ============================================================================
export function AdminPromotionMarketingEnginePage() {
  return (
    <div className="space-y-6" data-screen-id="AD-015">
      <ScreenHeaderBadge
        screenId="AD-015"
        title="Promotions, Discount Vouchers & Campaign Engine"
        subtitle="Manage seasonal Sri Lanka tourism promo codes (SLWELCOME10, ELLAEXPRESS15) and redemption caps."
        workflows={["WF-043"]}
        roleScope="Superadmin"
        rightSlot={<MascotIllustration mascot="blank-tag" size="sm" caption="Active Promo Codes" />}
      />
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs">
        <p className="font-bold text-slate-900">Active Campaign: SLWELCOME10 (10% Off First Custody Booking)</p>
      </div>
    </div>
  );
}

// ============================================================================
// AD-016: Platform System Configuration (/admin/settings)
// ============================================================================
export function AdminPlatformSystemConfigurationPage() {
  const [gracePolicyMode, setGracePolicyMode] = useState("LOCATION_CONFIGURABLE");
  const [photoPolicyMode, setPhotoPolicyMode] = useState("OPTIONAL_DEFAULT_PER_LOCATION_MANDATORY");

  return (
    <div className="space-y-6" data-screen-id="AD-016">
      <ScreenHeaderBadge
        screenId="AD-016"
        title="Global Platform System Configuration & Policy Parameters"
        subtitle="Configure commission split, Host SLA timeout, configurable late collection fee bounds (OQ-015), and photo evidence rules (OQ-014)."
        workflows={["WF-044"]}
        roleScope="Superadmin"
        rightSlot={<MascotIllustration mascot="pointing" size="sm" caption="Configurable Policies" />}
      />
      <div className="bg-white rounded-2xl border border-slate-200 p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 border">
          Platform Commission: <strong>15% (Host Net 85%)</strong>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border">
          Host Approval SLA: <strong>15 Minutes</strong>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border space-y-1">
          <span className="block font-bold text-slate-800">
            Late Collection Grace & Fee Policy (OQ-015):
          </span>
          <select
            aria-label="Late Collection Grace & Fee Policy"
            value={gracePolicyMode}
            onChange={(e) => setGracePolicyMode(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs bg-white"
          >
            <option value="LOCATION_CONFIGURABLE">
              Configurable per Location (Illustrative Demo: 30m–60m Grace / Disclosed Rate)
            </option>
            <option value="HOURLY_EXTENSION_CAP">
              Configurable Hourly / Daily Cap Extension Policy
            </option>
          </select>
          <span className="block text-[11px] text-slate-500">
            No universal hardcoded default; disclosed before checkout; in-app payment only; no
            silent charges.
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border space-y-1">
          <span className="block font-bold text-slate-800">
            Check-In Photo Evidence Policy (OQ-014):
          </span>
          <select
            aria-label="Check-In Photo Evidence Policy"
            value={photoPolicyMode}
            onChange={(e) => setPhotoPolicyMode(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs bg-white"
          >
            <option value="OPTIONAL_DEFAULT_PER_LOCATION_MANDATORY">
              Optional by Default • Configurable Mandatory per Location
            </option>
            <option value="MANDATORY_HIGH_RISK_HUBS">
              Mandatory for High-Volume Transit Vaults
            </option>
          </select>
          <span className="block text-[11px] text-slate-500">
            Server-side QR verification with rate-limited PIN fallback & mandatory bag-count check.
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AD-017: Security & Compliance Audit Log (/admin/audit)
// ============================================================================
export function AdminSecurityComplianceAuditLogPage() {
  const { isAuthenticated, user } = useAuthStore();
  const [liveEvents, setLiveEvents] = useState<SecurityAuditEvent[]>([]);
  const [eventFilter, setEventFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSuperadmin = Boolean(isAuthenticated && user?.roles?.includes("SUPERADMIN"));

  useEffect(() => {
    if (!isSuperadmin) return;
    let active = true;
    setIsLoading(true);
    setErrorMessage(null);
    authApi
      .listAdminAuditEvents({
        page: 1,
        limit: 25,
        eventType: eventFilter || undefined
      })
      .then((items) => {
        if (active) setLiveEvents(items);
      })
      .catch((err: unknown) => {
        if (active) {
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to load security audit events."
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isSuperadmin, eventFilter]);

  return (
    <div className="space-y-6" data-screen-id="AD-017">
      <ScreenHeaderBadge
        screenId="AD-017"
        title="Immutable Security & Compliance Audit Log"
        subtitle="Append-only PostgreSQL trigger-protected security_audit_events stream (/api/v1/admin/audit-events)."
        workflows={["WF-005", "WF-031", "WF-035", "WF-044"]}
        roleScope="Superadmin"
        backendStatus="LIVE_PHASE_1B"
        rightSlot={<MascotIllustration mascot="key" size="sm" caption="Append-Only Audit" />}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-semibold text-slate-800">
            {isSuperadmin
              ? "Connected to Live /api/v1/admin/audit-events Stream (admin.audit.read)"
              : "Demo Preview Stream (Sign in as SUPERADMIN for live PostgreSQL audit stream)"}
          </div>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            aria-label="Filter security audit events by type"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white font-mono"
          >
            <option value="">All Event Types</option>
            <option value="AUTH_LOGIN_SUCCESS">AUTH_LOGIN_SUCCESS</option>
            <option value="AUTH_LOGIN_FAILURE">AUTH_LOGIN_FAILURE</option>
            <option value="AUTH_EMAIL_VERIFICATION_SENT">AUTH_EMAIL_VERIFICATION_SENT</option>
            <option value="AUTH_EMAIL_VERIFICATION_COMPLETED">
              AUTH_EMAIL_VERIFICATION_COMPLETED
            </option>
            <option value="AUTH_RATE_LIMIT_EXCEEDED">AUTH_RATE_LIMIT_EXCEEDED</option>
            <option value="AUTH_ROLE_ASSIGNED">AUTH_ROLE_ASSIGNED</option>
            <option value="AUTH_ACCESS_DENIED">AUTH_ACCESS_DENIED</option>
          </select>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
            {errorMessage}
          </div>
        )}

        {isSuperadmin && !isLoading && liveEvents.length > 0 ? (
          <div className="space-y-2 font-mono">
            {liveEvents.map((ev) => (
              <div
                key={ev.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  [{ev.eventType}] user={ev.userId ?? "anonymous"} • ip={ev.ipAddress ?? "n/a"}
                </span>
                <span className="text-slate-500">{ev.createdAt}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 font-mono">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              [AUTH_LOGIN_SUCCESS] actor=superadmin@luggagestorage.lk • ip=127.0.0.1 • surface=WEB
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              [AUTH_EMAIL_VERIFICATION_COMPLETED] target=traveller@luggagestorage.lk • status=ACTIVE
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              [AUTH_ROLE_ASSIGNED] target=host.owner@ceylontransit.lk • role=HOST_OWNER • outcome=SUCCESS
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// AD-018: Administrative Staff & RBAC (/admin/staff)
// ============================================================================
export function AdminStaffRbacManagementPage() {
  return (
    <div className="space-y-6" data-screen-id="AD-018">
      <ScreenHeaderBadge
        screenId="AD-018"
        title="Administrative Staff & RBAC Matrix Governance"
        subtitle="Manage SUPERADMIN, SUPPORT, HOST_OWNER, HOST_STAFF, and TRAVELLER role assignments with last-Superadmin protection."
        workflows={["WF-006", "WF-044"]}
        roleScope="Superadmin"
        backendStatus="LIVE_PHASE_1B"
        rightSlot={<MascotIllustration mascot="key" size="sm" caption="Phase 1B RBAC Matrix" />}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-2 text-xs">
        <p className="font-bold text-slate-900">
          Enforced via Phase 1B RBAC API (/api/v1/admin/users & /api/v1/admin/roles):
        </p>
        <p className="text-slate-600">
          5 Canonical Roles • 12 Granular Permissions • Last-Superadmin demotion/deactivation guard
          active.
        </p>
      </div>
    </div>
  );
}

