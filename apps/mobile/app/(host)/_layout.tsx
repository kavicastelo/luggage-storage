import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useAuthStore } from "../../src/store/useAuthStore";

export default function HostLayout() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const isHostAuthorized =
    user?.roles?.includes("HOST_OWNER") ||
    user?.roles?.includes("HOST_STAFF") ||
    user?.roles?.includes("SUPERADMIN");

  if (isAuthenticated && !isHostAuthorized) {
    return (
      <View style={styles.deniedContainer}>
        <View style={styles.deniedCard}>
          <Text style={styles.deniedBadge}>RBAC Guard • 403 Forbidden</Text>
          <Text style={styles.deniedTitle}>Host Role Required</Text>
          <Text style={styles.deniedBody}>
            Your authenticated account ({user?.email}) is assigned roles:{" "}
            {(user?.roles || []).join(", ")}. Host Mobile screens require HOST_OWNER,
            HOST_STAFF, or SUPERADMIN permissions.
          </Text>
          <TouchableOpacity
            style={styles.returnBtn}
            onPress={() => router.replace("/(traveller)")}
          >
            <Text style={styles.returnBtnText}>Return to Traveller Mode</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flexContainer}>
      {!isAuthenticated && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>
            Demo Preview Mode: Unauthenticated Host Mobile simulation.
          </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.demoSignInLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      )}
      <Stack>
        <Stack.Screen name="index" options={{ title: "Host Operations Hub" }} />
        <Stack.Screen name="scanner" options={{ title: "QR / PIN Handover Scanner" }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  flexContainer: {
    flex: 1
  },
  demoBanner: {
    backgroundColor: "#fffbeb",
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a",
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  demoBannerText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400e",
    flex: 1
  },
  demoSignInLink: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563eb",
    marginLeft: 8
  },
  deniedContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  deniedCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center"
  },
  deniedBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#dc2626",
    textTransform: "uppercase",
    marginBottom: 8
  },
  deniedTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8
  },
  deniedBody: {
    fontSize: 13,
    color: "#475569",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20
  },
  returnBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: "100%",
    alignItems: "center"
  },
  returnBtnText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14
  }
});
