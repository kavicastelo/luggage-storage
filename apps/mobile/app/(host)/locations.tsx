import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  MobileIcon,
  SafeHeader,
  ScreenContainer,
  StatusBadge
} from "../../src/components";
import { useOwnedBusinessesQuery, useOwnedLocationsQuery } from "../../src/hooks";
import { normalizeApiError } from "../../src/services/api-client";
import { useMobileStore } from "../../src/store/useMobileStore";
import {
  mobileColors,
  mobileSpacing,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

export default function HostLocationsScreen() {
  const router = useRouter();
  const businessesQuery = useOwnedBusinessesQuery(true);
  const locationsQuery = useOwnedLocationsQuery(true);
  const { selectedHostLocationId, setSelectedHostLocationId } = useMobileStore();

  const business = businessesQuery.data?.[0] ?? null;
  const locations = locationsQuery.data ?? [];

  return (
    <ScreenContainer
      header={
        <SafeHeader
          title="My Storage Hubs"
          subtitle={business ? business.tradeName : "Sri Lanka Partner Locations"}
          onBack={() => router.back()}
          rightAction={
            <Button
              title="New Hub"
              size="sm"
              leftIcon={<MobileIcon name="plus" size={14} color={mobileColors.white} />}
              onPress={() => router.push("/(host)/location-editor")}
            />
          }
        />
      }
      refreshing={locationsQuery.isRefetching}
      onRefresh={() => {
        void locationsQuery.refetch();
      }}
      testID="host-locations-screen"
    >
      {locationsQuery.isLoading ? (
        <LoadingSkeleton count={3} />
      ) : locationsQuery.isError ? (
        <ErrorState
          title="Unable to Load Storage Hubs"
          message={normalizeApiError(locationsQuery.error).message}
          onRetry={() => {
            void locationsQuery.refetch();
          }}
        />
      ) : locations.length === 0 ? (
        <EmptyState
          mascot="map"
          title="No Storage Hubs Configured Yet"
          description="Create your first storage hub with photos, opening hours, storage zones, capacity pools, and LKR pricing."
          actionTitle={business ? "Create First Storage Hub" : "Complete Business Onboarding"}
          onAction={() =>
            router.push(business ? "/(host)/location-editor" : "/(host)/onboarding")
          }
        />
      ) : (
        <View style={styles.stack}>
          {locations.map((loc) => {
            const isActiveDesk = selectedHostLocationId === loc.id;
            return (
              <Card key={loc.id} variant="elevated" style={styles.hubCard}>
                <View style={styles.headerRow}>
                  <View style={styles.titleCol}>
                    <Text style={styles.hubName}>{loc.name}</Text>
                    <Text style={styles.hubAddr}>
                      {loc.addressLine1}, {loc.city}
                    </Text>
                  </View>
                  <StatusBadge status={loc.status} size="sm" />
                </View>

                <View style={styles.metaRow}>
                  <Badge label={loc.bookingMode} variant="navy" size="sm" />
                  <Badge
                    label={`${loc.images?.length ?? 0} photo(s)`}
                    variant="neutral"
                    size="sm"
                  />
                  {isActiveDesk ? (
                    <Badge label="Active Live Desk Hub" variant="success" size="sm" />
                  ) : null}
                </View>

                <View style={styles.actionsRow}>
                  {!isActiveDesk ? (
                    <Button
                      title="Select for Desk"
                      size="sm"
                      variant="outline"
                      onPress={() => setSelectedHostLocationId(loc.id)}
                      style={styles.flexBtn}
                    />
                  ) : null}
                  <Button
                    title="Configure Hub"
                    size="sm"
                    leftIcon={<MobileIcon name="settings" size={14} color={mobileColors.white} />}
                    onPress={() =>
                      router.push({
                        pathname: "/(host)/location-editor",
                        params: { id: loc.id }
                      })
                    }
                    style={styles.flexBtn}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: mobileSpacing[4]
  },
  hubCard: {
    gap: mobileSpacing[3]
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: mobileSpacing[2]
  },
  titleCol: {
    flex: 1,
    gap: 2
  },
  hubName: {
    ...mobileTypography.headingSm,
    color: mobileTextColors.primary
  },
  hubAddr: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.secondary
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  actionsRow: {
    flexDirection: "row",
    gap: mobileSpacing[2]
  },
  flexBtn: {
    flex: 1
  }
});
