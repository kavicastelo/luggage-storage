import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { SessionInfo } from "@luggage-storage/contracts";
import { authApi } from "../services/auth-api";
import {
  Laptop,
  Smartphone,
  Globe,
  Clock,
  Trash2,
  LogOut,
  AlertCircle,
  Loader2,
  ArrowLeft,
  CheckCircle2
} from "lucide-react";

export function SessionsPage() {
  const navigate = useNavigate();
  const { logout, logoutAll, sessionId: currentSessionId } = useAuthStore();

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authApi.getSessions();
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load active sessions");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSession = async (sessionId: string) => {
    setActionLoading(sessionId);
    setError(null);
    setNotice(null);
    try {
      await authApi.revokeSession(sessionId);
      if (sessionId === currentSessionId) {
        // Current session revoked -> clear state and redirect to login
        await logout();
        navigate("/login", { replace: true });
        return;
      }
      setNotice("Session successfully revoked.");
      await fetchSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke session");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm("Are you sure you want to sign out from all devices? You will be signed out immediately.")) {
      return;
    }
    setActionLoading("logout-all");
    setError(null);
    try {
      await logoutAll();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign out from all devices");
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        to="/profile"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to profile</span>
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Laptop className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Active Sessions</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Devices and browsers currently logged into your account
              </p>
            </div>
          </div>

          <button
            onClick={handleLogoutAll}
            disabled={actionLoading !== null || isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
          >
            {actionLoading === "logout-all" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
            <span>Sign Out All Devices</span>
          </button>
        </div>

        {notice && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div className="text-sm text-green-700">{notice}</div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-blue-600 mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading active sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No active sessions found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-600 shrink-0 mt-1">
                    {session.clientType === "MOBILE" ? (
                      <Smartphone className="h-5 w-5" />
                    ) : (
                      <Laptop className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">
                        {session.clientType === "MOBILE" ? "Mobile Application" : "Web Browser"}
                      </span>
                      {session.isCurrentSession && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          Current Session
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                      <p className="flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5" />
                        <span>IP Address: {session.ipAddress || "Unknown"}</span>
                      </p>
                      <p className="truncate max-w-md font-mono text-[11px] text-slate-400">
                        {session.userAgent || "Unknown user-agent"}
                      </p>
                      <p className="flex items-center gap-1 text-slate-400">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          Last active: {new Date(session.lastActiveAt).toLocaleString()} • Created:{" "}
                          {new Date(session.createdAt).toLocaleDateString()}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={actionLoading !== null}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                      session.isCurrentSession
                        ? "border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                        : "border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                    } disabled:opacity-50`}
                  >
                    {actionLoading === session.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    <span>{session.isCurrentSession ? "Revoke (Sign Out)" : "Revoke"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

