import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  VerifyEmailRequestSchema,
  ResendVerificationRequestSchema
} from "@luggage-storage/contracts";
import { validateWithZod } from "../lib/validation";
import { authApi } from "../services/auth-api";
import { useAuthStore } from "../store/useAuthStore";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MascotIllustration } from "@/components/ui/MascotIllustration";
import { Mail, ArrowLeft, KeyRound } from "lucide-react";

export function VerifyEmailPage() {
  const { isAuthenticated, refreshUser } = useAuthStore();
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
      if (useAuthStore.getState().isAuthenticated) {
        await refreshUser();
      }
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
      <Card className="max-w-md mx-auto my-8 bg-white p-8 shadow-md text-center space-y-5">
        <MascotIllustration mascot="jump" size="md" variant="bare" decorative />
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">Email Verified</h1>
          <p className="text-sm text-sand-700 mt-2 leading-relaxed">
            {isAuthenticated
              ? "Your email address has been verified and your account profile is up to date."
              : "Your email address has been verified and your account is now active. You may now sign in."}
          </p>
        </div>
        <Link
          to={isAuthenticated ? "/profile" : "/login"}
          className="min-h-[44px] inline-flex items-center justify-center w-full py-2.5 px-4 bg-terracotta-500 hover:bg-terracotta-600 text-white font-semibold rounded-xl text-sm transition shadow-sm"
        >
          {isAuthenticated ? "Continue to Profile" : "Continue to Sign In"}
        </Link>
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
        <MascotIllustration mascot="phone" size="sm" variant="bare" decorative />
        <h1 className="text-2xl font-extrabold text-navy-950">Verify Your Email</h1>
        <p className="text-sm text-sand-700">
          Enter the verification token sent to your email address or request a new verification link.
        </p>
      </div>

      {serverError && (
        <Alert variant="danger" className="mb-6">
          {serverError}
        </Alert>
      )}

      {resendMessage && (
        <Alert variant="success" className="mb-6">
          {resendMessage}
        </Alert>
      )}

      <form onSubmit={handleVerifySubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-sm font-semibold text-navy-900 mb-1.5" htmlFor="token">
            Verification token
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sand-500 pointer-events-none" />
            <input
              id="token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              aria-invalid={Boolean(fieldErrors.token)}
              aria-describedby={fieldErrors.token ? "verify-token-error" : undefined}
              className={`w-full min-h-[44px] pl-10 pr-4 py-2 border rounded-xl text-sm text-navy-950 bg-white transition focus:outline-none focus:ring-2 ${
                fieldErrors.token
                  ? "border-rose-500 focus:ring-rose-500/40"
                  : "border-sand-300 focus:ring-terracotta-500/50 focus:border-terracotta-500"
              }`}
              placeholder="Paste verification token from email"
              disabled={isVerifying}
            />
          </div>
          {fieldErrors.token && (
            <p
              id="verify-token-error"
              role="alert"
              className="mt-1.5 text-xs font-medium text-rose-600"
            >
              {fieldErrors.token}
            </p>
          )}
        </div>

        <Button type="submit" variant="primary" isLoading={isVerifying} className="w-full">
          {isVerifying ? "Verifying email..." : "Verify Email Address"}
        </Button>
      </form>

      <div className="my-6 border-t border-sand-200 pt-6">
        <h2 className="text-sm font-bold text-navy-950 mb-3">
          Need a new verification link?
        </h2>
        <form onSubmit={handleResendSubmit} className="space-y-3" noValidate>
          <div>
            <label
              htmlFor="resend-email"
              className="block text-xs font-semibold text-navy-900 mb-1.5"
            >
              Account email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sand-500 pointer-events-none" />
              <input
                id="resend-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "resend-email-error" : undefined}
                className={`w-full min-h-[44px] pl-10 pr-4 py-2 border rounded-xl text-sm text-navy-950 bg-white transition focus:outline-none focus:ring-2 ${
                  fieldErrors.email
                    ? "border-rose-500 focus:ring-rose-500/40"
                    : "border-sand-300 focus:ring-terracotta-500/50 focus:border-terracotta-500"
                }`}
                placeholder="you@example.com"
                disabled={isResending}
              />
            </div>
            {fieldErrors.email && (
              <p
                id="resend-email-error"
                role="alert"
                className="mt-1.5 text-xs font-medium text-rose-600"
              >
                {fieldErrors.email}
              </p>
            )}
          </div>
          <Button type="submit" variant="outline" isLoading={isResending} className="w-full">
            {isResending ? "Sending new link..." : "Resend Verification Email"}
          </Button>
        </form>
      </div>
    </Card>
  );
}
