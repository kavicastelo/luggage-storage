import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useMobileStore } from "../src/store/useMobileStore";
import { useAuthStore } from "../src/store/useAuthStore";
import { MascotIllustration } from "../src/components/MascotIllustration";

export default function RoleSelectScreen() {
  const router = useRouter();
  const { setRole } = useMobileStore();
  const { user, isAuthenticated, logout } = useAuthStore();

  const isHost =
    user?.roles?.includes("HOST_OWNER") ||
    user?.roles?.includes("HOST_STAFF") ||
    user?.roles?.includes("SUPERADMIN");

  const handleSelectTraveller = () => {
    setRole("traveller");
    router.replace("/(traveller)");
  };

  const handleSelectHost = () => {
    if (isAuthenticated && !isHost) {
      return;
    }
    setRole("host");
    router.replace("/(host)");
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <MascotIllustration
        mascot="wave"
        size="md"
        badgeText="TM-001 / HM-001 • Meet Kiri"
        caption="70 Active Mobile Screens (39 Traveller + 31 Host)"
      />
      <Text style={styles.title}>Luggage Storage</Text>
      <Text style={styles.subtitle}>Mobile Marketplace Experience</Text>

      {/* Authenticated user status bar */}
      {isAuthenticated && user ? (
        <View style={styles.userCard}>
          <View style={styles.userHeader}>
            <View style={styles.avatarMini}>
              <Text style={styles.avatarMiniText}>
                {user.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.userName}>{user.displayName}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
          </View>

          <View style={styles.userActions}>
            <TouchableOpacity
              style={styles.profileLink}
              onPress={() => router.push("/(account)/profile")}
            >
              <Text style={styles.profileLinkText}>View Profile & Sessions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
              <Text style={styles.logoutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.authCard}>
          <Text style={styles.authCardText}>Sign in to access your bookings and storage spots</Text>
          <View style={styles.authButtonsRow}>
            <TouchableOpacity
              style={styles.authSignInBtn}
              onPress={() => router.push("/(auth)/login")}
            >
              <Text style={styles.authSignInText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.authRegisterBtn}
              onPress={() => router.push("/(auth)/register")}
            >
              <Text style={styles.authRegisterText}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.experienceHeader}>Select Experience</Text>

      <TouchableOpacity style={styles.button} onPress={handleSelectTraveller}>
        <Text style={styles.buttonText}>Continue as Traveller</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          styles.hostButton,
          !isHost && isAuthenticated ? styles.hostDisabled : null
        ]}
        onPress={handleSelectHost}
        disabled={Boolean(isAuthenticated && !isHost)}
      >
        <Text style={styles.buttonText}>
          {isAuthenticated
            ? isHost
              ? "Continue as Host Partner"
              : "Host Partner Hub (Host Role Required)"
            : "Preview Host Partner Hub (Demo)"}
        </Text>
      </TouchableOpacity>
      {!isHost && isAuthenticated && (
        <Text style={styles.hostNotice}>
          (Host Partner operations require Host permissions)
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f8fafc"
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 24,
    textAlign: "center"
  },
  userCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12
  },
  avatarMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center"
  },
  avatarMiniText: {
    color: "#2563eb",
    fontWeight: "bold",
    fontSize: 16
  },
  userName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0f172a"
  },
  userEmail: {
    fontSize: 12,
    color: "#64748b"
  },
  userActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10
  },
  profileLink: {
    paddingVertical: 4
  },
  profileLinkText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "600"
  },
  logoutButton: {
    paddingVertical: 4
  },
  logoutButtonText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "600"
  },
  authCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center"
  },
  authCardText: {
    fontSize: 13,
    color: "#475569",
    textAlign: "center",
    marginBottom: 12
  },
  authButtonsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%"
  },
  authSignInBtn: {
    flex: 1,
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center"
  },
  authSignInText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 13
  },
  authRegisterBtn: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1"
  },
  authRegisterText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 13
  },
  experienceHeader: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#94a3b8",
    marginBottom: 12
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    marginBottom: 12
  },
  hostButton: {
    backgroundColor: "#0f172a"
  },
  hostDisabled: {
    backgroundColor: "#475569"
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600"
  },
  hostNotice: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: -4,
    marginBottom: 12
  }
});
