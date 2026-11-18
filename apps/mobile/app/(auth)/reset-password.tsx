import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput as RNTextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ResetPasswordRequestSchema } from "@luggage-storage/contracts";
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
import {
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

export default function MobileResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const newPasswordRef = useRef<React.ComponentRef<typeof RNTextInput>>(null);
  const confirmPasswordRef = useRef<React.ComponentRef<typeof RNTextInput>>(null);

  const [token, setToken] = useState(typeof params.token === "string" ? params.token : "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof params.token === "string" && params.token.trim()) {
      setToken(params.token.trim());
    }
  }, [params.token]);

  const handleSubmit = async () => {
    setServerError(null);
    setFieldErrors({});

    const validation = validateWithZod(ResetPasswordRequestSchema, {
      token: token.trim(),
      newPassword,
      confirmPassword
    });
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword(validation.data);
      setIsDone(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError(err instanceof Error ? err.message : "Password reset failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer
      keyboardAvoiding
      header={
        <SafeHeader
          title="Reset Password"
          subtitle="Apply your recovery token"
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"))}
        />
      }
      testID="auth-reset-password-screen"
    >
      {isDone ? (
        <Card variant="elevated" style={styles.card}>
          <View style={styles.statusBanner}>
            <MobileIcon name="check-circle" size="sm" color={mobileStatusTokens.successIcon} />
            <Text style={styles.statusBannerText}>Password Updated</Text>
          </View>
          <MascotIllustration mascot="jump" size="sm" variant="bare" decorative />
          <Text style={styles.heading}>Password Reset Complete</Text>
          <Text style={styles.subtext}>
            All prior sessions were terminated for security. Sign in now with your new password.
          </Text>
          <Button
            title="Sign In Now"
            onPress={() => router.replace("/(auth)/login")}
            fullWidth
          />
        </Card>
      ) : (
        <Card variant="elevated" style={styles.card}>
          <View style={styles.intro}>
            <MascotIllustration mascot="key" size="sm" variant="bare" decorative />
            <Text style={styles.heading}>Choose a New Password</Text>
            <Text style={styles.subtext}>
              Paste the recovery token from your email link (or open the deep link directly).
            </Text>
          </View>

          {serverError ? <ErrorState title="Reset Failed" message={serverError} /> : null}

          <TextInput
            label="Recovery Token"
            required
            leftIcon="key"
            placeholder="Paste reset token"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => newPasswordRef.current?.focus()}
            value={token}
            onChangeText={setToken}
            errorText={fieldErrors.token}
          />

          <TextInput
            ref={newPasswordRef}
            label="New Password"
            required
            leftIcon="lock"
            placeholder="Minimum 8 characters"
            secureTextEntry
            enablePasswordToggle
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            value={newPassword}
            onChangeText={setNewPassword}
            errorText={fieldErrors.newPassword}
          />

          <TextInput
            ref={confirmPasswordRef}
            label="Confirm New Password"
            required
            leftIcon="lock"
            placeholder="Re-enter password"
            secureTextEntry
            enablePasswordToggle
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleSubmit();
            }}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            errorText={fieldErrors.confirmPassword}
          />

          <Button
            title="Reset Password"
            onPress={handleSubmit}
            isLoading={isLoading}
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
    color: mobileTextColors.muted,
    textAlign: "center"
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
