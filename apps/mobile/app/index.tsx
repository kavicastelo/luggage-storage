import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  MascotIllustration,
  MobileIcon,
  ScreenContainer,
  StatusBadge
} from "../src/components";
import { useAuthStore } from "../src/store/useAuthStore";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../src/lib/theme";

const HOST_ROLES = new Set(["HOST_OWNER", "HOST_STAFF", "PLATFORM_ADMIN", "SUPERADMIN"]);

export default function MobileEntryGatewayScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [confirmLogoutVisible, setConfirmLogoutVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isHost = Boolean(user?.roles.some((r) => HOST_ROLES.has(r)));

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      setConfirmLogoutVisible(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom"]} testID="entry-gateway-screen">
      <View style={styles.heroCard}>
        <Badge label="Sri Lanka · LKR" variant="terracotta" icon="map-pin" />
        <Text style={styles.brandTitle}>LuggageStorage Sri Lanka</Text>
        <Text style={styles.brandSubtitle}>
          Verified local partner storage across Colombo, Kandy, Galle & Ella — explore hands-free.
        </Text>
        <MascotIllustration
          mascot="suitcase-walk"
          size="md"
          variant="hero"
          badgeText="Tamper-Evident Custody"
          caption="Instant quote transparency in LKR and QR-verified luggage check-in & collection."
        />
      </View>

      {isAuthenticated && user ? (
        <Card variant="elevated" style={styles.accountCard}>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userMeta}>
              <Text style={styles.userName}>{user.displayName}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
            <StatusBadge status={user.status} size="sm" />
          </View>

          {!user.isEmailVerified ? (
            <Button
              title="Verify Email Address"
              variant="outline"
              size="sm"
              onPress={() => router.push("/(auth)/verify-email")}
              leftIcon={<MobileIcon name="mail" size="sm" />}
              fullWidth
            />
          ) : null}

          <View style={styles.accountActions}>
            <Button
              title="Account & Security"
              variant="outline"
              size="sm"
              onPress={() => router.push("/(account)/profile")}
              leftIcon={<MobileIcon name="user" size="sm" />}
              style={styles.flexBtn}
            />
            <Button
              title="Sign Out"
              variant="danger"
              size="sm"
              onPress={() => setConfirmLogoutVisible(true)}
              leftIcon={<MobileIcon name="log-out" size="sm" color={mobileColors.white} />}
              style={styles.flexBtn}
            />
          </View>
        </Card>
      ) : (
        <Card variant="default" style={styles.authCard}>
          <Text style={styles.cardHeading}>Sign in for Bookings & Hosting</Text>
          <Text style={styles.cardBody}>
            Browse verified storage locations openly, or sign in to reserve space and access digital custody passes.
          </Text>
          <View style={styles.accountActions}>
            <Button
              title="Sign In"
              variant="primary"
              size="sm"
              onPress={() => router.push("/(auth)/login")}
              style={styles.flexBtn}
            />
            <Button
              title="Create Account"
              variant="secondary"
              size="sm"
              onPress={() => router.push("/(auth)/register")}
              style={styles.flexBtn}
            />
          </View>
        </Card>
      )}

      <View style={styles.modeCards}>
        <Button
          title="Explore Luggage Storage"
          variant="primary"
          size="lg"
          onPress={() => router.replace("/(traveller)")}
          leftIcon={<MobileIcon name="compass" size="md" color={mobileColors.white} />}
          fullWidth
          testID="gateway-traveller-btn"
        />

        {isAuthenticated ? (
          isHost ? (
            <Button
              title="Open Host Partner Hub"
              variant="secondary"
              size="lg"
              onPress={() => router.replace("/(host)")}
              leftIcon={<MobileIcon name="briefcase" size="md" color={mobileColors.white} />}
              fullWidth
              testID="gateway-host-btn"
            />
          ) : (
            <Button
              title="Become a Storage Host"
              variant="outline"
              size="lg"
              onPress={() => router.push("/(host)/onboarding")}
              leftIcon={<MobileIcon name="building" size="md" color={mobileColors.navy[900]} />}
              fullWidth
              testID="gateway-become-host-btn"
            />
          )
        ) : (
          <Button
            title="Host Partner Sign In"
            variant="outline"
            size="md"
            onPress={() => router.push("/(auth)/login")}
            leftIcon={<MobileIcon name="briefcase" size="sm" color={mobileColors.navy[900]} />}
            fullWidth
          />
        )}

        <Button
          title="How LuggageStorage Works"
          variant="ghost"
          size="sm"
          onPress={() => router.push("/(traveller)/onboarding")}
          leftIcon={<MobileIcon name="help-circle" size="sm" color={mobileColors.navy[700]} />}
          fullWidth
          testID="gateway-onboarding-btn"
        />
      </View>

      <ConfirmDialog
        visible={confirmLogoutVisible}
        title="Sign Out"
        description="Sign out of your account on this device? Your refresh token and local query cache will be cleared."
        confirmLabel="Sign Out"
        destructive
        icon="log-out"
        isLoading={isLoggingOut}
        onConfirm={handleConfirmLogout}
        onCancel={() => setConfirmLogoutVisible(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: mobileColors.navy[900],
    borderRadius: mobileRadius["2xl"],
    padding: mobileSpacing[5],
    alignItems: "center",
    gap: mobileSpacing[3],
    marginBottom: mobileSpacing[2]
  },
  brandTitle: {
    ...mobileTypography.displaySm,
    color: mobileColors.white,
    textAlign: "center"
  },
  brandSubtitle: {
    ...mobileTypography.bodyMd,
    textAlign: "center",
    color: mobileColors.sand[200]
  },
  accountCard: {
    marginTop: mobileSpacing[3],
    marginBottom: mobileSpacing[4],
    gap: mobileSpacing[3]
  },
  authCard: {
    marginTop: mobileSpacing[3],
    marginBottom: mobileSpacing[4],
    gap: mobileSpacing[3]
  },
  cardHeading: {
    ...mobileTypography.headingSm
  },
  cardBody: {
    ...mobileTypography.bodyMd
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[3]
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.navy[900],
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: mobileColors.white,
    fontSize: 18,
    fontWeight: "800"
  },
  userMeta: {
    flex: 1
  },
  userName: {
    ...mobileTypography.headingSm
  },
  userEmail: {
    ...mobileTypography.bodySm
  },
  accountActions: {
    flexDirection: "row",
    gap: mobileSpacing[3]
  },
  flexBtn: {
    flex: 1
  },
  modeCards: {
    gap: mobileSpacing[3],
    marginBottom: mobileSpacing[4]
  }
});
