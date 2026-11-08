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
import { ForgotPasswordRequestSchema } from "@luggage-storage/contracts";
import { validateWithZod } from "../../src/lib/validation";
import { authApi } from "../../src/services/auth-api";

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
      // Strictly enumeration-resistant confirmation
      setIsSubmitted(true);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Request failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.card}>
          <Text style={styles.successBadge}>✓ Instructions Sent</Text>
          <Text style={styles.title}>Check Your Inbox</Text>
          <Text style={styles.subtitle}>
            If an account is associated with <Text style={styles.boldText}>{email}</Text>, password reset instructions have been dispatched.
          </Text>
          <Text style={styles.privacyNote}>
            For your security and privacy, we do not confirm whether an account is registered with this email.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push("/(auth)/reset-password")}
          >
            <Text style={styles.buttonText}>I have a recovery token</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
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

          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            Enter your registered email address to receive password reset instructions.
          </Text>

          {serverError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{serverError}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, fieldErrors.email ? styles.inputError : null]}
              placeholder="you@example.com"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!isLoading}
            />
            {fieldErrors.email && <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text>}
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading ? styles.buttonDisabled : null]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Send Instructions</Text>
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
  boldText: {
    fontWeight: "bold",
    color: "#0f172a"
  },
  privacyNote: {
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
    fontStyle: "italic"
  },
  successBadge: {
    color: "#2563eb",
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
    marginBottom: 16
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
  },
  secondaryButton: {
    backgroundColor: "#f1f5f9",
    marginTop: 10
  },
  secondaryButtonText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "600"
  }
});

