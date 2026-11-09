export interface DemoPreviewEnvInput {
  PROD?: boolean;
  MODE?: string;
  VITE_ENABLE_DEMO_PREVIEW?: string | boolean;
}

/**
 * Determines whether unauthenticated `?preview=demo` UX inspection mode is permitted (AUD-007).
 * - In production builds (`PROD === true` or `MODE === "production"`), demo preview is
 *   DISABLED by default and only enabled if `VITE_ENABLE_DEMO_PREVIEW` is explicitly `"true"` or `true`.
 * - In development/test builds, demo preview is enabled by default unless
 *   `VITE_ENABLE_DEMO_PREVIEW` is explicitly `"false"` or `"0"`.
 */
export function isDemoPreviewConfigEnabled(envInput?: DemoPreviewEnvInput): boolean {
  const metaEnv = (import.meta as unknown as { env?: DemoPreviewEnvInput }).env ?? {};
  const source = envInput ?? metaEnv;

  const isProduction =
    source.PROD === true ||
    (typeof source.MODE === "string" && source.MODE.trim().toLowerCase() === "production");

  const rawFlag = source.VITE_ENABLE_DEMO_PREVIEW;
  if (typeof rawFlag === "boolean") {
    return rawFlag;
  }
  if (typeof rawFlag === "string") {
    const normalized = rawFlag.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  return !isProduction;
}

/**
 * Evaluates whether a route is currently operating in unauthenticated Demo Preview mode.
 */
export function isDemoPreviewActive(params: {
  allowDemoPreview?: boolean;
  search: string;
  isAuthenticated: boolean;
  envInput?: DemoPreviewEnvInput;
}): boolean {
  if (params.isAuthenticated) {
    return false;
  }
  if (!params.allowDemoPreview) {
    return false;
  }
  if (!isDemoPreviewConfigEnabled(params.envInput)) {
    return false;
  }
  const searchParams = new URLSearchParams(params.search);
  return searchParams.get("preview") === "demo";
}

/**
 * Evaluates whether an authenticated user satisfies required role and permission gates.
 */
export function evaluateRouteAuthorization(params: {
  isAuthenticated: boolean;
  userRoles?: string[];
  userPermissions?: string[];
  requiredRoles?: string[];
  requiredPermission?: string;
  requiredPermissions?: string[];
  requireAnyPermission?: string[];
}): {
  allowed: boolean;
  reason?: "UNAUTHENTICATED" | "FORBIDDEN_ROLE" | "FORBIDDEN_PERMISSION";
} {
  if (!params.isAuthenticated) {
    return { allowed: false, reason: "UNAUTHENTICATED" };
  }

  const perms = new Set(params.userPermissions ?? []);
  const roles = new Set(params.userRoles ?? []);

  if (params.requiredPermission && !perms.has(params.requiredPermission)) {
    return { allowed: false, reason: "FORBIDDEN_PERMISSION" };
  }

  if (
    params.requiredPermissions &&
    params.requiredPermissions.length > 0 &&
    !params.requiredPermissions.every((p) => perms.has(p))
  ) {
    return { allowed: false, reason: "FORBIDDEN_PERMISSION" };
  }

  if (
    params.requireAnyPermission &&
    params.requireAnyPermission.length > 0 &&
    !params.requireAnyPermission.some((p) => perms.has(p))
  ) {
    return { allowed: false, reason: "FORBIDDEN_PERMISSION" };
  }

  if (
    params.requiredRoles &&
    params.requiredRoles.length > 0 &&
    !params.requiredRoles.some((r) => roles.has(r))
  ) {
    return { allowed: false, reason: "FORBIDDEN_ROLE" };
  }

  return { allowed: true };
}
