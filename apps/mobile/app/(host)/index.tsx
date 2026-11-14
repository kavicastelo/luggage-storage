import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  MascotIllustration,
  MobileIcon,
  SafeHeader,
  ScreenContainer,
  StatusBadge,
  formatColomboDateTime
} from "../../src/components";
import {
  useCapacityPoolsQuery,
  useHostBookingsQuery,
  useOwnedBusinessesQuery,
  useOwnedLocationsQuery
} from "../../src/hooks";
import { normalizeApiError } from "../../src/services/api-client";
import { useMobileStore } from "../../src/store/useMobileStore";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

export default function HostLiveDeskScreen() {
  const router = useRouter();
  const { selectedHostLocationId, setSelectedHostLocationId } = useMobileStore();

  const businessesQuery = useOwnedBusinessesQuery(true);
  const locationsQuery = useOwnedLocationsQuery(true);
  const bookingsQuery = useHostBookingsQuery({ limit: 50 }, true);

  const businesses = businessesQuery.data ?? [];
  const locations = locationsQuery.data ?? [];
  const activeLocation = useMemo(
    () => locations.find((l) => l.id === selectedHostLocationId) ?? locations[0] ?? null,
    [locations, selectedHostLocationId]
  );

  const poolsQuery = useCapacityPoolsQuery(activeLocation?.id, Boolean(activeLocation?.id));

  const bookings = bookingsQuery.data?.bookings ?? [];
  const scopedBookings = useMemo(() => {
    if (!activeLocation) {
      return bookings;
    }
    const atActive = bookings.filter((b) => b.locationId === activeLocation.id);
    return atActive.length > 0 ? atActive : bookings;
  }, [bookings, activeLocation]);

  const expectedToday = scopedBookings.filter((b) => b.status === "CONFIRMED");
  const pendingApproval = scopedBookings.filter((b) => b.status === "PENDING_HOST_APPROVAL");
  const storedInVault = scopedBookings.filter((b) => b.status === "IN_STORAGE");
  const storedBagsCount = storedInVault.reduce((sum, b) => sum + b.totalBags, 0);

  const pools = poolsQuery.data ?? [];
  const totalCapacityUnits = pools
    .filter((p) => p.isActive)
    .reduce((sum, p) => sum + p.totalUnits, 0);
  const occupancyRatio =
    totalCapacityUnits > 0 ? Math.min(1, storedBagsCount / totalCapacityUnits) : 0;

  const isLoading = businessesQuery.isLoading || locationsQuery.isLoading || bookingsQuery.isLoading;

  const handleRefresh = async () => {
    await Promise.all([
      businessesQuery.refetch(),
      locationsQuery.refetch(),
      bookingsQuery.refetch(),
      activeLocation?.id ? poolsQuery.refetch() : Promise.resolve()
    ]);
  };

  return (
    <ScreenContainer
      header={
        <SafeHeader
          title="Desk Counter Active"
          subtitle={activeLocation ? `${activeLocation.name} • ${activeLocation.city}` : "Partner Desk"}
          rightAction={
            <Button
              title="Hubs"
              size="sm"
              variant="outline"
              onPress={() => router.push("/(host)/locations")}
            />
          }
        />
      }
      refreshing={bookingsQuery.isRefetching || locationsQuery.isRefetching}
      onRefresh={() => {
        void handleRefresh();
      }}
      testID="host-live-desk-screen"
    >
      {isLoading ? (
        <LoadingSkeleton count={4} />
      ) : businessesQuery.isError || locationsQuery.isError ? (
        <ErrorState
          title="Unable to Load Partner Desk"
          message={
            normalizeApiError(businessesQuery.error || locationsQuery.error).message
          }
          onRetry={() => {
            void handleRefresh();
          }}
        />
      ) : businesses.length === 0 ? (
        <EmptyState
          mascot="salute"
          title="Complete Business Onboarding"
          description="Register your partner business and upload KYC documents before accepting guest luggage."
          actionTitle="Start Onboarding"
          onAction={() => router.push("/(host)/onboarding")}
        />
      ) : locations.length === 0 ? (
        <EmptyState
          mascot="map"
          title="Add Your First Storage Hub"
          description="Configure address, photos, opening hours, capacity pools, and LKR pricing to go live."
          actionTitle="Create Storage Hub"
          onAction={() => router.push("/(host)/location-editor")}
        />
      ) : (
        <View style={styles.stack}>
          <Card variant="navy" style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.heroTextCol}>
                <Badge label="Desk Counter Active" variant="success" size="sm" />
                <Text style={styles.heroTitle}>{activeLocation?.name}</Text>
                <Text style={styles.heroSub}>
                  {activeLocation?.addressLine1}, {activeLocation?.city}
                </Text>
              </View>
              <MascotIllustration mascot="salute" size="sm" />
            </View>

            <View style={styles.heroActionsRow}>
              <Button
                title="Scan Luggage Pass"
                leftIcon={<MobileIcon name="camera" size={16} color={mobileColors.white} />}
                onPress={() => router.push("/(host)/scanner")}
                style={styles.flexBtn}
              />
              <Button
                title="Manual Intake"
                variant="secondary"
                leftIcon={<MobileIcon name="package-check" size={16} color={mobileColors.white} />}
                onPress={() => router.push("/(host)/requests")}
                style={styles.flexBtn}
              />
            </View>
          </Card>

          {locations.length > 1 ? (
            <Card variant="default" style={styles.hubSwitchCard}>
              <Text style={styles.sectionLabel}>Active Storage Hub</Text>
              <View style={styles.hubRow}>
                {locations.map((loc) => (
                  <Button
                    key={loc.id}
                    title={loc.name}
                    size="sm"
                    variant={loc.id === activeLocation?.id ? "primary" : "outline"}
                    onPress={() => setSelectedHostLocationId(loc.id)}
                  />
                ))}
              </View>
            </Card>
          ) : null}

          <Card variant="elevated" style={styles.cardGap}>
            <View style={styles.capHeader}>
              <Text style={styles.sectionTitle}>Physical Vault Capacity</Text>
              <Text style={styles.capNumbers}>
                {storedBagsCount} / {totalCapacityUnits || "—"} bags
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${Math.round(occupancyRatio * 100)}%` }]}
              />
            </View>
            <Text style={styles.capHint}>
              {totalCapacityUnits > 0
                ? `${Math.max(0, totalCapacityUnits - storedBagsCount)} physical unit(s) open across ${pools.length} pool(s).`
                : "Configure capacity pools in Storage Hubs to track live occupancy."}
            </Text>
          </Card>

          <View style={styles.kpiGrid}>
            <Card variant="default" style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Expected Today</Text>
              <Text style={styles.kpiValue}>{expectedToday.length}</Text>
              <Text style={styles.kpiHint}>Ready for check-in</Text>
            </Card>
            <Card variant="default" style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Vault Stored</Text>
              <Text style={styles.kpiValue}>{storedInVault.length}</Text>
              <Text style={styles.kpiHint}>{storedBagsCount} bag(s) held</Text>
            </Card>
          </View>

          {pendingApproval.length > 0 ? (
            <Card variant="outlined" style={styles.approvalAlert}>
              <Text style={styles.approvalTitle}>
                {pendingApproval.length} Request(s) Awaiting Approval
              </Text>
              <Button
                title="Review Pending Requests"
                size="sm"
                onPress={() => router.push("/(host)/requests")}
              />
            </Card>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Movement Queue</Text>
            <Button
              title="All Bookings"
              size="sm"
              variant="ghost"
              onPress={() => router.push("/(host)/requests")}
            />
          </View>

          {expectedToday.length === 0 && storedInVault.length === 0 ? (
            <EmptyState
              mascot="suitcase-walk"
              title="No Active Check-ins or Releases"
              description="Confirmed arrivals and stored luggage awaiting handover will appear in your live movement queue."
            />
          ) : (
            [...expectedToday, ...storedInVault].map((booking) => (
              <Card key={booking.id} variant="elevated" style={styles.cardGap}>
                <View style={styles.queueHeader}>
                  <View style={styles.flexCol}>
                    <Text style={styles.refCode}>#{booking.referenceCode}</Text>
                    <Text style={styles.queueTitle}>{booking.location.name}</Text>
                  </View>
                  <StatusBadge status={booking.status} size="sm" />
                </View>

                <Text style={styles.queueMeta}>
                  {booking.totalBags} bag(s) • Drop-off:{" "}
                  {formatColomboDateTime(new Date(booking.dropOffAt))}
                </Text>

                <View style={styles.heroActionsRow}>
                  <Button
                    title="Verify QR / PIN"
                    size="sm"
                    variant="outline"
                    onPress={() =>
                      router.push({
                        pathname: "/(host)/scanner",
                        params: { bookingId: booking.id }
                      })
                    }
                    style={styles.flexBtn}
                  />
                  <Button
                    title={booking.status === "CONFIRMED" ? "Check-In Bags" : "Release Vault"}
                    size="sm"
                    onPress={() =>
                      router.push({
                        pathname:
                          booking.status === "CONFIRMED" ? "/(host)/intake" : "/(host)/vault",
                        params: { bookingId: booking.id }
                      })
                    }
                    style={styles.flexBtn}
                  />
                </View>
              </Card>
            ))
          )}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: mobileSpacing[4]
  },
  heroCard: {
    gap: mobileSpacing[3]
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: mobileSpacing[3]
  },
  heroTextCol: {
    flex: 1,
    gap: 4
  },
  heroTitle: {
    ...mobileTypography.headingLg,
    color: mobileColors.white
  },
  heroSub: {
    ...mobileTypography.bodySm,
    color: mobileColors.sand[200]
  },
  heroActionsRow: {
    flexDirection: "row",
    gap: mobileSpacing[2]
  },
  flexBtn: {
    flex: 1
  },
  hubSwitchCard: {
    gap: mobileSpacing[2]
  },
  sectionLabel: {
    ...mobileTypography.label,
    color: mobileTextColors.primary
  },
  hubRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  cardGap: {
    gap: mobileSpacing[3]
  },
  capHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    ...mobileTypography.headingSm,
    color: mobileTextColors.primary
  },
  capNumbers: {
    ...mobileTypography.label,
    color: mobileColors.navy[900]
  },
  progressTrack: {
    height: 10,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.sand[200],
    overflow: "hidden"
  },
  progressFill: {
    height: 10,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.emerald[600]
  },
  capHint: {
    fontSize: 12,
    lineHeight: 16,
    color: mobileTextColors.secondary
  },
  kpiGrid: {
    flexDirection: "row",
    gap: mobileSpacing[3]
  },
  kpiCard: {
    flex: 1,
    gap: 2
  },
  kpiLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: mobileTextColors.muted
  },
  kpiValue: {
    ...mobileTypography.displaySm,
    color: mobileColors.navy[900]
  },
  kpiHint: {
    fontSize: 12,
    lineHeight: 16,
    color: mobileTextColors.secondary
  },
  approvalAlert: {
    backgroundColor: mobileStatusTokens.warningBg,
    borderColor: mobileStatusTokens.warningBorder,
    gap: mobileSpacing[2]
  },
  approvalTitle: {
    ...mobileTypography.label,
    color: mobileStatusTokens.warning
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: mobileSpacing[2]
  },
  flexCol: {
    flex: 1
  },
  refCode: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.terracotta[600]
  },
  queueTitle: {
    ...mobileTypography.headingSm,
    color: mobileTextColors.primary
  },
  queueMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: mobileTextColors.secondary
  }
});
