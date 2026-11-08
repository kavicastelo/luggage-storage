import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { Loader2 } from "lucide-react";

export interface ProtectedRouteProps {
  requiredPermission?: string;
  requiredPermissions?: string[];
  requireAnyPermission?: string[];
  requiredRoles?: string[];
}

export function ProtectedRoute({
  requiredPermission,
  requiredPermissions,
  requireAnyPermission,
  requiredRoles
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

  if (!isAuthenticated) {
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

