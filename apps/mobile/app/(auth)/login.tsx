import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LoginRequestSchema } from "@luggage-storage/contracts";
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
import { useAuthStore } from "../../src/store/useAuthStore";
import {
  mobileColors,
  mobileSpacing,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

export default function MobileLoginScreen() {
  const router = useRouter();
  const { redirectTo } = useLocalSearchParams<{ redirectTo?: string }>();
  const { login, isLoading, error, setError } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleLogin = async () => {
    setError(null);
    setFieldErrors({});

    const validation = validateWithZod(LoginRequestSchema, {
      email: email.trim(),
      password
    });
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    try {
      await login({
        email: validation.data.email,
        password: validation.data.password
      });
      if (redirectTo && redirectTo.startsWith("/")) {
        router.replace(redirectTo as "/(traveller)");
      } else {
        router.replace("/");
      }
    } catch {
      // Store populates error banner
    }
  };

  return (
    <ScreenContainer
      keyboardAvoiding
      header={
        <SafeHeader
          title="Sign In"
          subtitle="Access bookings, passes & host tools"
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        />
      }
      testID="auth-login-screen"
    >
      <Card variant="elevated" style={styles.card}>
        <View style={styles.intro}>
          <MobileIcon name="shield-check" size="xl" variant="primary" />
          <Text style={styles.heading}>Welcome Back</Text>
          <Text style={styles.subtext}>
            Sign in with your verified Luggage Storage email and password.
          </Text>
        </View>

        {error ? <ErrorState title="Sign In Failed" message={error} /> : null}

        <TextInput
          label="Email Address"
          required
          leftIcon="mail"
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={(val) => {
            setEmail(val);
            if (error) setError(null);
          }}
          errorText={fieldErrors.email}
          testID="login-email-input"
        />

        <TextInput
          label="Password"
          required
          leftIcon="lock"
          placeholder="Enter your password"
          secureTextEntry
          enablePasswordToggle
          autoComplete="password"
          value={password}
          onChangeText={(val) => {
            setPassword(val);
            if (error) setError(null);
          }}
          errorText={fieldErrors.password}
          testID="login-password-input"
        />

        <TouchableOpacity
          onPress={() => router.push("/(auth)/forgot-password")}
          style={styles.forgotLinkWrap}
          accessibilityRole="link"
        >
          <Text style={styles.linkText}>Forgot password?</Text>
        </TouchableOpacity>

        <Button
          title="Sign In"
          onPress={handleLogin}
          isLoading={isLoading}
          fullWidth
          testID="login-submit-btn"
        />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>New here?</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          title="Create Traveller Account"
          variant="outline"
          onPress={() => router.push("/(auth)/register")}
          fullWidth
        />

        <Button
          title="Verify Email with Token"
          variant="ghost"
          size="sm"
          onPress={() => router.push("/(auth)/verify-email")}
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
  },
  forgotLinkWrap: {
    alignSelf: "flex-end",
    minHeight: 44,
    justifyContent: "center"
  },
  linkText: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.terracotta[600]
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[2],
    marginVertical: mobileSpacing[1]
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: mobileColors.border
  },
  dividerLabel: {
    ...mobileTypography.bodySm
  }
});
