import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  LoadingSkeleton,
  MobileIcon,
  SafeHeader,
  ScreenContainer,
  StatusBadge,
  type MobileIconName
} from "../../src/components";
import { useOwnedBusinessesQuery, useOwnedLocationsQuery } from "../../src/hooks";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useMobileStore } from "../../src/store/useMobileStore";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

function SettingsMenuRow({
  icon,
  title,
  subtitle,
  onPress
}: {
  icon: MobileIconName;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
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
      <View style={styles.menuCol}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSub}>{subtitle}</Text>
      </View>
      <MobileIcon name="chevron-right" size={18} color={mobileTextColors.muted} />
    </TouchableOpacity>
  );
}

export default function HostSettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { setRole } = useMobileStore();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const isOwner = Boolean(
    user?.roles?.includes("HOST_OWNER") || user?.roles?.includes("SUPERADMIN")
  );

  const businessesQuery = useOwnedBusinessesQuery(isOwner);
  const locationsQuery = useOwnedLocationsQuery(isOwner);

  if (!isOwner) {
    return (
      <ScreenContainer
        header={<SafeHeader title="Storage Partner Profile" />}
        testID="host-settings-forbidden"
      >
        <Card variant="outlined" style={styles.deniedCard}>
          <Text style={styles.deniedBadge}>RBAC Guard • 403 Forbidden</Text>
          <Text style={styles.deniedTitle}>Host Owner Access Required</Text>
          <Text style={styles.deniedBody}>
            Partner business configuration and hub management require HOST_OWNER or SUPERADMIN
            permissions.
          </Text>
          <Button
            title="Return to Live Desk"
            onPress={() => router.replace("/(host)")}
          />
        </Card>
      </ScreenContainer>
    );
  }

  const business = businessesQuery.data?.[0] ?? null;
  const locationsCount = locationsQuery.data?.length ?? 0;

  return (
    <ScreenContainer
      header={
        <SafeHeader
          title="Storage Partner Profile"
          subtitle="Business Governance & Workspace Settings"
        />
      }
      testID="host-settings-screen"
    >
      {businessesQuery.isLoading ? (
        <LoadingSkeleton count={3} />
      ) : (
        <View style={styles.stack}>
          <Card variant="elevated" style={styles.cardGap}>
            <View style={styles.rowBetween}>
              <View style={styles.flexCol}>
                <Text style={styles.bizName}>
                  {business?.tradeName || "Partner Setup Incomplete"}
                </Text>
                <Text style={styles.bizLegal}>
                  {business?.legalBusinessName || user?.email}
                </Text>
              </View>
              {business ? <StatusBadge status={business.status} size="sm" /> : null}
            </View>
            <View style={styles.badgesRow}>
              <Badge
                label={`${locationsCount} Storage Hub(s)`}
                variant="navy"
                size="sm"
              />
              {business?.payoutAccountNumberMasked ? (
                <Badge
                  label={`Payout: ${business.payoutAccountNumberMasked}`}
                  variant="success"
                  size="sm"
                />
              ) : null}
            </View>
          </Card>

          <Card variant="default" style={styles.menuCard}>
            <SettingsMenuRow
              icon="building"
              title="Business Profile, KYC & Bank Payouts"
              subtitle="Edit legal business info, upload verification docs, update LKR bank account"
              onPress={() => router.push("/(host)/onboarding")}
            />
            <SettingsMenuRow
              icon="map-pin"
              title="My Storage Hubs & Availability"
              subtitle="Configure addresses, facility photos, 7-day hours, zones, capacity & pricing"
              onPress={() => router.push("/(host)/locations")}
            />
            <SettingsMenuRow
              icon="lock"
              title="Account Security & Password"
              subtitle="Update password and sign out other devices"
              onPress={() => router.push("/(account)/security")}
            />
            <SettingsMenuRow
              icon="smartphone"
              title="Active Sign-In Sessions"
              subtitle="Audit and revoke active partner device tokens"
              onPress={() => router.push("/(account)/sessions")}
            />
          </Card>

          <Card variant="outlined" style={styles.staffNoticeCard}>
            <Text style={styles.noticeTitle}>Counter Staff Access</Text>
            <Text style={styles.noticeBody}>
              Dedicated self-service staff invitation links are not currently exposed in the API
              contract. Counter staff accounts with assigned HOST_STAFF permissions can sign in
              directly to access Live Desk, Requests, Scanner, Intake, and Vault.
            </Text>
          </Card>

          <Button
            title="Switch to Traveller Mode"
            variant="secondary"
            leftIcon={<MobileIcon name="compass" size={16} color={mobileColors.white} />}
            onPress={() => {
              setRole("traveller");
              router.replace("/(traveller)");
            }}
          />

          <Button
            title="Sign Out"
            variant="danger"
            leftIcon={<MobileIcon name="log-out" size={16} color={mobileColors.white} />}
            onPress={() => setConfirmSignOut(true)}
          />
        </View>
      )}

      <ConfirmDialog
        visible={confirmSignOut}
        title="Sign Out of Partner Workspace?"
        description="Your local cache will be cleared and refresh credentials revoked."
        confirmLabel="Sign Out"
        destructive
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={() => {
          setConfirmSignOut(false);
          void logout().then(() => {
            router.replace("/(auth)/login");
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
  },
  cardGap: {
    gap: mobileSpacing[2]
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: mobileSpacing[2]
  },
  flexCol: {
    flex: 1
  },
  bizName: {
    ...mobileTypography.headingMd,
    color: mobileTextColors.primary
  },
  bizLegal: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.secondary
  },
  badgesRow: {
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
  menuCol: {
    flex: 1
  },
  menuTitle: {
    ...mobileTypography.label,
    color: mobileTextColors.primary
  },
  menuSub: {
    fontSize: 12,
    lineHeight: 16,
    color: mobileTextColors.muted
  },
  staffNoticeCard: {
    gap: 4,
    backgroundColor: mobileColors.sand[50]
  },
  noticeTitle: {
    ...mobileTypography.label,
    color: mobileTextColors.primary
  },
  noticeBody: {
    fontSize: 12,
    lineHeight: 16,
    color: mobileTextColors.secondary
  }
});
