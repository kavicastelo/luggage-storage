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
import { useAuthStore } from "../../src/store/useAuthStore";
import { RegisterRequestSchema, RegisterResponseData } from "@luggage-storage/contracts";
import { validateWithZod } from "../../src/lib/validation";
import { ApiClientError } from "../../src/services/api-client";
import { z } from "zod";

const MobileRegisterFormSchema = RegisterRequestSchema.extend({
  confirmPassword: z.string().min(1, "Please confirm your password")
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export default function MobileRegisterScreen() {
  const router = useRouter();
  const { register: registerUser, isLoading } = useAuthStore();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [registeredData, setRegisteredData] = useState<RegisterResponseData | null>(null);

  const handleRegister = async () => {
    setServerError(null);
    setFieldErrors({});

    const formData = {
      displayName: displayName.trim(),
      email: email.trim(),
      password,
      confirmPassword,
      phoneNumber: phoneNumber.trim() ? phoneNumber.trim() : undefined
    };

    const validation = validateWithZod(MobileRegisterFormSchema, formData);
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    try {
      // Omit role so backend assigns default TRAVELLER role
      const result = await registerUser({
        displayName: validation.data.displayName,
        email: validation.data.email,
        password: validation.data.password,
        phoneNumber: validation.data.phoneNumber
      });
      setRegisteredData(result);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 409) {
          setServerError("An account with this email address already exists. Please sign in instead.");
        } else {
          setServerError(err.message || "Failed to create account. Please verify your details.");
        }
      } else {
        setServerError(err instanceof Error ? err.message : "Network error. Please try again.");
      }
    }
  };

  if (registeredData) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.card}>
          <Text style={styles.successBadge}>✓ Account Created</Text>
          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.subtitle}>
            Hello, <Text style={styles.boldText}>{registeredData.displayName}</Text>. Your account has been registered with the default Traveller role.
          </Text>

          <View style={styles.verificationNotice}>
            <Text style={styles.noticeTitle}>Email Verification Required</Text>
            <Text style={styles.noticeBody}>
              Status: <Text style={styles.boldText}>{registeredData.status}</Text>. Please verify the confirmation email sent to <Text style={styles.boldText}>{registeredData.email}</Text> before signing in.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              router.replace(
                `/(traveller)?screen=TM-008&email=${encodeURIComponent(registeredData.email)}`
              )
            }
          >
            <Text style={styles.buttonText}>Verify Email Now (TM-008)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#0f172a", marginTop: 10 }]}
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text style={styles.buttonText}>Proceed to Sign In</Text>
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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join as a Traveller on mobile</Text>

          {serverError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{serverError}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, fieldErrors.displayName ? styles.inputError : null]}
              placeholder="Alex Smith"
              placeholderTextColor="#94a3b8"
              value={displayName}
              onChangeText={setDisplayName}
              editable={!isLoading}
            />
            {fieldErrors.displayName && (
              <Text style={styles.fieldErrorText}>{fieldErrors.displayName}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, fieldErrors.email ? styles.inputError : null]}
              placeholder="alex@example.com"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!isLoading}
            />
            {fieldErrors.email && <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number (Optional)</Text>
            <TextInput
              style={[styles.input, fieldErrors.phoneNumber ? styles.inputError : null]}
              placeholder="+1 555 000 0000"
              placeholderTextColor="#94a3b8"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              editable={!isLoading}
            />
            {fieldErrors.phoneNumber && (
              <Text style={styles.fieldErrorText}>{fieldErrors.phoneNumber}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password (min 8 chars)</Text>
            <TextInput
              style={[styles.input, fieldErrors.password ? styles.inputError : null]}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!isLoading}
            />
            {fieldErrors.password && (
              <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
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
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Register</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.signUpLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0f172a",
    textAlign: "center"
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20
  },
  boldText: {
    fontWeight: "bold",
    color: "#0f172a"
  },
  successBadge: {
    color: "#16a34a",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8
  },
  verificationNotice: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginVertical: 16
  },
  noticeTitle: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase"
  },
  noticeBody: {
    color: "#b45309",
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16
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
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20
  },
  footerText: {
    fontSize: 13,
    color: "#64748b"
  },
  signUpLink: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563eb"
  }
});

