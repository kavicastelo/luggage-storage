import React from "react";
import { useAuthStore } from "../../store/useAuthStore";

export interface PermissionGateProps {
  permission?: string;
  anyPermission?: string[];
  allPermissions?: string[];
  role?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({
  permission,
  anyPermission,
  allPermissions,
  role,
  fallback = null,
  children
}: PermissionGateProps) {
  const { user, hasPermission, hasAnyPermission, hasAllPermissions } = useAuthStore();

  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  if (anyPermission && anyPermission.length > 0 && !hasAnyPermission(anyPermission)) {
    return <>{fallback}</>;
  }

  if (allPermissions && allPermissions.length > 0 && !hasAllPermissions(allPermissions)) {
    return <>{fallback}</>;
  }

  if (role && !user?.roles?.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

