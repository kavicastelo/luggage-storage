import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { LoginRequestSchema } from "@luggage-storage/contracts";
import { validateWithZod } from "../lib/validation";
import { ApiClientError } from "../lib/api-client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MascotIllustration } from "@/components/ui/MascotIllustration";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const fromLocation = (location.state as {
    from?: { pathname?: string; search?: string; hash?: string };
  })?.from;
  const from = fromLocation
    ? `${fromLocation.pathname || "/profile"}${fromLocation.search || ""}${fromLocation.hash || ""}`
    : "/profile";

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
            setServerError(
              "Your account has been suspended by an administrator. Please contact customer support."
            );
          } else if (err.message.toLowerCase().includes("deactivated")) {
            setServerError(
              "This account has been deactivated. Please contact customer support to reactivate."
            );
          } else {
            setServerError(err.message || "Access denied.");
          }
        } else {
          setServerError(err.message || "An unexpected error occurred during login.");
        }
      } else {
        setServerError(
          err instanceof Error ? err.message : "Failed to connect to authentication service."
        );
      }
    }
  };

  return (
    <Card className="max-w-md mx-auto my-8 bg-white p-8 shadow-md">
      <div className="text-center mb-7 space-y-2">
        <MascotIllustration mascot="wave" size="sm" variant="bare" decorative />
        <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
          Sign in to your account
        </h1>
        <p className="text-sm text-sand-700">
          Access your luggage storage bookings, custody passes, and security settings
        </p>
      </div>

      {serverError && (
        <Alert variant="danger" className="mb-6">
          {serverError}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label className="block text-sm font-semibold text-navy-900 mb-1.5" htmlFor="email">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sand-500 pointer-events-none" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
              className={`w-full min-h-[44px] pl-10 pr-4 py-2 border rounded-xl text-sm text-navy-950 bg-white transition focus:outline-none focus:ring-2 ${
                fieldErrors.email
                  ? "border-rose-500 focus:ring-rose-500/40"
                  : "border-sand-300 focus:ring-terracotta-500/50 focus:border-terracotta-500"
              }`}
              placeholder="you@example.com"
              disabled={isLoading}
            />
          </div>
          {fieldErrors.email && (
            <p id="login-email-error" role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-semibold text-navy-900" htmlFor="password">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-terracotta-600 hover:text-terracotta-700"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sand-500 pointer-events-none" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
              className={`w-full min-h-[44px] pl-10 pr-12 py-2 border rounded-xl text-sm text-navy-950 bg-white transition focus:outline-none focus:ring-2 ${
                fieldErrors.password
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
          {fieldErrors.password && (
            <p
              id="login-password-error"
              role="alert"
              className="mt-1.5 text-xs font-medium text-rose-600"
            >
              {fieldErrors.password}
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          className="w-full"
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-sand-200 text-center text-sm text-sand-700 space-y-2">
        <div>
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-bold text-terracotta-600 hover:text-terracotta-700">
            Create account
          </Link>
        </div>
        <div>
          Need to verify your email?{" "}
          <Link
            to={email ? `/verify-email?email=${encodeURIComponent(email)}` : "/verify-email"}
            className="font-bold text-navy-900 hover:text-terracotta-600 underline"
          >
            Verify email or resend link
          </Link>
        </div>
      </div>
    </Card>
  );
}
