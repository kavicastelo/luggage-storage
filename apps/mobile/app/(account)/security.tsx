import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput as RNTextInput } from "react-native";
import { ChangePasswordRequestSchema } from "@luggage-storage/contracts";
import {
  Button,
  Card,
  ErrorState,
  MobileIcon,
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

export default function MobileSecurityScreen() {
  const newPasswordRef = useRef<React.ComponentRef<typeof RNTextInput>>(null);
  const confirmPasswordRef = useRef<React.ComponentRef<typeof RNTextInput>>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setServerError(null);
    setSuccessMessage(null);
    setFieldErrors({});

    const validation = validateWithZod(ChangePasswordRequestSchema, {
      currentPassword,
      newPassword,
      confirmPassword
    });
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.changePassword(validation.data);
      setSuccessMessage(
        res.message || "Password updated. All other active sessions have been revoked."
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          setServerError("Current password is incorrect.");
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError(err instanceof Error ? err.message : "Network error. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer keyboardAvoiding testID="account-security-screen">
      <Card variant="elevated" style={styles.card}>
        <Text style={styles.title}>Change Password</Text>
        <Text style={styles.subtitle}>
          Updating your password terminates all other active sessions across devices while keeping this device signed in.
        </Text>

        {successMessage ? (
          <View style={styles.successBanner} accessibilityRole="alert">
            <MobileIcon name="check-circle" size={16} color={mobileStatusTokens.successIcon} />
            <Text style={styles.successBannerText}>{successMessage}</Text>
          </View>
        ) : null}

        {serverError ? <ErrorState title="Update Failed" message={serverError} /> : null}

        <TextInput
          label="Current Password"
          required
          leftIcon="lock"
          placeholder="Enter current password"
          secureTextEntry
          enablePasswordToggle
          returnKeyType="next"
          onSubmitEditing={() => newPasswordRef.current?.focus()}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          errorText={fieldErrors.currentPassword}
        />

        <TextInput
          ref={newPasswordRef}
          label="New Password"
          required
          leftIcon="key"
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
          leftIcon="key"
          placeholder="Confirm new password"
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
          title="Update Password"
          onPress={handleSubmit}
          isLoading={isLoading}
          fullWidth
        />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: mobileSpacing[3]
  },
  title: {
    ...mobileTypography.headingLg
  },
  subtitle: {
    ...mobileTypography.bodyMd,
    color: mobileTextColors.muted
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing[2],
    backgroundColor: mobileStatusTokens.successBg,
    borderWidth: 1,
    borderColor: mobileStatusTokens.successBorder,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing[3]
  },
  successBannerText: {
    ...mobileTypography.bodySm,
    color: mobileStatusTokens.success,
    fontWeight: "600",
    flex: 1
  }
});
