import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { MascotIllustration } from "@/components/ui/MascotIllustration";
import { ArrowLeft, Home } from "lucide-react";

export function ForbiddenPage() {
  const location = useLocation();
  const state = location.state as {
    requiredPermission?: string;
    requiredPermissions?: string[];
    requireAnyPermission?: string[];
    requiredRoles?: string[];
  } | null;

  const hasTechnicalDetails =
    import.meta.env.DEV &&
    Boolean(state?.requiredPermission || (state?.requiredRoles && state.requiredRoles.length > 0));

  return (
    <Card className="max-w-md mx-auto my-12 bg-white p-8 shadow-md text-center space-y-5">
      <MascotIllustration
        mascot="shrug"
        size="lg"
        variant="bare"
        badgeText="Access Restricted"
        decorative
      />

      <div>
        <h1 className="text-2xl font-extrabold text-navy-950">Access Restricted</h1>
        <p className="text-sm text-sand-700 mt-2 leading-relaxed">
          You do not have the required account role or permissions to view this section of the
          marketplace.
        </p>
      </div>

      {hasTechnicalDetails && (
        <details className="text-left rounded-xl border border-sand-200 bg-sand-50 p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-navy-900">
            Technical Details (Developer)
          </summary>
          <div className="mt-2 space-y-2">
            {state?.requiredPermission && (
              <div>
                <p className="text-sand-700 font-medium">Missing required permission:</p>
                <code className="text-rose-700 font-mono font-semibold block mt-0.5">
                  {state.requiredPermission}
                </code>
              </div>
            )}
            {state?.requiredRoles && state.requiredRoles.length > 0 && (
              <div>
                <p className="text-sand-700 font-medium">Required system role(s):</p>
                <code className="text-rose-700 font-mono font-semibold block mt-0.5">
                  {state.requiredRoles.join(", ")}
                </code>
              </div>
            )}
          </div>
        </details>
      )}

      <div className="pt-2 flex flex-col sm:flex-row gap-3">
        <Link
          to="/profile"
          className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-sand-100 hover:bg-sand-200 text-navy-900 font-semibold rounded-xl text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>My Profile</span>
        </Link>
        <Link
          to="/"
          className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-terracotta-500 hover:bg-terracotta-600 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
        >
          <Home className="h-4 w-4" />
          <span>Home</span>
        </Link>
      </div>
    </Card>
  );
}
