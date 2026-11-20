import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Tabs, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  Card,
  MascotIllustration,
  MobileIcon,
  SafeHeader,
  ScreenContainer
} from "../../src/components";
import { useAuthStore } from "../../src/store/useAuthStore";
import {
  mobileColors,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

export default function HostLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuthStore();

  const isOnboardingRoute = pathname.includes("/onboarding");

  if (!isAuthenticated) {
    return (
      <ScreenContainer
        header={<SafeHeader title="Partner Counter" subtitle="Host Operations" />}
        testID="host-auth-gate"
      >
        <Card variant="elevated" style={styles.gateCard}>
          <MascotIllustration mascot="salute" size="md" />
          <Text style={styles.gateTitle}>Sign in Required for Host Workspace</Text>
          <Text style={styles.gateBody}>
            Managing verified Sri Lanka storage hubs, custody handovers, and LKR payouts requires
            an authenticated partner account.
          </Text>
          <Button
            title="Sign In"
            leftIcon={<MobileIcon name="lock" size={16} color={mobileColors.white} />}
            onPress={() => router.push("/(auth)/login")}
          />
          <Button
            title="Return to Traveller Mode"
            variant="outline"
            onPress={() => router.replace("/(traveller)")}
          />
        </Card>
      </ScreenContainer>
    );
  }

  const isHostAuthorized =
    user?.roles?.includes("HOST_OWNER") ||
    user?.roles?.includes("HOST_STAFF") ||
    user?.roles?.includes("SUPERADMIN");

  const isOwner = Boolean(
    user?.roles?.includes("HOST_OWNER") || user?.roles?.includes("SUPERADMIN")
  );

  if (isAuthenticated && !isHostAuthorized && !isOnboardingRoute) {
    return (
      <ScreenContainer
        header={<SafeHeader title="Partner Counter" subtitle="Access Control" />}
        testID="host-rbac-forbidden"
      >
        <Card variant="outlined" style={styles.deniedCard}>
          <Text style={styles.deniedBadge}>RBAC Guard • 403 Forbidden</Text>
          <Text style={styles.deniedTitle}>Host Role Required</Text>
          <Text style={styles.deniedBody}>
            Your authenticated account ({user?.email}) currently holds roles:{" "}
            {(user?.roles || ["TRAVELLER"]).join(", ")}. Counter custody screens require
            HOST_OWNER, HOST_STAFF, or SUPERADMIN permissions.
          </Text>
          <Button
            title="Start Host Onboarding"
            leftIcon={<MobileIcon name="building" size={16} color={mobileColors.white} />}
            onPress={() => router.push("/(host)/onboarding")}
          />
          <Button
            title="Return to Traveller Mode"
            variant="outline"
            onPress={() => router.replace("/(traveller)")}
          />
        </Card>
      </ScreenContainer>
    );
  }

  return (
    <View style={styles.flexContainer}>
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: mobileColors.terracotta[500],
          tabBarInactiveTintColor: mobileColors.sand[400],
          tabBarStyle: {
            backgroundColor: mobileColors.navy[900],
            borderTopColor: mobileColors.navy[800],
            height: 62 + insets.bottom,
            paddingBottom: Math.max(insets.bottom, 8),
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
                color={color ? String(color) : mobileColors.sand[400]}
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
                color={color ? String(color) : mobileColors.sand[400]}
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
                color={color ? String(color) : mobileColors.sand[400]}
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
                color={color ? String(color) : mobileColors.sand[400]}
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
                color={color ? String(color) : mobileColors.sand[400]}
              />
            )
          }}
        />

        {/* Sub-routes hidden from tab bar via tabBarButton (replaces non-routable href: null) */}
        <Tabs.Screen
          name="scanner"
          options={{
            title: "Handover Scanner",
            tabBarButton: () => null,
            tabBarItemStyle: { display: "none" },
            tabBarStyle: { display: "none" }
          }}
        />
        <Tabs.Screen
          name="intake"
          options={{
            title: "Bag Intake",
            tabBarButton: () => null,
            tabBarItemStyle: { display: "none" },
            tabBarStyle: { display: "none" }
          }}
        />
        <Tabs.Screen
          name="onboarding"
          options={{
            title: "Partner Onboarding",
            tabBarButton: () => null,
            tabBarItemStyle: { display: "none" },
            tabBarStyle: { display: "none" }
          }}
        />
        <Tabs.Screen
          name="locations"
          options={{
            title: "Storage Hubs",
            tabBarButton: () => null,
            tabBarItemStyle: { display: "none" },
            tabBarStyle: { display: "none" }
          }}
        />
        <Tabs.Screen
          name="location-editor"
          options={{
            title: "Hub Configuration",
            tabBarButton: () => null,
            tabBarItemStyle: { display: "none" },
            tabBarStyle: { display: "none" }
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  flexContainer: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  gateCard: {
    alignItems: "center",
    gap: mobileSpacing[4],
    marginTop: mobileSpacing[4]
  },
  gateTitle: {
    ...mobileTypography.headingMd,
    color: mobileTextColors.primary,
    textAlign: "center"
  },
  gateBody: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.secondary,
    textAlign: "center"
  },
  deniedCard: {
    gap: mobileSpacing[3],
    marginTop: mobileSpacing[4],
    borderColor: mobileStatusTokens.dangerBorder,
    backgroundColor: mobileStatusTokens.dangerBg
  },
  deniedBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileStatusTokens.danger,
    textTransform: "uppercase"
  },
  deniedTitle: {
    ...mobileTypography.headingMd,
    color: mobileColors.navy[900]
  },
  deniedBody: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.secondary
  }
});
