import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../src/store/useAuthStore";

export default function MobileProfileScreen() {
  const router = useRouter();
  const { user, sessionId, permissions, logout, isLoading } = useAuthStore();

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Not authenticated</Text>
      </View>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profile Header */}
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.displayName}>{user.displayName}</Text>
        <Text style={styles.emailText}>{user.email}</Text>

        <View style={styles.badgeRow}>
          <View style={[styles.statusBadge, user.status === "ACTIVE" ? styles.badgeActive : styles.badgeWarning]}>
            <Text style={styles.statusBadgeText}>{user.status}</Text>
          </View>
          <View style={[styles.statusBadge, user.isEmailVerified ? styles.badgeVerified : styles.badgeUnverified]}>
            <Text style={styles.statusBadgeText}>
              {user.isEmailVerified ? "Email Verified" : "Email Unverified"}
            </Text>
          </View>
        </View>

        {!user.isEmailVerified && (
          <View style={styles.unverifiedAlert}>
            <Text style={styles.unverifiedAlertText}>
              Please verify your email address to enable luggage storage location hosting.
            </Text>
          </View>
        )}
      </View>

      {/* Account Details */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}>Account Information</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>User ID</Text>
          <Text style={styles.detailValueMono} numberOfLines={1}>
            {user.id}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Active Session ID</Text>
          <Text style={styles.detailValueMono} numberOfLines={1}>
            {sessionId || "N/A"}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Assigned Roles</Text>
          <View style={styles.roleChipsContainer}>
            {user.roles.map((r) => (
              <View key={r} style={styles.roleChip}>
                <Text style={styles.roleChipText}>{r}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Effective Permissions */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}>Effective Permissions ({permissions.length})</Text>
        <Text style={styles.permissionsSubtitle}>
          Evaluated dynamically from PostgreSQL role-permission mappings:
        </Text>
        <View style={styles.permissionsGrid}>
          {permissions.map((p) => (
            <View key={p} style={styles.permChip}>
              <Text style={styles.permText}>{p}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Navigation Actions */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/(account)/security")}
        >
          <Text style={styles.menuItemText}>Change Password</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/(account)/sessions")}
        >
          <Text style={styles.menuItemText}>Active Sessions & Devices</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.menuItem, styles.logoutItem]}
          onPress={handleLogout}
          disabled={isLoading}
        >
          <Text style={styles.logoutText}>Sign Out of Device</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc"
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    alignItems: "center"
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12
  },
  avatarText: {
    color: "#2563eb",
    fontSize: 26,
    fontWeight: "bold"
  },
  displayName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a"
  },
  emailText: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  badgeActive: {
    backgroundColor: "#dcfce7"
  },
  badgeWarning: {
    backgroundColor: "#fef3c7"
  },
  badgeVerified: {
    backgroundColor: "#dbeafe"
  },
  badgeUnverified: {
    backgroundColor: "#fee2e2"
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1e293b"
  },
  unverifiedAlert: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
    width: "100%"
  },
  unverifiedAlertText: {
    color: "#b45309",
    fontSize: 12,
    textAlign: "center"
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0f172a",
    width: "100%",
    marginBottom: 12
  },
  detailRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9"
  },
  detailLabel: {
    fontSize: 13,
    color: "#64748b"
  },
  detailValueMono: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#1e293b",
    maxWidth: 200
  },
  roleChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4
  },
  roleChip: {
    backgroundColor: "#e0e7ff",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  roleChipText: {
    color: "#3730a3",
    fontSize: 11,
    fontWeight: "600"
  },
  permissionsSubtitle: {
    fontSize: 12,
    color: "#64748b",
    width: "100%",
    marginBottom: 8
  },
  permissionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    width: "100%"
  },
  permChip: {
    backgroundColor: "#f1f5f9",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  permText: {
    fontSize: 11,
    color: "#334155",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace"
  },
  menuItem: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1e293b"
  },
  menuItemArrow: {
    fontSize: 18,
    color: "#94a3b8"
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    width: "100%"
  },
  logoutItem: {
    justifyContent: "center"
  },
  logoutText: {
    color: "#dc2626",
    fontSize: 15,
    fontWeight: "600"
  }
});
