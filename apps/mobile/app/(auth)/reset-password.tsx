import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from "react-native";
import { useRouter } from "expo-router";
import { ResetPasswordRequestSchema } from "@luggage-storage/contracts";
import { validateWithZod } from "../../src/lib/validation";
import { authApi } from "../../src/services/auth-api";
import { ApiClientError } from "../../src/services/api-client";

export default function MobileResetPasswordScreen() {
  const router = useRouter();

  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setServerError(null);
    setFieldErrors({});

    const formData = {
      token: token.trim(),
      newPassword,
      confirmPassword
    };

    const validation = validateWithZod(ResetPasswordRequestSchema, formData);
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword(validation.data);
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 400) {
          setServerError("This recovery token is invalid or has expired. Please request a new link.");
        } else {
          setServerError(err.message || "Failed to reset password. Please try again.");
        }
      } else {
        setServerError(err instanceof Error ? err.message : "Network error. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.card}>
          <Text style={styles.successBadge}>✓ Reset Successful</Text>
          <Text style={styles.title}>Password Updated</Text>
          <Text style={styles.subtitle}>
            Your password has been reset. All previous sessions across all devices have been terminated for your security.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text style={styles.buttonText}>Sign In with New Password</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter the recovery token from your email and select a new secure password.
          </Text>

          {serverError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{serverError}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Recovery Token</Text>
            <TextInput
              style={[styles.input, fieldErrors.token ? styles.inputError : null]}
              placeholder="Paste token from email"
              placeholderTextColor="#94a3b8"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              editable={!isLoading}
            />
            {fieldErrors.token && <Text style={styles.fieldErrorText}>{fieldErrors.token}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password (min 8 chars)</Text>
            <TextInput
              style={[styles.input, fieldErrors.newPassword ? styles.inputError : null]}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!isLoading}
            />
            {fieldErrors.newPassword && (
              <Text style={styles.fieldErrorText}>{fieldErrors.newPassword}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={[styles.input, fieldErrors.confirmPassword ? styles.inputError : null]}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!isLoading}
            />
            {fieldErrors.confirmPassword && (
              <Text style={styles.fieldErrorText}>{fieldErrors.confirmPassword}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading ? styles.buttonDisabled : null]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Reset Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  successContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  backButton: {
    marginBottom: 12
  },
  backButtonText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600"
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#0f172a",
    textAlign: "center"
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 18
  },
  successBadge: {
    color: "#16a34a",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16
  },
  errorBannerText: {
    color: "#b91c1c",
    fontSize: 13,
    lineHeight: 18
  },
  inputGroup: {
    marginBottom: 14
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#ffffff"
  },
  inputError: {
    borderColor: "#f87171"
  },
  fieldErrorText: {
    color: "#dc2626",
    fontSize: 12,
    marginTop: 4
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600"
  }
});

