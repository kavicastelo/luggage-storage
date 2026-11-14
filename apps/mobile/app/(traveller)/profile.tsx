import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  MascotIllustration,
  MobileIcon,
  SafeHeader,
  ScreenContainer,
  type MobileIconName
} from "../../src/components";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useMobileStore } from "../../src/store/useMobileStore";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

interface MenuRowProps {
  icon: MobileIconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
}

function MenuRow({ icon, title, subtitle, onPress }: MenuRowProps) {
  return (
    <TouchableOpacity
      style={styles.menuRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.menuIconWrap}>
        <MobileIcon name={icon} size={18} color={mobileColors.navy[900]} />
      </View>
      <View style={styles.menuTextCol}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
      </View>
      <MobileIcon name="chevron-right" size={18} color={mobileTextColors.muted} />
    </TouchableOpacity>
  );
}

export default function TravellerProfileScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { setRole } = useMobileStore();
  const [confirmLogoutVisible, setConfirmLogoutVisible] = useState(false);

  const isHostCapable = Boolean(
    user?.roles?.some((r) => ["HOST_OWNER", "HOST_STAFF", "SUPERADMIN"].includes(r))
  );

  const handleOpenHost = () => {
    setRole("host");
    if (isHostCapable) {
      router.push("/(host)");
    } else {
      router.push("/(host)/onboarding");
    }
  };

  return (
    <ScreenContainer
      header={<SafeHeader title="Account & Settings" subtitle="Traveller Profile & Host Access" />}
      testID="traveller-profile-screen"
    >
      {!isAuthenticated || !user ? (
        <Card variant="elevated" style={styles.guestCard}>
          <MascotIllustration mascot="wave" size="sm" />
          <Text style={styles.guestTitle}>Sign in to BagBox Sri Lanka</Text>
          <Text style={styles.guestBody}>
            Manage your luggage reservations, digital custody passes, saved hubs, and partner host
            workspace across devices.
          </Text>
          <Button
            title="Sign In"
            leftIcon={<MobileIcon name="user" size={16} color={mobileColors.white} />}
            onPress={() => router.push("/(auth)/login")}
          />
          <Button
            title="Create Account"
            variant="outline"
            onPress={() => router.push("/(auth)/register")}
          />
        </Card>
      ) : (
        <View style={styles.stack}>
          <Card variant="elevated" style={styles.identityCard}>
            <View style={styles.identityTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(user.displayName || user.email || "B").slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.identityTextCol}>
                <Text style={styles.displayName}>{user.displayName || "BagBox Member"}</Text>
                <Text style={styles.emailText}>{user.email}</Text>
              </View>
            </View>

            <View style={styles.badgesWrap}>
              <Badge
                label={user.isEmailVerified ? "Email Verified" : "Verification Pending"}
                variant={user.isEmailVerified ? "success" : "warning"}
                icon={user.isEmailVerified ? "check-circle" : "alert-circle"}
                size="sm"
              />
              {(user.roles ?? []).map((r) => (
                <Badge key={r} label={r} variant="navy" size="sm" />
              ))}
            </View>

            {!user.isEmailVerified ? (
              <Button
                title="Verify Email Address"
                variant="secondary"
                size="sm"
                onPress={() => router.push("/(auth)/verify-email")}
              />
            ) : null}
          </Card>

          <Card variant="default" style={styles.menuCard}>
            <MenuRow
              icon="user"
              title="Identity Profile"
              subtitle="Account email, roles, and permissions"
              onPress={() => router.push("/(account)/profile")}
            />
            <MenuRow
              icon="lock"
              title="Security & Password"
              subtitle="Update password & revoke external sessions"
              onPress={() => router.push("/(account)/security")}
            />
            <MenuRow
              icon="smartphone"
              title="Active Sessions"
              subtitle="Inspect and revoke signed-in devices"
              onPress={() => router.push("/(account)/sessions")}
            />
          </Card>

          <Card variant="default" style={styles.hostCard}>
            <Text style={styles.hostHeading}>
              {isHostCapable ? "Partner Host Workspace" : "Become a Storage Partner"}
            </Text>
            <Text style={styles.hostBody}>
              {isHostCapable
                ? "Switch to Host Workspace to approve requests, scan custody QR passes, and manage your Sri Lanka hubs."
                : "Register your hotel, café, or shop in Sri Lanka as a verified BagBox custody partner."}
            </Text>
            <Button
              title={isHostCapable ? "Open Host Workspace" : "Start Host Onboarding"}
              variant="secondary"
              leftIcon={<MobileIcon name="building" size={16} color={mobileColors.white} />}
              onPress={handleOpenHost}
            />
          </Card>

          <Card variant="default" style={styles.menuCard}>
            <MenuRow
              icon="compass"
              title="Platform Tour"
              subtitle="Revisit quick guide on how BagBox works"
              onPress={() => router.push("/(traveller)/onboarding")}
            />
            {__DEV__ ? (
              <MenuRow
                icon="layers"
                title="Developer Icon Catalogue"
                subtitle="Inspect all lucide-react-native UI icons"
                onPress={() => router.push("/(dev)/icons")}
              />
            ) : null}
          </Card>

          <Button
            title="Sign Out"
            variant="danger"
            leftIcon={<MobileIcon name="log-out" size={16} color={mobileColors.white} />}
            onPress={() => setConfirmLogoutVisible(true)}
          />
        </View>
      )}

      <ConfirmDialog
        visible={confirmLogoutVisible}
        title="Sign Out?"
        description="Your local refresh credential and cached queries on this device will be cleared."
        confirmLabel="Sign Out"
        destructive
        onCancel={() => setConfirmLogoutVisible(false)}
        onConfirm={() => {
          setConfirmLogoutVisible(false);
          void logout().then(() => {
            router.replace("/(traveller)");
          });
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: mobileSpacing[4]
  },
  guestCard: {
    gap: mobileSpacing[3],
    alignItems: "stretch"
  },
  guestTitle: {
    ...mobileTypography.headingMd,
    color: mobileTextColors.primary,
    textAlign: "center"
  },
  guestBody: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.secondary,
    textAlign: "center"
  },
  identityCard: {
    gap: mobileSpacing[3]
  },
  identityTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[3]
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.navy[900],
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: mobileColors.white
  },
  identityTextCol: {
    flex: 1,
    gap: 2
  },
  displayName: {
    ...mobileTypography.headingMd,
    color: mobileTextColors.primary
  },
  emailText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileTextColors.secondary
  },
  badgesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  menuCard: {
    padding: 0,
    overflow: "hidden"
  },
  menuRow: {
    minHeight: 56,
    paddingHorizontal: mobileSpacing[4],
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[3],
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.sand[200]
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.sand[100],
    alignItems: "center",
    justifyContent: "center"
  },
  menuTextCol: {
    flex: 1
  },
  menuTitle: {
    ...mobileTypography.label,
    color: mobileTextColors.primary
  },
  menuSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileTextColors.muted
  },
  hostCard: {
    gap: mobileSpacing[3],
    backgroundColor: mobileColors.navy[50],
    borderColor: mobileColors.navy[100]
  },
  hostHeading: {
    ...mobileTypography.headingSm,
    color: mobileColors.navy[900]
  },
  hostBody: {
    ...mobileTypography.bodySm,
    color: mobileColors.navy[700]
  }
});
