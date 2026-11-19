import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ResendVerificationRequestSchema,
  VerifyEmailRequestSchema
} from "@luggage-storage/contracts";
import {
  Button,
  Card,
  ErrorState,
  MascotIllustration,
  MobileIcon,
  SafeHeader,
  ScreenContainer,
  TextInput
} from "../../src/components";
import { validateWithZod } from "../../src/lib/validation";
import { authApi } from "../../src/services/auth-api";
import { ApiClientError } from "../../src/services/api-client";
import { useAuthStore } from "../../src/store/useAuthStore";
import {
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

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
          <View style={styles.successBanner}>
            <MobileIcon name="shield-check" size="sm" color={mobileStatusTokens.successIcon} />
            <Text style={styles.successBannerText}>Verified Account</Text>
          </View>
          <MascotIllustration mascot="jump" size="sm" variant="bare" decorative />
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
              <MascotIllustration mascot="phone" size="sm" variant="bare" decorative />
              <Text style={styles.heading}>Confirm Your Email Address</Text>
              <Text style={styles.subtext}>
                Bookings, password changes, and host registration require a verified email.
              </Text>
            </View>

            {serverError ? <ErrorState message={serverError} /> : null}

            {resendMessage ? (
              <View style={styles.infoBanner}>
                <MobileIcon name="info" size="sm" color={mobileStatusTokens.infoIcon} />
                <Text style={styles.infoBannerText}>{resendMessage}</Text>
              </View>
            ) : null}

            <TextInput
              label="Verification Token"
              required
              leftIcon="key"
              placeholder="Paste verification token from inbox"
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => {
                void handleVerify();
              }}
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
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[2],
    backgroundColor: mobileStatusTokens.successBg,
    borderWidth: 1,
    borderColor: mobileStatusTokens.successBorder,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing[3]
  },
  successBannerText: {
    ...mobileTypography.label,
    color: mobileStatusTokens.success
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing[2],
    backgroundColor: mobileStatusTokens.infoBg,
    borderWidth: 1,
    borderColor: mobileStatusTokens.infoBorder,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing[3]
  },
  infoBannerText: {
    ...mobileTypography.bodySm,
    color: mobileStatusTokens.info,
    fontWeight: "600",
    flex: 1
  }
});

