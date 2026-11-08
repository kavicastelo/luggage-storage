import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { LoginRequestSchema } from "@luggage-storage/contracts";
import { validateWithZod } from "../lib/validation";
import { ApiClientError } from "../lib/api-client";
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader2 } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/profile";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const validation = validateWithZod(LoginRequestSchema, { email, password });
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    try {
      await login(validation.data);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          setServerError("Invalid email or password. Please try again.");
        } else if (err.statusCode === 403) {
          if (err.message.toLowerCase().includes("suspended")) {
            setServerError("Your account has been suspended by an administrator. Please contact customer support.");
          } else if (err.message.toLowerCase().includes("deactivated")) {
            setServerError("This account has been deactivated. Please contact customer support to reactivate.");
          } else {
            setServerError(err.message || "Access denied.");
          }
        } else {
          setServerError(err.message || "An unexpected error occurred during login.");
        }
      } else {
        setServerError(err instanceof Error ? err.message : "Failed to connect to authentication service.");
      }
    }
  };

  return (
    <div className="max-w-md mx-auto my-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Sign in to your account</h1>
        <p className="text-sm text-slate-500 mt-2">
          Access your luggage storage bookings, profile, and security settings
        </p>
      </div>

      {serverError && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{serverError}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="email">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm transition focus:outline-none focus:ring-2 ${fieldErrors.email
                  ? "border-red-300 focus:ring-red-400"
                  : "border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                }`}
              placeholder="you@example.com"
              disabled={isLoading}
            />
          </div>
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full pl-10 pr-10 py-2 border rounded-lg text-sm transition focus:outline-none focus:ring-2 ${fieldErrors.password
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
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-500 space-y-2">
        <div>
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700">
            Create account
          </Link>
        </div>
        <div>
          Need to verify your email?{" "}
          <Link
            to={email ? `/verify-email?email=${encodeURIComponent(email)}` : "/verify-email"}
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            Verify email or resend link
          </Link>
        </div>
      </div>
    </div>
  );
}

