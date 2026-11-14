import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ResendVerificationRequestSchema,
  VerifyEmailRequestSchema
} from "@luggage-storage/contracts";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  MobileIcon,
  SafeHeader,
  ScreenContainer,
  TextInput
} from "../../src/components";
import { validateWithZod } from "../../src/lib/validation";
import { authApi } from "../../src/services/auth-api";
import { ApiClientError } from "../../src/services/api-client";
import { useAuthStore } from "../../src/store/useAuthStore";
import { mobileSpacing, mobileTextColors, mobileTypography } from "../../src/lib/theme";

export default function MobileVerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const { user, isAuthenticated, initAuth } = useAuthStore();

  const [token, setToken] = useState(typeof params.token === "string" ? params.token : "");
  const [resendEmail, setResendEmail] = useState(
    typeof params.email === "string" ? params.email : user?.email ?? ""
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [verifiedMessage, setVerifiedMessage] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (typeof params.token === "string" && params.token.trim()) {
      setToken(params.token.trim());
    }
    if (typeof params.email === "string" && params.email.trim()) {
      setResendEmail(params.email.trim());
    }
  }, [params.token, params.email]);

  const handleVerify = async () => {
    setServerError(null);
    setResendMessage(null);
    setFieldErrors({});

    const validation = validateWithZod(VerifyEmailRequestSchema, { token: token.trim() });
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsVerifying(true);
    try {
      const res = await authApi.verifyEmail(validation.data);
      setVerifiedMessage(res.message || "Email address verified successfully.");
      if (isAuthenticated) {
        await initAuth();
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError(err instanceof Error ? err.message : "Email verification failed.");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setServerError(null);
    setResendMessage(null);
    setFieldErrors({});

    const validation = validateWithZod(ResendVerificationRequestSchema, {
      email: resendEmail.trim()
    });
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsResending(true);
    try {
      const res = await authApi.resendVerification(validation.data);
      setResendMessage(
        res.message || "If eligible, a fresh verification email has been sent."
      );
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError(err instanceof Error ? err.message : "Unable to resend email.");
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <ScreenContainer
      keyboardAvoiding
      header={
        <SafeHeader
          title="Verify Email"
          subtitle="Unlock bookings & host onboarding"
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        />
      }
      testID="auth-verify-email-screen"
    >
      {verifiedMessage ? (
        <Card variant="elevated" style={styles.card}>
          <Badge label="Verified Account" variant="success" icon="shield-check" />
          <Text style={styles.heading}>Email Verified</Text>
          <Text style={styles.subtext}>{verifiedMessage}</Text>
          <Button
            title={isAuthenticated ? "Continue to Marketplace" : "Sign In"}
            onPress={() => router.replace(isAuthenticated ? "/(traveller)" : "/(auth)/login")}
            fullWidth
          />
        </Card>
      ) : (
        <>
          <Card variant="elevated" style={styles.card}>
            <View style={styles.intro}>
              <MobileIcon name="mail" size="xl" variant="primary" />
              <Text style={styles.heading}>Confirm Your Email Address</Text>
              <Text style={styles.subtext}>
                Bookings, password changes, and host registration require a verified email.
              </Text>
            </View>

            {serverError ? <ErrorState message={serverError} /> : null}

            {resendMessage ? (
              <Badge label={resendMessage} variant="info" icon="info" />
            ) : null}

            <TextInput
              label="Verification Token"
              required
              leftIcon="key"
              placeholder="Paste verification token from inbox"
              autoCapitalize="none"
              value={token}
              onChangeText={setToken}
              errorText={fieldErrors.token}
            />

            <Button
              title="Verify Email"
              onPress={handleVerify}
              isLoading={isVerifying}
              fullWidth
            />
          </Card>

          <Card variant="default" style={styles.resendCard}>
            <Text style={styles.resendHeading}>Didn&apos;t receive the email?</Text>
            <TextInput
              label="Account Email"
              leftIcon="mail"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={resendEmail}
              onChangeText={setResendEmail}
              errorText={fieldErrors.email}
            />
            <Button
              title="Resend Verification Email"
              variant="outline"
              onPress={handleResend}
              isLoading={isResending}
              fullWidth
            />
          </Card>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: mobileSpacing[3],
    marginBottom: mobileSpacing[4]
  },
  resendCard: {
    gap: mobileSpacing[3]
  },
  intro: {
    alignItems: "center",
    gap: mobileSpacing[1],
    marginBottom: mobileSpacing[2]
  },
  heading: {
    ...mobileTypography.headingLg,
    textAlign: "center"
  },
  subtext: {
    ...mobileTypography.bodyMd,
    color: mobileTextColors.muted,
    textAlign: "center"
  },
  resendHeading: {
    ...mobileTypography.headingSm
  }
});

