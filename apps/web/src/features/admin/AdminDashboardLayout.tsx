import React, { createContext, useContext, useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { SYSTEM_PERMISSIONS } from "@luggage-storage/contracts";
import {
  AlertOctagon,
  BookOpen,
  Briefcase,
  Building2,
  CreditCard,
  FileSearch,
  KeyRound,
  Layers,
  LifeBuoy,
  Lock,
  MapPin,
  RotateCcw,
  Send,
  Settings,
  Shield,
  Sparkles,
  Star,
  Users
} from "lucide-react";
import { MascotIllustration } from "@/components/ui";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { isFeaturePromotionsEnabled, isFeatureReviewsEnabled } from "@/config/feature-flags";
import { useAuthStore } from "@/store/useAuthStore";

export type EffectiveAdminRole = "SUPERADMIN" | "SUPPORT";

export const AdminRoleContext = createContext<EffectiveAdminRole | null>(null);

export function useAdminRole(): EffectiveAdminRole {
  const ctx = useContext(AdminRoleContext);
  const user = useAuthStore((s) => s.user);
  if (ctx) return ctx;
  return user?.roles?.includes("SUPPORT") && !user?.roles?.includes("SUPERADMIN")
    ? "SUPPORT"
    : "SUPERADMIN";
}

const SUPPORT_ALLOWED_EXACT_PATHS = new Set([
  "/admin/hosts/review",
  "/admin/hosts",
  "/admin/locations",
  "/admin/bookings",
  "/admin/payments",
  "/admin/refunds",
  "/admin/support",
  "/admin/incidents",
  "/admin/staff"
]);

function isSupportAllowedAdminPath(normalizedPath: string): boolean {
  if (SUPPORT_ALLOWED_EXACT_PATHS.has(normalizedPath)) {
    return true;
  }
  if (/^\/admin\/bookings\/[^/]+$/.test(normalizedPath)) {
    return true;
  }
  return /^\/admin\/support\/[^/]+$/.test(normalizedPath);
}

interface AdminNavItem {
  key: string;
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission: string;
  matchPrefix?: string;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    key: "dashboard",
    label: "Command Dashboard",
    to: "/admin",
    icon: Shield,
    requiredPermission: SYSTEM_PERMISSIONS.ADMIN_FINANCIAL_MANAGE
  },
  {
    key: "hosts-review",
    label: "Host KYC Queue",
    to: "/admin/hosts/review",
    icon: Building2,
    requiredPermission: SYSTEM_PERMISSIONS.ADMIN_HOST_READ
  },
  {
    key: "hosts-directory",
    label: "Host Directory",
    to: "/admin/hosts",
    icon: Users,
    requiredPermission: SYSTEM_PERMISSIONS.ADMIN_HOST_READ
  },
  {
    key: "locations",
    label: "Location Moderation",
    to: "/admin/locations",
    icon: MapPin,
    requiredPermission: SYSTEM_PERMISSIONS.ADMIN_LOCATION_READ
  },
  {
    key: "bookings",
    label: "Global Bookings",
    to: "/admin/bookings",
    matchPrefix: "/admin/bookings",
    icon: Briefcase,
    requiredPermission: SYSTEM_PERMISSIONS.ADMIN_BOOKING_READ
  },
  {
    key: "payments",
    label: "Payment Log",
    to: "/admin/payments",
    icon: CreditCard,
    requiredPermission: SYSTEM_PERMISSIONS.ADMIN_PAYMENT_READ
  },
  {
    key: "refunds",
    label: "Refund Queue",
    to: "/admin/refunds",
    icon: RotateCcw,
    requiredPermission: SYSTEM_PERMISSIONS.ADMIN_REFUND_READ
  },
  {
    key: "payout-batches",
    label: "Payout Batches",
    to: "/admin/payouts/batches",
    icon: Layers,
    requiredPermission: SYSTEM_PERMISSIONS.ADMIN_FINANCIAL_MANAGE
  },
  {
    key: "payout-disburse",
    label: "Manual Disbursement",
    to: "/admin/payouts/disburse",
    icon: Send,
    requiredPermission: SYSTEM_PERMISSIONS.ADMIN_FINANCIAL_MANAGE
  },
  {
    key: "ledger",
    label: "Double-Entry Ledger",
    to: "/admin/finance/ledger",
    icon: BookOpen,
    requiredPermission: SYSTEM_PERMISSIONS.ADMIN_FINANCIAL_MANAGE
  },
  {
    key: "support",
    label: "Support Triage",
    to: "/admin/support",
    matchPrefix: "/admin/support",
    icon: LifeBuoy,
    requiredPermission: SYSTEM_PERMISSIONS.SUPPORT_TICKET_READ
  },
  {
    key: "incidents",
    label: "Incident & Disputes",
    to: "/admin/incidents",
    icon: AlertOctagon,
    requiredPermission: SYSTEM_PERMISSIONS.ADMIN_BOOKING_READ
  },
  {
    key: "reviews",
    label: "Review Moderation",
    to: "/admin/reviews",
    icon: Star,
    requiredPermission: SYSTEM_PERMISSIONS.ADMIN_PLATFORM_MANAGE
  },
  {
    key: "promotions",
    label: "Promotions Engine",
    to: "/admin/promotions",
    icon: Sparkles,
    requiredPermission: SYSTEM_PERMISSIONS.ADMIN_PLATFORM_MANAGE
  },
  {
    key: "settings",
    label: "System Settings",
    to: "/admin/settings",
    icon: Settings,
    requiredPermission: SYSTEM_PERMISSIONS.ADMIN_PLATFORM_MANAGE
  },
  {
    key: "audit",
    label: "Security Audit Log",
    to: "/admin/audit",
    icon: FileSearch,
    requiredPermission: SYSTEM_PERMISSIONS.ADMIN_AUDIT_READ
  },
  {
    key: "users-rbac",
    label: "Users & RBAC",
    to: "/admin/staff",
    icon: KeyRound,
    requiredPermission: SYSTEM_PERMISSIONS.ADMIN_USER_READ
  }
];

