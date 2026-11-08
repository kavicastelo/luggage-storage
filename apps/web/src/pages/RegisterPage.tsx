import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { RegisterRequestSchema, RegisterResponseData } from "@luggage-storage/contracts";
import { validateWithZod } from "../lib/validation";
import { ApiClientError } from "../lib/api-client";
import { Eye, EyeOff, Lock, Mail, User, Phone, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { z } from "zod";

// Extended form validation schema to require confirmPassword matching
const WebRegisterFormSchema = RegisterRequestSchema.extend({
  confirmPassword: z.string().min(1, "Please confirm your password")
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

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
      // Strictly omit any role field so the backend assigns the default TRAVELLER role
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
          setServerError("An account with this email address already exists. Please sign in instead.");
        } else {
          setServerError(err.message || "Failed to create account. Please verify your information.");
        }
      } else {
        setServerError(err instanceof Error ? err.message : "Network error. Please try again.");
      }
    }
  };

  // If successfully registered, show clear pending verification status message
  if (registeredData) {
    return (
      <div className="max-w-md mx-auto my-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Account Created Successfully!</h1>
        <p className="text-sm text-slate-600 mt-3 leading-relaxed">
          Welcome to LuggageStorage, <span className="font-semibold">{registeredData.displayName}</span>.
        </p>

        <div className="my-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-left">
          <h2 className="text-xs font-bold uppercase tracking-wider text-amber-800">
            Email Verification Required
          </h2>
          <p className="text-xs text-amber-700 mt-1 leading-normal">
            Account status: <span className="font-semibold">{registeredData.status}</span>. We have sent a verification link to{" "}
            <span className="font-semibold">{registeredData.email}</span>. Please verify your email address before signing in.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() =>
              navigate(`/verify-email?email=${encodeURIComponent(registeredData.email)}`)
            }
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition shadow-sm"
          >
            Enter Verification Token / Resend Link
          </button>
          <button
            onClick={() => navigate("/login")}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-sm transition"
          >
            Proceed to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto my-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="text-sm text-slate-500 mt-2">
          Join LuggageStorage as a traveller to store bags securely worldwide
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
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="displayName">
            Full name / Display name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              id="displayName"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm transition focus:outline-none focus:ring-2 ${
                fieldErrors.displayName
                  ? "border-red-300 focus:ring-red-400"
                  : "border-slate-300 focus:ring-blue-500 focus:border-blue-500"
              }`}
              placeholder="Alex Smith"
              disabled={isLoading}
            />
          </div>
          {fieldErrors.displayName && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.displayName}</p>
          )}
        </div>

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
              className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm transition focus:outline-none focus:ring-2 ${
                fieldErrors.email
                  ? "border-red-300 focus:ring-red-400"
                  : "border-slate-300 focus:ring-blue-500 focus:border-blue-500"
              }`}
              placeholder="alex@example.com"
              disabled={isLoading}
            />
          </div>
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="phoneNumber">
            Phone number (optional)
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              id="phoneNumber"
              type="tel"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm transition focus:outline-none focus:ring-2 ${
                fieldErrors.phoneNumber
                  ? "border-red-300 focus:ring-red-400"
                  : "border-slate-300 focus:ring-blue-500 focus:border-blue-500"
              }`}
              placeholder="+1 (555) 000-0000"
              disabled={isLoading}
            />
          </div>
          {fieldErrors.phoneNumber && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.phoneNumber}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="password">
            Password (min. 8 characters)
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full pl-10 pr-10 py-2 border rounded-lg text-sm transition focus:outline-none focus:ring-2 ${
                fieldErrors.password
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

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="confirmPassword">
            Confirm password
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
              <span>Creating account...</span>
            </>
          ) : (
            <span>Create Account</span>
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700">
          Sign in
        </Link>
      </div>
    </div>
  );
}

