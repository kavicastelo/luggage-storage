import React from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import {
  User,
  Mail,
  Shield,
  Clock,
  KeyRound,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  XCircle
} from "lucide-react";

export function ProfilePage() {
  const { user, sessionId, permissions } = useAuthStore();

  if (!user) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Active
          </span>
        );
      case "PENDING_VERIFICATION":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" />
            Pending Verification
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <XCircle className="h-3.5 w-3.5" />
            Suspended
          </span>
        );
      case "DEACTIVATED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            <XCircle className="h-3.5 w-3.5" />
            Deactivated
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 border-2 border-blue-200 flex items-center justify-center text-blue-600 font-bold text-2xl">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{user.displayName}</h1>
                {getStatusBadge(user.status)}
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                <Mail className="h-4 w-4" />
                <span>{user.email}</span>
                {user.isEmailVerified ? (
                  <span className="inline-flex items-center gap-0.5 text-xs text-green-600 font-medium">
                    (Verified)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                    (Unverified)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              to="/settings/security"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              <KeyRound className="h-4 w-4" />
              <span>Change Password</span>
            </Link>
            <Link
              to="/settings/sessions"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              <Laptop className="h-4 w-4" />
              <span>Active Sessions</span>
            </Link>
          </div>
        </div>

        {/* Verification Warning Banner if Unverified */}
        {!user.isEmailVerified && (
          <div className="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 leading-relaxed">
              <strong className="font-semibold">Email confirmation pending:</strong> Your email address is not yet verified. Check your inbox for the verification message. While in pending status, publishing luggage storage locations is restricted.
            </div>
          </div>
        )}
      </div>

      {/* Account Details & Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identity Details */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            <span>Account Details</span>
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <dt className="text-slate-500">User ID</dt>
              <dd className="font-mono text-xs text-slate-800 select-all">{user.id}</dd>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <dt className="text-slate-500">Active Session ID</dt>
              <dd className="font-mono text-xs text-slate-800 select-all">{sessionId || "N/A"}</dd>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <dt className="text-slate-500">Phone Verification</dt>
              <dd className="text-slate-800 font-medium">
                {user.isPhoneVerified ? "Verified" : "Not verified"}
              </dd>
            </div>
            <div className="flex justify-between py-1.5">
              <dt className="text-slate-500">Last Login</dt>
              <dd className="text-slate-800 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString()
                    : "Current session"}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Roles Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span>Assigned System Roles</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {user.roles && user.roles.length > 0 ? (
              user.roles.map((role) => (
                <span
                  key={role}
                  className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg"
                >
                  {role}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400">No roles assigned</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-4 leading-normal">
            Roles define your organizational access boundaries. Operational capabilities are derived dynamically from centralized permissions.
          </p>
        </div>
      </div>

      {/* Effective Permissions Matrix */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600" />
              <span>Effective Permissions</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluated in real-time from PostgreSQL role-permission mappings (Total: {permissions.length})
            </p>
          </div>
        </div>

        {permissions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {permissions.map((perm) => (
              <div
                key={perm}
                className="px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                <span className="truncate">{perm}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No permissions assigned to current account.</p>
        )}
      </div>
    </div>
  );
}
