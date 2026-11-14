import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { RegisterRequestSchema } from "@luggage-storage/contracts";
import {
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
import { mobileColors, mobileSpacing, mobileTextColors, mobileTypography } from "../../src/lib/theme";

export default function MobileRegisterScreen() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    setServerError(null);
    setFieldErrors({});

    const validation = validateWithZod(RegisterRequestSchema, {
      displayName: displayName.trim(),
      email: email.trim(),
      password,
      phoneNumber: phoneNumber.trim() || undefined
    });

    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsLoading(true);
    try {
      const created = await authApi.register(validation.data);
      router.replace({
        pathname: "/(auth)/verify-email",
        params: { email: created.email }
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError(err instanceof Error ? err.message : "Registration failed.");
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
          title="Create Account"
          subtitle="Start storing luggage safely in Sri Lanka"
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"))}
        />
      }
      testID="auth-register-screen"
    >
      <Card variant="elevated" style={styles.card}>
        <View style={styles.intro}>
          <MobileIcon name="user" size="xl" variant="primary" />
          <Text style={styles.heading}>Traveller Sign Up</Text>
          <Text style={styles.subtext}>
            Create your account first. You can also upgrade to a verified Host Partner later.
          </Text>
        </View>

        {serverError ? <ErrorState title="Could Not Register" message={serverError} /> : null}

        <TextInput
          label="Full Name"
          required
          leftIcon="user"
          placeholder="Kasun Perera"
          value={displayName}
          onChangeText={setDisplayName}
          errorText={fieldErrors.displayName}
        />

        <TextInput
          label="Email Address"
          required
          leftIcon="mail"
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          errorText={fieldErrors.email}
        />

        <TextInput
          label="Mobile Phone (Optional)"
          leftIcon="phone"
          placeholder="+94 77 123 4567"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          errorText={fieldErrors.phoneNumber}
        />

        <TextInput
          label="Password"
          required
          leftIcon="lock"
          placeholder="Minimum 8 characters"
          secureTextEntry
          enablePasswordToggle
          value={password}
          onChangeText={setPassword}
          errorText={fieldErrors.password}
          helperText="Use at least 8 characters with letters and numbers."
        />

        <Button
          title="Create Account"
          onPress={handleRegister}
          isLoading={isLoading}
          fullWidth
        />

        <Button
          title="Already have an account? Sign In"
          variant="ghost"
          size="sm"
          onPress={() => router.replace("/(auth)/login")}
          textStyle={{ color: mobileColors.terracotta[600] }}
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
    textAlign: "center",
    color: mobileTextColors.muted
  }
});