const DEFAULT_SUPPORT_PERMISSIONS = new Set<string>([
  SYSTEM_PERMISSIONS.ADMIN_HOST_READ,
  SYSTEM_PERMISSIONS.ADMIN_LOCATION_READ,
  SYSTEM_PERMISSIONS.ADMIN_BOOKING_READ,
  SYSTEM_PERMISSIONS.ADMIN_PAYMENT_READ,
  SYSTEM_PERMISSIONS.ADMIN_REFUND_READ,
  SYSTEM_PERMISSIONS.ADMIN_USER_READ,
  SYSTEM_PERMISSIONS.ADMIN_ROLE_READ,
  SYSTEM_PERMISSIONS.ADMIN_PERMISSION_READ,
  SYSTEM_PERMISSIONS.SUPPORT_TICKET_READ,
  SYSTEM_PERMISSIONS.SUPPORT_TICKET_UPDATE
]);

export function AdminDashboardLayout() {
  const location = useLocation();
  const { isAuthenticated, user, permissions } = useAuthStore();
  const [adminRoleMode, setAdminRoleMode] = useState<EffectiveAdminRole>("SUPERADMIN");

  const isDemoActive = isDemoPreviewActive({
    allowDemoPreview: true,
    search: location.search,
    isAuthenticated
  });
  const querySuffix = isDemoActive ? "?preview=demo" : "";

  const canActAsSuperadmin = isAuthenticated
    ? Boolean(user?.roles?.includes("SUPERADMIN"))
    : isDemoActive;

  const effectiveAdminRole: EffectiveAdminRole = isAuthenticated
    ? canActAsSuperadmin
      ? "SUPERADMIN"
      : "SUPPORT"
    : adminRoleMode;

  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";

  const hasNavPermission = (requiredPermission: string): boolean => {
    if (!isAuthenticated) {
      if (effectiveAdminRole === "SUPERADMIN") return true;
      return DEFAULT_SUPPORT_PERMISSIONS.has(requiredPermission);
    }
    if (permissions.length > 0) {
      return permissions.includes(requiredPermission);
    }
    if (canActAsSuperadmin) return true;
    return DEFAULT_SUPPORT_PERMISSIONS.has(requiredPermission);
  };

  if (isAuthenticated && !canActAsSuperadmin && normalizedPath === "/admin") {
    return <Navigate to={`/admin/bookings${querySuffix}`} replace />;
  }

  const visibleNavItems = ADMIN_NAV_ITEMS.filter((item) => {
    if (isDemoActive) return true;
    if (item.key === "reviews") return isFeatureReviewsEnabled();
    if (item.key === "promotions") return isFeaturePromotionsEnabled();
    return true;
  });

  const matchedItem = visibleNavItems.find((item) => {
    if (normalizedPath === item.to) return true;
    if (item.matchPrefix && normalizedPath.startsWith(`${item.matchPrefix}/`)) return true;
    return false;
  });

  const blockedByPermissions = isAuthenticated
    ? matchedItem
      ? !hasNavPermission(matchedItem.requiredPermission)
      : !canActAsSuperadmin && !isSupportAllowedAdminPath(normalizedPath)
    : effectiveAdminRole === "SUPPORT" && !isSupportAllowedAdminPath(normalizedPath);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <aside className="lg:col-span-3 space-y-4">
        <div className="bg-slate-950 text-white rounded-2xl p-4 space-y-3 shadow-md border border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-purple-300 font-bold">
              Platform Governance
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 font-mono">
              {effectiveAdminRole}
            </span>
          </div>

          {!isAuthenticated && isDemoActive ? (
            <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setAdminRoleMode("SUPERADMIN")}
                className={`py-1.5 rounded-lg font-bold transition ${
                  effectiveAdminRole === "SUPERADMIN"
                    ? "bg-purple-600 text-white"
                    : "text-slate-400"
                }`}
              >
                Superadmin
              </button>
              <button
                type="button"
                onClick={() => setAdminRoleMode("SUPPORT")}
                className={`py-1.5 rounded-lg font-bold transition ${
                  effectiveAdminRole === "SUPPORT"
                    ? "bg-amber-500 text-slate-950"
                    : "text-slate-400"
                }`}
              >
                Support Agent
              </button>
            </div>
          ) : (
            <div className="bg-slate-900 px-3 py-2 rounded-xl text-xs text-slate-200 font-mono">
              {canActAsSuperadmin
                ? "Authenticated Role: SUPERADMIN (Full Governance)"
                : "Authenticated Role: SUPPORT (Read-Only Oversight)"}
            </div>
          )}
        </div>

        <nav
          aria-label="Admin portal navigation"
          className="bg-white rounded-2xl border border-slate-200 p-2.5 space-y-1 shadow-sm max-h-[75vh] overflow-y-auto"
        >
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              normalizedPath === item.to ||
              Boolean(item.matchPrefix && normalizedPath.startsWith(`${item.matchPrefix}/`));
            const restricted = !hasNavPermission(item.requiredPermission);
            return (
              <Link
                key={item.key}
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
                {restricted && <Lock className="h-3 w-3 text-amber-500 flex-shrink-0" />}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:col-span-9">
        {blockedByPermissions ? (
          <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-4">
            <MascotIllustration
              mascot="key"
              size="lg"
              badgeText="RBAC Guard Active: Restricted Governance Scope"
              caption={`The workspace "${matchedItem?.label ?? normalizedPath}" requires Superadmin financial or moderation permissions. Support accounts have read-only oversight across Host KYC, Directory, Locations, Bookings, Payments, Refunds, and User Lookup.`}
            />
            <div className="flex flex-wrap justify-center gap-3">
              {!isAuthenticated && isDemoActive && (
                <button
                  type="button"
                  onClick={() => setAdminRoleMode("SUPERADMIN")}
                  className="px-4 py-2 rounded-xl bg-purple-700 text-white text-xs font-bold"
                >
                  Return to Superadmin View
                </button>
              )}
              <Link
                to={`/admin/bookings${querySuffix}`}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
              >
                Go to Global Bookings
              </Link>
              <Link
                to={`/admin/hosts/review${querySuffix}`}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
              >
                Go to Host KYC Queue
              </Link>
            </div>
          </div>
        ) : (
          <AdminRoleContext.Provider value={effectiveAdminRole}>
            <Outlet />
          </AdminRoleContext.Provider>
        )}
      </div>
    </div>
  );
}
