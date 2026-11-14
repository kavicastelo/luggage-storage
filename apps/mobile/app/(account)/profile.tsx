import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  MobileIcon,
  ScreenContainer,
  StatusBadge
} from "../../src/components";
import { useAuthStore } from "../../src/store/useAuthStore";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

export default function MobileProfileScreen() {
  const router = useRouter();
  const { user, sessionId, permissions, logout } = useAuthStore();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Sign In Required"
          description="Sign in to view your account details, email verification status, and permissions."
          icon="user"
          actionTitle="Sign In"
          onAction={() => router.replace("/(auth)/login")}
        />
      </ScreenContainer>
    );
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace("/");
    } finally {
      setIsLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  return (
    <ScreenContainer testID="account-profile-screen">
      <Card variant="elevated" style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.displayName}>{user.displayName}</Text>
        <Text style={styles.emailText}>{user.email}</Text>

        <View style={styles.badgeRow}>
          <StatusBadge status={user.status} size="sm" />
          <Badge
            label={user.isEmailVerified ? "Email Verified" : "Email Unverified"}
            variant={user.isEmailVerified ? "success" : "warning"}
            icon={user.isEmailVerified ? "check-circle" : "alert-circle"}
            size="sm"
          />
        </View>

        {!user.isEmailVerified ? (
          <View style={styles.verifyCallout}>
            <Text style={styles.verifyCalloutText}>
              Verify your email to create luggage bookings, change your password, or register as a host.
            </Text>
            <Button
              title="Verify Email Address"
              size="sm"
              onPress={() =>
                router.push({ pathname: "/(auth)/verify-email", params: { email: user.email } })
              }
              fullWidth
            />
          </View>
        ) : null}
      </Card>

      <Card variant="default" style={styles.card}>
        <Text style={styles.sectionTitle}>Identity Summary (Read-Only)</Text>
        <Text style={styles.helperNote}>
          Self-service profile editing is not exposed by the mobile API; contact support for legal identity changes.
        </Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>User ID</Text>
          <Text style={styles.detailMono} numberOfLines={1}>
            {user.id}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Active Session</Text>
          <Text style={styles.detailMono} numberOfLines={1}>
            {sessionId ?? "Active"}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Roles</Text>
          <View style={styles.chipsWrap}>
            {user.roles.map((r) => (
              <Badge key={r} label={r} variant="navy" size="sm" />
            ))}
          </View>
        </View>
      </Card>

      <Card variant="default" style={styles.card}>
        <Text style={styles.sectionTitle}>Effective Permissions ({permissions.length})</Text>
        <View style={styles.chipsWrap}>
          {permissions.map((perm) => (
            <View key={perm} style={styles.permChip}>
              <Text style={styles.permText}>{perm}</Text>
            </View>
          ))}
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          title="Password & Security"
          variant="outline"
          leftIcon={<MobileIcon name="lock" size="sm" />}
          onPress={() => router.push("/(account)/security")}
          fullWidth
        />
        <Button
          title="Active Sessions"
          variant="outline"
          leftIcon={<MobileIcon name="smartphone" size="sm" />}
          onPress={() => router.push("/(account)/sessions")}
          fullWidth
        />
        <Button
          title="Sign Out"
          variant="danger"
          leftIcon={<MobileIcon name="log-out" size="sm" color={mobileColors.white} />}
          onPress={() => setConfirmLogout(true)}
          fullWidth
        />
      </View>

      <ConfirmDialog
        visible={confirmLogout}
        title="Sign Out"
        description="Sign out from this device?"
        confirmLabel="Sign Out"
        destructive
        icon="log-out"
        isLoading={isLoggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    alignItems: "center",
    gap: mobileSpacing[2],
    marginBottom: mobileSpacing[4]
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.navy[900],
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: mobileColors.white,
    fontSize: 26,
    fontWeight: "800"
  },
  displayName: {
    ...mobileTypography.headingLg
  },
  emailText: {
    ...mobileTypography.bodyMd,
    color: mobileTextColors.muted
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: mobileSpacing[2],
    marginTop: mobileSpacing[1]
  },
  verifyCallout: {
    width: "100%",
    backgroundColor: mobileStatusTokens.warningBg,
    borderWidth: 1,
    borderColor: mobileStatusTokens.warningBorder,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing[3],
    gap: mobileSpacing[2],
    marginTop: mobileSpacing[2]
  },
  verifyCalloutText: {
    ...mobileTypography.bodySm,
    color: mobileStatusTokens.warning
  },
  card: {
    gap: mobileSpacing[3],
    marginBottom: mobileSpacing[4]
  },
  sectionTitle: {
    ...mobileTypography.headingSm
  },
  helperNote: {
    ...mobileTypography.bodySm
  },
  detailRow: {
    gap: 4,
    paddingVertical: mobileSpacing[1],
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.sand[100]
  },
  detailLabel: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.muted
  },
  detailMono: {
    ...mobileTypography.codeMono,
    fontSize: 12
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing[2]
  },
  permChip: {
    backgroundColor: mobileColors.sand[100],
    borderRadius: mobileRadius.sm,
    paddingHorizontal: mobileSpacing[2],
    paddingVertical: 4
  },
  permText: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.navy[900],
    fontFamily: "monospace"
  },
  actions: {
    gap: mobileSpacing[3],
    marginBottom: mobileSpacing[6]
  }
});
