import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ResetPasswordRequestSchema } from "@luggage-storage/contracts";
import { validateWithZod } from "../lib/validation";
import { authApi } from "../services/auth-api";
import { ApiClientError } from "../lib/api-client";
import { Lock, KeyRound, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";

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
          setServerError("This password reset link is invalid or has expired. Please request a new one.");
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
      <div className="max-w-md mx-auto my-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Password Reset Complete</h1>
        <p className="text-sm text-slate-600 mt-3 leading-relaxed">
          Your password has been changed successfully. All previous active sessions across all devices have been revoked for your security.
        </p>

        <button
          onClick={() => navigate("/login")}
          className="w-full mt-6 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition shadow-sm"
        >
          Sign In with New Password
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto my-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 mb-6 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to sign in</span>
      </Link>

      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
        <p className="text-sm text-slate-500 mt-2">
          Enter your recovery token and choose a new secure password
        </p>
      </div>

      {serverError && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{serverError}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="token">
            Recovery Token
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              id="token"
              type="text"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm transition focus:outline-none focus:ring-2 ${
                fieldErrors.token
                  ? "border-red-300 focus:ring-red-400"
                  : "border-slate-300 focus:ring-blue-500 focus:border-blue-500"
              }`}
              placeholder="Paste token from email"
              disabled={isLoading}
            />
          </div>
          {fieldErrors.token && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.token}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="newPassword">
            New Password (min. 8 characters)
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              id="newPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`w-full pl-10 pr-10 py-2 border rounded-lg text-sm transition focus:outline-none focus:ring-2 ${
                fieldErrors.newPassword
                  ? "border-red-300 focus:ring-red-400"
                  : "border-slate-300 focus:ring-blue-500 focus:border-blue-500"
              }`}
              placeholder="••••••••"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {fieldErrors.newPassword && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.newPassword}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="confirmPassword">
            Confirm New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full pl-10 pr-10 py-2 border rounded-lg text-sm transition focus:outline-none focus:ring-2 ${
                fieldErrors.confirmPassword
                  ? "border-red-300 focus:ring-red-400"
                  : "border-slate-300 focus:ring-blue-500 focus:border-blue-500"
              }`}
              placeholder="••••••••"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Updating password...</span>
            </>
          ) : (
            <span>Reset Password</span>
          )}
        </button>
      </form>
    </div>
  );
}

