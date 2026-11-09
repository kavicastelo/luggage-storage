import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  VerifyEmailRequestSchema,
  ResendVerificationRequestSchema
} from "@luggage-storage/contracts";
import { validateWithZod } from "../lib/validation";
import { authApi } from "../services/auth-api";
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowLeft, KeyRound } from "lucide-react";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get("token") || "";
  const initialEmail = searchParams.get("email") || "";

  const [token, setToken] = useState(initialToken);
  const [email, setEmail] = useState(initialEmail);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const hasRequestedRef = React.useRef(false);

  useEffect(() => {
    if (initialToken && !hasRequestedRef.current) {
      hasRequestedRef.current = true;
      void executeVerify(initialToken);
    }
  }, [initialToken]);

  const executeVerify = async (tokenValue: string) => {
    setServerError(null);
    setFieldErrors({});

    const validation = validateWithZod(VerifyEmailRequestSchema, { token: tokenValue });
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsVerifying(true);
    try {
      await authApi.verifyEmail(validation.data);
      setIsVerified(true);
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : "Invalid or expired email verification token."
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeVerify(token);
  };

  const handleResendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setResendMessage(null);
    setFieldErrors({});

    const validation = validateWithZod(ResendVerificationRequestSchema, { email });
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsResending(true);
    try {
      const res = await authApi.resendVerification(validation.data);
      setResendMessage(res.message);
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : "Failed to resend verification email. Please try again."
      );
    } finally {
      setIsResending(false);
    }
  };

  if (isVerified) {
    return (
      <div className="max-w-md mx-auto my-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Email Verified</h1>
        <p className="text-sm text-slate-600 mt-3 leading-relaxed">
          Your email address has been verified and your account is now active. You may now sign in.
        </p>
        <div className="mt-8">
          <Link
            to="/login"
            className="inline-block w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition shadow-sm text-center"
          >
            Continue to Sign In
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
        <h1 className="text-2xl font-bold text-slate-900">Verify Your Email</h1>
        <p className="text-sm text-slate-500 mt-2">
          Enter the verification token sent to your email address or request a new verification link.
        </p>
      </div>

      {serverError && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{serverError}</div>
        </div>
      )}

      {resendMessage && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-800">{resendMessage}</div>
        </div>
      )}

      <form onSubmit={handleVerifySubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="token">
            Verification token
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              id="token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm transition focus:outline-none focus:ring-2 ${
                fieldErrors.token
                  ? "border-red-300 focus:ring-red-400"
                  : "border-slate-300 focus:ring-blue-500 focus:border-blue-500"
              }`}
              placeholder="Paste verification token from email"
              disabled={isVerifying}
            />
          </div>
          {fieldErrors.token && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.token}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isVerifying}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-sm"
        >
          {isVerifying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verifying email...</span>
            </>
          ) : (
            <span>Verify Email Address</span>
          )}
        </button>
      </form>

      <div className="my-6 border-t border-slate-200 pt-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-2">
          Need a new verification link?
        </h2>
        <form onSubmit={handleResendSubmit} className="space-y-3" noValidate>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              id="resend-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
              disabled={isResending}
            />
          </div>
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
          )}
          <button
            type="submit"
            disabled={isResending}
            className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-sm transition flex items-center justify-center gap-2"
          >
            {isResending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sending new link...</span>
              </>
            ) : (
              <span>Resend Verification Email</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

