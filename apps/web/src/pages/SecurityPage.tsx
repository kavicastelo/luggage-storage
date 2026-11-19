import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChangePasswordRequestSchema } from "@luggage-storage/contracts";
import { validateWithZod } from "../lib/validation";
import { authApi } from "../services/auth-api";
import { ApiClientError } from "../lib/api-client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MascotIllustration } from "@/components/ui/MascotIllustration";
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft
} from "lucide-react";

export function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);
    setFieldErrors({});

    const formData = {
      currentPassword,
      newPassword,
      confirmPassword
    };

    const validation = validateWithZod(ChangePasswordRequestSchema, formData);
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.changePassword(validation.data);
      setSuccessMessage(
        res.message ||
          "Password updated successfully. All other active sessions across devices have been revoked."
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          setServerError("Current password is incorrect.");
        } else {
          setServerError(err.message || "Failed to update password. Please check requirements.");
        }
      } else {
        setServerError(err instanceof Error ? err.message : "Network error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <Link
        to="/profile"
        className="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-semibold text-sand-700 hover:text-navy-950 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to profile</span>
      </Link>

      <Card className="bg-white p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-terracotta-50 text-terracotta-600 rounded-xl border border-terracotta-200">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-navy-950">Security &amp; Credentials</h1>
              <p className="text-xs text-sand-700 mt-0.5">
                Manage your password and active authentication credentials
              </p>
            </div>
          </div>
          <MascotIllustration mascot="key" size="xs" variant="bare" decorative />
        </div>

        <Alert variant="info" title="Automatic Session Invalidation">
          Changing your password will immediately revoke all active sessions on other browsers,
          mobile devices, and applications. Your current session will remain active.
        </Alert>

        {successMessage && <Alert variant="success">{successMessage}</Alert>}
        {serverError && <Alert variant="danger">{serverError}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              className="block text-sm font-semibold text-navy-900 mb-1.5"
              htmlFor="currentPassword"
            >
              Current Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sand-500 pointer-events-none" />
              <input
                id="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                aria-invalid={Boolean(fieldErrors.currentPassword)}
                aria-describedby={fieldErrors.currentPassword ? "sec-curr-error" : undefined}
                className={`w-full min-h-[44px] pl-10 pr-12 py-2 border rounded-xl text-sm text-navy-950 bg-white transition focus:outline-none focus:ring-2 ${
                  fieldErrors.currentPassword
                    ? "border-rose-500 focus:ring-rose-500/40"
                    : "border-sand-300 focus:ring-terracotta-500/50 focus:border-terracotta-500"
                }`}
                placeholder="••••••••"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-sand-600 hover:text-navy-950 rounded-r-xl transition-colors"
                aria-label={showCurrentPassword ? "Hide password" : "Show password"}
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.currentPassword && (
              <p id="sec-curr-error" role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
                {fieldErrors.currentPassword}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy-900 mb-1.5" htmlFor="newPassword">
              New Password (min. 8 characters)
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sand-500 pointer-events-none" />
              <input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                aria-invalid={Boolean(fieldErrors.newPassword)}
                aria-describedby={fieldErrors.newPassword ? "sec-new-error" : undefined}
                className={`w-full min-h-[44px] pl-10 pr-12 py-2 border rounded-xl text-sm text-navy-950 bg-white transition focus:outline-none focus:ring-2 ${
                  fieldErrors.newPassword
                    ? "border-rose-500 focus:ring-rose-500/40"
                    : "border-sand-300 focus:ring-terracotta-500/50 focus:border-terracotta-500"
                }`}
                placeholder="••••••••"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-sand-600 hover:text-navy-950 rounded-r-xl transition-colors"
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.newPassword && (
              <p id="sec-new-error" role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
                {fieldErrors.newPassword}
              </p>
            )}
          </div>

          <div>
            <label
              className="block text-sm font-semibold text-navy-900 mb-1.5"
              htmlFor="confirmPassword"
            >
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sand-500 pointer-events-none" />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                aria-describedby={fieldErrors.confirmPassword ? "sec-confirm-error" : undefined}
                className={`w-full min-h-[44px] pl-10 pr-12 py-2 border rounded-xl text-sm text-navy-950 bg-white transition focus:outline-none focus:ring-2 ${
                  fieldErrors.confirmPassword
                    ? "border-rose-500 focus:ring-rose-500/40"
                    : "border-sand-300 focus:ring-terracotta-500/50 focus:border-terracotta-500"
                }`}
                placeholder="••••••••"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-sand-600 hover:text-navy-950 rounded-r-xl transition-colors"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p
                id="sec-confirm-error"
                role="alert"
                className="mt-1.5 text-xs font-medium text-rose-600"
              >
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          <div className="pt-2">
            <Button type="submit" variant="primary" isLoading={isLoading}>
              {isLoading ? "Updating password..." : "Update Password"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
