import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ForgotPasswordRequestSchema } from "@luggage-storage/contracts";
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
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

export default function MobileForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setServerError(null);
    setFieldErrors({});

    const validation = validateWithZod(ForgotPasswordRequestSchema, { email: email.trim() });
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsLoading(true);
    try {
      await authApi.forgotPassword(validation.data);
      setIsSubmitted(true);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Request failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer
      keyboardAvoiding
      header={
        <SafeHeader
          title="Password Recovery"
          subtitle="Request reset instructions"
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"))}
        />
      }
      testID="auth-forgot-password-screen"
    >
      {isSubmitted ? (
        <Card variant="elevated" style={styles.card}>
          <View style={styles.statusBanner}>
            <MobileIcon name="check-circle" size="sm" color={mobileStatusTokens.successIcon} />
            <Text style={styles.statusBannerText}>Reset instructions dispatched</Text>
          </View>
          <MascotIllustration mascot="phone" size="sm" variant="bare" decorative />
          <Text style={styles.heading}>Check Your Inbox</Text>
          <Text style={styles.subtext}>
            If an account is associated with{" "}
            <Text style={styles.boldEmail}>{email.trim()}</Text>, password reset instructions
            have been dispatched.
          </Text>
          <View style={styles.noteBox}>
            <MobileIcon name="shield" size="sm" color={mobileColors.navy[700]} />
            <Text style={styles.noteText}>
              For account security, we never disclose whether a specific email is registered.
            </Text>
          </View>
          <Button
            title="Enter Recovery Token"
            onPress={() => router.push("/(auth)/reset-password")}
            fullWidth
          />
          <Button
            title="Back to Sign In"
            variant="outline"
            onPress={() => router.replace("/(auth)/login")}
            fullWidth
          />
        </Card>
      ) : (
        <Card variant="elevated" style={styles.card}>
          <View style={styles.intro}>
            <MascotIllustration mascot="key" size="sm" variant="bare" decorative />
            <Text style={styles.heading}>Forgot Password?</Text>
            <Text style={styles.subtext}>
              Enter your registered email address to receive a single-use password reset token.
            </Text>
          </View>

          {serverError ? <ErrorState message={serverError} /> : null}

          <TextInput
            label="Registered Email"
            required
            leftIcon="mail"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleSubmit();
            }}
            value={email}
            onChangeText={setEmail}
            errorText={fieldErrors.email}
          />

          <Button
            title="Send Reset Instructions"
            onPress={handleSubmit}
            isLoading={isLoading}
            fullWidth
          />

          <Button
            title="I already have a recovery token"
            variant="ghost"
            size="sm"
            onPress={() => router.push("/(auth)/reset-password")}
            fullWidth
          />
        </Card>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: mobileSpacing[3]
  },
  intro: {
    alignItems: "center",
    gap: mobileSpacing[1],
    marginBottom: mobileSpacing[2]
  },
  heading: {
    ...mobileTypography.headingLg
  },
  subtext: {
    ...mobileTypography.bodyMd,
    color: mobileTextColors.muted
  },
  boldEmail: {
    fontWeight: "700",
    color: mobileColors.navy[950]
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing[2],
    backgroundColor: mobileColors.sand[100],
    borderRadius: 12,
    padding: mobileSpacing[3]
  },
  noteText: {
    ...mobileTypography.bodySm,
    flex: 1
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[2],
    backgroundColor: mobileStatusTokens.successBg,
    borderWidth: 1,
    borderColor: mobileStatusTokens.successBorder,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing[3]
  },
  statusBannerText: {
    ...mobileTypography.label,
    color: mobileStatusTokens.success
  }
});
