import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useHostStore } from "../../src/store/useHostStore";
import { MobileIcon } from "../../src/components/MobileIcon";
import { mobileColors } from "../../src/lib/theme";

export default function HostLayout() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { activeDemoRole, setActiveDemoRole } = useHostStore();

  const isHostAuthorized =
    user?.roles?.includes("HOST_OWNER") ||
    user?.roles?.includes("HOST_STAFF") ||
    user?.roles?.includes("SUPERADMIN");

  const isOwner = isAuthenticated
    ? Boolean(user?.roles?.includes("HOST_OWNER") || user?.roles?.includes("SUPERADMIN"))
    : activeDemoRole === "HOST_OWNER";

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
          <View style={styles.demoBannerTextCol}>
            <Text style={styles.demoBannerText}>
              Demo Mode: <Text style={styles.demoRoleStrong}>{activeDemoRole === "HOST_OWNER" ? "Host Owner" : "Host Staff"}</Text>
            </Text>
            <Text style={styles.demoRoleHint}>
              {activeDemoRole === "HOST_OWNER"
                ? "Full access to Earnings & Settings"
                : "Operational access only (Earnings & Settings restricted)"}
            </Text>
          </View>
          <View style={styles.demoBannerActions}>
            <View style={styles.demoRoleToggleGroup}>
              <TouchableOpacity
                style={[
                  styles.demoRoleToggleBtn,
                  activeDemoRole === "HOST_OWNER" && styles.demoRoleToggleBtnActive
                ]}
                onPress={() => setActiveDemoRole("HOST_OWNER")}
              >
                <Text
                  style={[
                    styles.demoRoleToggleText,
                    activeDemoRole === "HOST_OWNER" && styles.demoRoleToggleTextActive
                  ]}
                >
                  Owner
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.demoRoleToggleBtn,
                  activeDemoRole === "HOST_STAFF" && styles.demoRoleToggleBtnActive
                ]}
                onPress={() => setActiveDemoRole("HOST_STAFF")}
              >
                <Text
                  style={[
                    styles.demoRoleToggleText,
                    activeDemoRole === "HOST_STAFF" && styles.demoRoleToggleTextActive
                  ]}
                >
                  Staff
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.demoSignInLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: mobileColors.terracotta[500],
          tabBarInactiveTintColor: mobileColors.sand[600],
          tabBarStyle: {
            backgroundColor: mobileColors.navy[900],
            borderTopColor: mobileColors.navy[800],
            height: 62,
            paddingBottom: 8,
            paddingTop: 6
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600"
          }
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Live Desk",
            tabBarLabel: "Live Desk",
            tabBarIcon: ({ color }) => (
              <MobileIcon
                name="clock"
                size={20}
                color={color ? String(color) : mobileColors.sand[600]}
              />
            )
          }}
        />
        <Tabs.Screen
          name="requests"
          options={{
            title: "Requests",
            tabBarLabel: "Requests",
            tabBarIcon: ({ color }) => (
              <MobileIcon
                name="bell"
                size={20}
                color={color ? String(color) : mobileColors.sand[600]}
              />
            )
          }}
        />
        <Tabs.Screen
          name="vault"
          options={{
            title: "Vault",
            tabBarLabel: "Vault",
            tabBarIcon: ({ color }) => (
              <MobileIcon
                name="layers"
                size={20}
                color={color ? String(color) : mobileColors.sand[600]}
              />
            )
          }}
        />
        <Tabs.Screen
          name="earnings"
          options={{
            href: isOwner ? "/(host)/earnings" : null,
            title: "Earnings",
            tabBarLabel: "Earnings",
            tabBarIcon: ({ color }) => (
              <MobileIcon
                name="wallet"
                size={20}
                color={color ? String(color) : mobileColors.sand[600]}
              />
            )
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            href: isOwner ? "/(host)/settings" : null,
            title: "Settings",
            tabBarLabel: "Settings",
            tabBarIcon: ({ color }) => (
              <MobileIcon
                name="user"
                size={20}
                color={color ? String(color) : mobileColors.sand[600]}
              />
            )
          }}
        />

        {/* Workflow sub-routes hidden from bottom tab bar */}
        <Tabs.Screen
          name="scanner"
          options={{
            href: null,
            title: "Handover Scanner"
          }}
        />
        <Tabs.Screen
          name="intake"
          options={{
            href: null,
            title: "Guided Intake"
          }}
        />
      </Tabs>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8
  },
  demoBannerTextCol: {
    flex: 1,
    minWidth: 180
  },
  demoBannerText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400e"
  },
  demoRoleStrong: {
    fontWeight: "700",
    color: "#78350f"
  },
  demoRoleHint: {
    fontSize: 10,
    color: "#a16207",
    marginTop: 1
  },
  demoBannerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  demoRoleToggleGroup: {
    flexDirection: "row",
    backgroundColor: "#fef3c7",
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: "#fde68a"
  },
  demoRoleToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  demoRoleToggleBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1
  },
  demoRoleToggleText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#78350f"
  },
  demoRoleToggleTextActive: {
    color: "#92400e",
    fontWeight: "700"
  },
  demoSignInLink: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563eb",
    paddingHorizontal: 4
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
