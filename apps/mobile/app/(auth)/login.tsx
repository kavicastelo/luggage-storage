import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, TextInput as RNTextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LoginRequestSchema } from "@luggage-storage/contracts";
import {
  Button,
  Card,
  ErrorState,
  MascotIllustration,
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
  const { redirectTo } = useLocalSearchParams<{ redirectTo?: string | string[] }>();
  const { login, isLoading, error, setError } = useAuthStore();
  const passwordInputRef = useRef<React.ComponentRef<typeof RNTextInput>>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const resolvedRedirectTo = Array.isArray(redirectTo) ? redirectTo[0] : redirectTo;

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
      if (resolvedRedirectTo && resolvedRedirectTo.startsWith("/")) {
        router.replace(resolvedRedirectTo as "/(traveller)");
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
          <MascotIllustration mascot="key" size="sm" variant="bare" decorative />
          <Text style={styles.heading}>Welcome Back</Text>
          <Text style={styles.subtext}>
            Sign in with your verified LuggageStorage email and password.
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
          returnKeyType="next"
          onSubmitEditing={() => passwordInputRef.current?.focus()}
          value={email}
          onChangeText={(val) => {
            setEmail(val);
            if (error) setError(null);
          }}
          errorText={fieldErrors.email}
          testID="login-email-input"
        />

        <TextInput
          ref={passwordInputRef}
          label="Password"
          required
          leftIcon="lock"
          placeholder="Enter your password"
          secureTextEntry
          enablePasswordToggle
          autoComplete="password"
          returnKeyType="done"
          onSubmitEditing={() => {
            void handleLogin();
          }}
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
