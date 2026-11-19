import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { RegisterRequestSchema, RegisterResponseData } from "@luggage-storage/contracts";
import { validateWithZod } from "../lib/validation";
import { ApiClientError } from "../lib/api-client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MascotIllustration } from "@/components/ui/MascotIllustration";
import { Eye, EyeOff, Lock, Mail, User, Phone } from "lucide-react";
import { z } from "zod";

const WebRegisterFormSchema = RegisterRequestSchema.extend({
  confirmPassword: z.string().min(1, "Please confirm your password")
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

function formatFriendlyAccountStatus(status: string): string {
  switch (status) {
    case "PENDING_VERIFICATION":
      return "Pending Email Verification";
    case "ACTIVE":
      return "Active";
    default:
      return status.replace(/_/g, " ");
  }
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser, isLoading } = useAuthStore();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [registeredData, setRegisteredData] = useState<RegisterResponseData | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const formData = {
      displayName,
      email,
      password,
      confirmPassword,
      phoneNumber: phoneNumber.trim() ? phoneNumber.trim() : undefined
    };

    const validation = validateWithZod(WebRegisterFormSchema, formData);
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    try {
      const result = await registerUser({
        displayName: validation.data.displayName,
        email: validation.data.email,
        password: validation.data.password,
        phoneNumber: validation.data.phoneNumber
      });
      setRegisteredData(result);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 409) {
          setServerError(
            "An account with this email address already exists. Please sign in instead."
          );
        } else {
          setServerError(err.message || "Failed to create account. Please verify your information.");
        }
      } else {
        setServerError(err instanceof Error ? err.message : "Network error. Please try again.");
      }
    }
  };

  if (registeredData) {
    return (
      <Card className="max-w-md mx-auto my-8 bg-white p-8 shadow-md text-center space-y-5">
        <MascotIllustration mascot="jump" size="md" variant="bare" decorative />
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">Account Created Successfully!</h1>
          <p className="text-sm text-sand-700 mt-2 leading-relaxed">
            Welcome to LuggageStorage,{" "}
            <span className="font-bold text-navy-950">{registeredData.displayName}</span>.
          </p>
        </div>

        <Alert variant="warning" title="Email Verification Required" className="text-left">
          <p className="text-xs leading-relaxed">
            Status:{" "}
            <span className="font-bold">{formatFriendlyAccountStatus(registeredData.status)}</span>.
            We have sent a verification link to{" "}
            <span className="font-semibold">{registeredData.email}</span>. Please verify your email
            address before signing in.
          </p>
        </Alert>

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="primary"
            onClick={() =>
              navigate(`/verify-email?email=${encodeURIComponent(registeredData.email)}`)
            }
            className="w-full"
          >
            Enter Verification Token / Resend Link
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/login")}
            className="w-full"
          >
            Proceed to Sign In
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto my-8 bg-white p-8 shadow-md">
      <div className="text-center mb-6 space-y-2">
        <MascotIllustration mascot="wave" size="sm" variant="bare" decorative />
        <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
          Create your account
        </h1>
        <p className="text-sm text-sand-700">
          Join LuggageStorage to reserve verified bag storage across Sri Lanka
        </p>
      </div>

      {serverError && (
        <Alert variant="danger" className="mb-6">
          {serverError}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-sm font-semibold text-navy-900 mb-1.5" htmlFor="displayName">
            Full name / Display name
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sand-500 pointer-events-none" />
            <input
              id="displayName"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-invalid={Boolean(fieldErrors.displayName)}
              aria-describedby={fieldErrors.displayName ? "reg-name-error" : undefined}
              className={`w-full min-h-[44px] pl-10 pr-4 py-2 border rounded-xl text-sm text-navy-950 bg-white transition focus:outline-none focus:ring-2 ${
                fieldErrors.displayName
                  ? "border-rose-500 focus:ring-rose-500/40"
                  : "border-sand-300 focus:ring-terracotta-500/50 focus:border-terracotta-500"
              }`}
              placeholder="Nimali Perera"
              disabled={isLoading}
            />
          </div>
          {fieldErrors.displayName && (
            <p id="reg-name-error" role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
              {fieldErrors.displayName}
            </p>
          )}
        </div>

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
              aria-describedby={fieldErrors.email ? "reg-email-error" : undefined}
              className={`w-full min-h-[44px] pl-10 pr-4 py-2 border rounded-xl text-sm text-navy-950 bg-white transition focus:outline-none focus:ring-2 ${
                fieldErrors.email
                  ? "border-rose-500 focus:ring-rose-500/40"
                  : "border-sand-300 focus:ring-terracotta-500/50 focus:border-terracotta-500"
              }`}
              placeholder="nimali@example.com"
              disabled={isLoading}
            />
          </div>
          {fieldErrors.email && (
            <p id="reg-email-error" role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-navy-900 mb-1.5" htmlFor="phoneNumber">
            Phone number (optional)
          </label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sand-500 pointer-events-none" />
            <input
              id="phoneNumber"
              type="tel"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              aria-invalid={Boolean(fieldErrors.phoneNumber)}
              aria-describedby={fieldErrors.phoneNumber ? "reg-phone-error" : undefined}
              className={`w-full min-h-[44px] pl-10 pr-4 py-2 border rounded-xl text-sm text-navy-950 bg-white transition focus:outline-none focus:ring-2 ${
                fieldErrors.phoneNumber
                  ? "border-rose-500 focus:ring-rose-500/40"
                  : "border-sand-300 focus:ring-terracotta-500/50 focus:border-terracotta-500"
              }`}
              placeholder="+94 77 123 4567"
              disabled={isLoading}
            />
          </div>
          {fieldErrors.phoneNumber && (
            <p id="reg-phone-error" role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
              {fieldErrors.phoneNumber}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-navy-900 mb-1.5" htmlFor="password">
            Password (min. 8 characters)
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sand-500 pointer-events-none" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "reg-password-error" : undefined}
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
            <p id="reg-password-error" role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <div>
          <label
            className="block text-sm font-semibold text-navy-900 mb-1.5"
            htmlFor="confirmPassword"
          >
            Confirm password
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
              aria-describedby={fieldErrors.confirmPassword ? "reg-confirm-error" : undefined}
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
            <p id="reg-confirm-error" role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        <Button type="submit" variant="primary" isLoading={isLoading} className="w-full mt-2">
          {isLoading ? "Creating account..." : "Create Account"}
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-sand-200 text-center text-sm text-sand-700">
        Already have an account?{" "}
        <Link to="/login" className="font-bold text-terracotta-600 hover:text-terracotta-700">
          Sign in
        </Link>
      </div>
    </Card>
  );
}
