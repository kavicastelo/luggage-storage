import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useAuthStore } from "../../src/store/useAuthStore";

export default function AccountLayout() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return (
      <View style={styles.guardContainer}>
        <View style={styles.guardCard}>
          <Text style={styles.guardTitle}>Authentication Required</Text>
          <Text style={styles.guardBody}>
            Please sign in to access your profile, active sessions, and account security settings.
          </Text>
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text style={styles.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="profile" options={{ title: "My Profile" }} />
      <Stack.Screen name="security" options={{ title: "Security & Password" }} />
      <Stack.Screen name="sessions" options={{ title: "Active Devices & Sessions" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  guardContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  guardCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center"
  },
  guardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8
  },
  guardBody: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18
  },
  signInBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: "100%",
    alignItems: "center"
  },
  signInBtnText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14
  }
});

