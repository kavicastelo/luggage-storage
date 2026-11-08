import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ForgotPasswordRequestSchema } from "@luggage-storage/contracts";
import { validateWithZod } from "../lib/validation";
import { authApi } from "../services/auth-api";
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const validation = validateWithZod(ForgotPasswordRequestSchema, { email });
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsLoading(true);
    try {
      await authApi.forgotPassword(validation.data);
      // Always show generic confirmation response (enumeration defense)
      setIsSubmitted(true);
    } catch (err) {
      // Even if network or API error occurs, only show generic error if not a validation error
      setServerError(err instanceof Error ? err.message : "Failed to process request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="max-w-md mx-auto my-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-6 w-6 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Check your inbox</h1>
        <p className="text-sm text-slate-600 mt-3 leading-relaxed">
          If an account exists for <span className="font-semibold">{email}</span>, you will receive an email with instructions to reset your password.
        </p>
        <p className="text-xs text-slate-400 mt-4">
          For security and privacy, we do not confirm whether an account is registered with this address.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            to="/reset-password"
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition shadow-sm text-center"
          >
            I have a recovery token
          </Link>
          <Link
            to="/login"
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-sm transition text-center"
          >
            Back to Sign In
          </Link>
        </div>
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
        <h1 className="text-2xl font-bold text-slate-900">Forgot your password?</h1>
        <p className="text-sm text-slate-500 mt-2">
          Enter your registered email address and we will send you a password recovery link
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
              placeholder="you@example.com"
              disabled={isLoading}
            />
          </div>
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
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
              <span>Sending instructions...</span>
            </>
          ) : (
            <span>Send Reset Instructions</span>
          )}
        </button>
      </form>
    </div>
  );
}

