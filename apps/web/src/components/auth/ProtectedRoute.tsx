import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { Loader2 } from "lucide-react";

export interface ProtectedRouteProps {
  requiredPermission?: string;
  requiredPermissions?: string[];
  requireAnyPermission?: string[];
  requiredRoles?: string[];
  allowDemoPreview?: boolean;
}

export function ProtectedRoute({
  requiredPermission,
  requiredPermissions,
  requireAnyPermission,
  requiredRoles,
  allowDemoPreview = false
}: ProtectedRouteProps) {
  const location = useLocation();
  const {
    isAuthenticated,
    isInitializing,
    user,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission
  } = useAuthStore();

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-sm text-slate-500 font-medium">Verifying session...</p>
      </div>
    );
  }

  const searchParams = new URLSearchParams(location.search);
  const isDemoPreviewOptIn = allowDemoPreview && searchParams.get("preview") === "demo";

  if (!isAuthenticated) {
    if (isDemoPreviewOptIn) {
      return (
        <div className="space-y-4">
          <div
            data-testid="demo-preview-isolation-banner"
            className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-2.5 text-xs text-amber-900 flex items-center justify-between"
          >
            <span className="font-semibold">
              DEMO PREVIEW MODE (Explicit Opt-In Sandbox) — Unauthenticated UX inspection only. Live API mutations require authentication.
            </span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-amber-200/70 text-amber-950">
              ?preview=demo
            </span>
          </div>
          <Outlet />
        </div>
      );
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Permission authorization checks
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/forbidden" state={{ requiredPermission }} replace />;
  }

  if (requiredPermissions && requiredPermissions.length > 0 && !hasAllPermissions(requiredPermissions)) {
    return <Navigate to="/forbidden" state={{ requiredPermissions }} replace />;
  }

  if (requireAnyPermission && requireAnyPermission.length > 0 && !hasAnyPermission(requireAnyPermission)) {
    return <Navigate to="/forbidden" state={{ requireAnyPermission }} replace />;
  }

  // Role authorization checks (if specified)
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRole = user?.roles?.some((r) => requiredRoles.includes(r));
    if (!hasRole) {
      return <Navigate to="/forbidden" state={{ requiredRoles }} replace />;
    }
  }

  return <Outlet />;
}

