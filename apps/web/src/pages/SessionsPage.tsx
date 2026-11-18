import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { SessionInfo } from "@luggage-storage/contracts";
import { authApi } from "../services/auth-api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { MascotIllustration } from "@/components/ui/MascotIllustration";
import { Modal } from "@/components/ui/Modal";
import {
  Laptop,
  Smartphone,
  Globe,
  Clock,
  Trash2,
  LogOut,
  ArrowLeft
} from "lucide-react";

function formatSessionDeviceLabel(userAgent: string | null | undefined, clientType: string): string {
  if (!userAgent) {
    return clientType === "MOBILE" ? "Mobile Application" : "Web Browser";
  }

  let browser = "Browser";
  if (/Edg\//i.test(userAgent)) browser = "Microsoft Edge";
  else if (/Chrome\//i.test(userAgent) && !/Chromium/i.test(userAgent)) browser = "Chrome";
  else if (/Firefox\//i.test(userAgent)) browser = "Firefox";
  else if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) browser = "Safari";
  else if (/Expo|ReactNative|LuggageStorage/i.test(userAgent)) browser = "LuggageStorage App";

  let os = "";
  if (/iPhone|iPad/i.test(userAgent)) os = "iOS";
  else if (/Android/i.test(userAgent)) os = "Android";
  else if (/Windows/i.test(userAgent)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(userAgent)) os = "macOS";
  else if (/Linux/i.test(userAgent)) os = "Linux";

  return os ? `${browser} on ${os}` : browser;
}

export function SessionsPage() {
  const navigate = useNavigate();
  const { clearAuth, logoutAll, sessionId: currentSessionId } = useAuthStore();

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmLogoutAllOpen, setConfirmLogoutAllOpen] = useState(false);

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
    void fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSession = async (sessionId: string) => {
    setActionLoading(sessionId);
    setError(null);
    setNotice(null);
    try {
      await authApi.revokeSession(sessionId);
      if (sessionId === currentSessionId) {
        clearAuth();
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

  const handleLogoutAllConfirmed = async () => {
    setActionLoading("logout-all");
    setError(null);
    try {
      await logoutAll();
      setConfirmLogoutAllOpen(false);
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign out from all devices");
      setActionLoading(null);
      setConfirmLogoutAllOpen(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      <Link
        to="/profile"
        className="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-semibold text-sand-700 hover:text-navy-950 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to profile</span>
      </Link>

      <Card className="bg-white p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MascotIllustration mascot="key" size="xs" variant="bare" decorative />
            <div>
              <h1 className="text-xl font-extrabold text-navy-950">Active Sessions</h1>
              <p className="text-xs text-sand-700 mt-0.5">
                Devices and browsers currently logged into your account
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={() => setConfirmLogoutAllOpen(true)}
            isLoading={actionLoading === "logout-all"}
            disabled={actionLoading !== null || isLoading || sessions.length === 0}
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out All Devices</span>
          </Button>
        </div>

        {notice && <Alert variant="success">{notice}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}

        {isLoading ? (
          <div className="space-y-3 py-2">
            <LoadingSkeleton className="h-20 w-full" />
            <LoadingSkeleton className="h-20 w-full" />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            mascot="sleeping"
            title="No active sessions found"
            description="Sign in again on any trusted browser or mobile app to establish an authenticated session."
          />
        ) : (
          <div className="divide-y divide-sand-200">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-sand-100 border border-sand-200 rounded-xl text-navy-900 shrink-0 mt-0.5">
                    {session.clientType === "MOBILE" ? (
                      <Smartphone className="h-5 w-5" />
                    ) : (
                      <Laptop className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-navy-950">
                        {formatSessionDeviceLabel(session.userAgent, session.clientType)}
                      </span>
                      {session.isCurrentSession && (
                        <Badge variant="success" size="sm">
                          Current Session
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-sand-700 mt-1 space-y-0.5">
                      <p className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-sand-500" />
                        <span>IP Address: {session.ipAddress || "Unknown"}</span>
                      </p>
                      <p className="flex items-center gap-1.5 text-sand-600">
                        <Clock className="h-3.5 w-3.5 text-sand-500" />
                        <span>
                          Last active: {new Date(session.lastActiveAt).toLocaleString()} • Created:{" "}
                          {new Date(session.createdAt).toLocaleDateString()}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    type="button"
                    variant={session.isCurrentSession ? "danger" : "outline"}
                    size="sm"
                    onClick={() => void handleRevokeSession(session.id)}
                    isLoading={actionLoading === session.id}
                    disabled={actionLoading !== null}
                    className="min-h-[44px]"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{session.isCurrentSession ? "Revoke (Sign Out)" : "Revoke"}</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={confirmLogoutAllOpen}
        onClose={() => setConfirmLogoutAllOpen(false)}
        title="Sign Out All Devices?"
        subtitle="You will be signed out immediately across all browsers and mobile apps."
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmLogoutAllOpen(false)}
              disabled={actionLoading === "logout-all"}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={actionLoading === "logout-all"}
              onClick={() => void handleLogoutAllConfirmed()}
            >
              Confirm Sign Out All
            </Button>
          </>
        }
      >
        <p className="text-sm text-sand-700 leading-relaxed">
          All active sessions tied to your account will be revoked right away. You will need to sign
          in again to manage bookings or custody passes.
        </p>
      </Modal>
    </div>
  );
}
