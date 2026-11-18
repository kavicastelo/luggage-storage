import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ResetPasswordRequestSchema } from "@luggage-storage/contracts";
import { validateWithZod } from "../lib/validation";
import { authApi } from "../services/auth-api";
import { ApiClientError } from "../lib/api-client";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MascotIllustration } from "@/components/ui/MascotIllustration";
import { Lock, KeyRound, Eye, EyeOff, ArrowLeft } from "lucide-react";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get("token") || "";

  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const formData = {
      token: token.trim(),
      newPassword,
      confirmPassword
    };

    const validation = validateWithZod(ResetPasswordRequestSchema, formData);
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword(validation.data);
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 400) {
          setServerError(
            "This password reset link is invalid or has expired. Please request a new one."
          );
        } else {
          setServerError(err.message || "Failed to reset password. Please try again.");
        }
      } else {
        setServerError(err instanceof Error ? err.message : "Network error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="max-w-md mx-auto my-8 bg-white p-8 shadow-md text-center space-y-5">
        <MascotIllustration mascot="jump" size="md" variant="bare" decorative />
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">Password Reset Complete</h1>
          <p className="text-sm text-sand-700 mt-2 leading-relaxed">
            Your password has been changed successfully. All previous active sessions across all
            devices have been revoked for your security.
          </p>
        </div>

        <Button type="button" variant="primary" onClick={() => navigate("/login")} className="w-full">
          Sign In with New Password
        </Button>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto my-8 bg-white p-8 shadow-md">
      <Link
        to="/login"
        className="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-semibold text-sand-700 hover:text-navy-950 mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to sign in</span>
      </Link>

      <div className="text-center mb-6 space-y-2">
        <MascotIllustration mascot="key" size="sm" variant="bare" decorative />
        <h1 className="text-2xl font-extrabold text-navy-950">Reset your password</h1>
        <p className="text-sm text-sand-700">
          Enter your recovery token and choose a new secure password
        </p>
        {initialToken && (
          <div className="pt-1">
            <Badge variant="info" size="md">
              Recovery token detected from link
            </Badge>
          </div>
        )}
      </div>

      {serverError && (
        <Alert variant="danger" className="mb-6">
          {serverError}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-sm font-semibold text-navy-900 mb-1.5" htmlFor="token">
            Recovery Token
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sand-500 pointer-events-none" />
            <input
              id="token"
              type="text"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              aria-invalid={Boolean(fieldErrors.token)}
              aria-describedby={fieldErrors.token ? "reset-token-error" : undefined}
              className={`w-full min-h-[44px] pl-10 pr-4 py-2 border rounded-xl text-sm text-navy-950 bg-white transition focus:outline-none focus:ring-2 ${
                fieldErrors.token
                  ? "border-rose-500 focus:ring-rose-500/40"
                  : "border-sand-300 focus:ring-terracotta-500/50 focus:border-terracotta-500"
              }`}
              placeholder="Paste token from email"
              disabled={isLoading}
            />
          </div>
          {fieldErrors.token && (
            <p
              id="reset-token-error"
              role="alert"
              className="mt-1.5 text-xs font-medium text-rose-600"
            >
              {fieldErrors.token}
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
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.newPassword)}
              aria-describedby={fieldErrors.newPassword ? "reset-newpw-error" : undefined}
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
              onClick={() => setShowPassword(!showPassword)}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-sand-600 hover:text-navy-950 rounded-r-xl transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {fieldErrors.newPassword && (
            <p
              id="reset-newpw-error"
              role="alert"
              className="mt-1.5 text-xs font-medium text-rose-600"
            >
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
              aria-describedby={fieldErrors.confirmPassword ? "reset-confirmpw-error" : undefined}
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
              id="reset-confirmpw-error"
              role="alert"
              className="mt-1.5 text-xs font-medium text-rose-600"
            >
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        <Button type="submit" variant="primary" isLoading={isLoading} className="w-full mt-2">
          {isLoading ? "Updating password..." : "Reset Password"}
        </Button>
      </form>
    </Card>
  );
}
