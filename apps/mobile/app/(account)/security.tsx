import React, { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { ChangePasswordRequestSchema } from "@luggage-storage/contracts";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  ScreenContainer,
  TextInput
} from "../../src/components";
import { validateWithZod } from "../../src/lib/validation";
import { authApi } from "../../src/services/auth-api";
import { ApiClientError } from "../../src/services/api-client";
import { mobileSpacing, mobileTextColors, mobileTypography } from "../../src/lib/theme";

export default function MobileSecurityScreen() {
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
          <Badge label={successMessage} variant="success" icon="check-circle" />
        ) : null}

        {serverError ? <ErrorState title="Update Failed" message={serverError} /> : null}

        <TextInput
          label="Current Password"
          required
          leftIcon="lock"
          placeholder="Enter current password"
          secureTextEntry
          enablePasswordToggle
          value={currentPassword}
          onChangeText={setCurrentPassword}
          errorText={fieldErrors.currentPassword}
        />

        <TextInput
          label="New Password"
          required
          leftIcon="key"
          placeholder="Minimum 8 characters"
          secureTextEntry
          enablePasswordToggle
          value={newPassword}
          onChangeText={setNewPassword}
          errorText={fieldErrors.newPassword}
        />

        <TextInput
          label="Confirm New Password"
          required
          leftIcon="key"
          placeholder="Confirm new password"
          secureTextEntry
          enablePasswordToggle
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
  }
});
