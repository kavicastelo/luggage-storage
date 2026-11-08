import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";

export function ForbiddenPage() {
  const location = useLocation();
  const state = location.state as {
    requiredPermission?: string;
    requiredPermissions?: string[];
    requireAnyPermission?: string[];
    requiredRoles?: string[];
  } | null;

  return (
    <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
      <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
        <ShieldAlert className="h-8 w-8" />
      </div>

      <h1 className="text-2xl font-bold text-slate-900">403 — Access Denied</h1>
      <p className="text-sm text-slate-600 mt-2 leading-relaxed">
        You do not have the required permissions or role privileges to view this section of the marketplace.
      </p>

      {state?.requiredPermission && (
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-left">
          <p className="text-xs text-slate-500 font-medium">Missing required permission:</p>
          <code className="text-xs text-red-600 font-mono font-semibold block mt-0.5">
            {state.requiredPermission}
          </code>
        </div>
      )}

      {state?.requiredRoles && (
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-left">
          <p className="text-xs text-slate-500 font-medium">Required system role(s):</p>
          <code className="text-xs text-red-600 font-mono font-semibold block mt-0.5">
            {state.requiredRoles.join(", ")}
          </code>
        </div>
      )}

      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Link
          to="/profile"
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-sm transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>My Profile</span>
        </Link>
        <Link
          to="/"
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition shadow-sm"
        >
          <Home className="h-4 w-4" />
          <span>Home</span>
        </Link>
      </div>
    </div>
  );
}

