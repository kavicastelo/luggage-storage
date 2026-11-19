import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ForgotPasswordRequestSchema } from "@luggage-storage/contracts";
import { validateWithZod } from "../lib/validation";
import { authApi } from "../services/auth-api";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MascotIllustration } from "@/components/ui/MascotIllustration";
import { Mail, ArrowLeft } from "lucide-react";

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
      setServerError(
        err instanceof Error ? err.message : "Failed to process request. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="max-w-md mx-auto my-8 bg-white p-8 shadow-md text-center space-y-5">
        <MascotIllustration mascot="phone" size="md" variant="bare" decorative />
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">Check your inbox</h1>
          <p className="text-sm text-sand-700 mt-2 leading-relaxed">
            If an account exists for <span className="font-bold text-navy-950">{email}</span>, you
            will receive an email with instructions to reset your password.
          </p>
          <p className="text-xs text-sand-600 mt-3">
            For security and privacy, we do not confirm whether an account is registered with this
            address.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Link
            to="/reset-password"
            className="min-h-[44px] inline-flex items-center justify-center w-full py-2.5 px-4 bg-terracotta-500 hover:bg-terracotta-600 text-white font-semibold rounded-xl text-sm transition shadow-sm"
          >
            I have a recovery token
          </Link>
          <Link
            to="/login"
            className="min-h-[44px] inline-flex items-center justify-center w-full py-2.5 px-4 bg-sand-100 hover:bg-sand-200 text-navy-900 font-semibold rounded-xl text-sm transition"
          >
            Back to Sign In
          </Link>
        </div>
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
        <h1 className="text-2xl font-extrabold text-navy-950">Forgot your password?</h1>
        <p className="text-sm text-sand-700">
          Enter your registered email address and we will send you a password recovery link
        </p>
      </div>

      {serverError && (
        <Alert variant="danger" className="mb-6">
          {serverError}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
              aria-describedby={fieldErrors.email ? "forgot-email-error" : undefined}
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
            <p
              id="forgot-email-error"
              role="alert"
              className="mt-1.5 text-xs font-medium text-rose-600"
            >
              {fieldErrors.email}
            </p>
          )}
        </div>

        <Button type="submit" variant="primary" isLoading={isLoading} className="w-full">
          {isLoading ? "Sending instructions..." : "Send Reset Instructions"}
        </Button>
      </form>
    </Card>
  );
}
