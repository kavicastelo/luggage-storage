import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingSkeleton,
  LocationCard,
  SafeHeader,
  ScreenContainer
} from "../../../src/components";
import { useSavedLocationsDetailsQuery } from "../../../src/hooks";
import { useSavedLocationsStore } from "../../../src/store/useSavedLocationsStore";
import { mobileSpacing, mobileTextColors, mobileTypography } from "../../../src/lib/theme";

export default function TravellerSavedLocationsScreen() {
  const router = useRouter();
  const { savedIds, hydrate, toggleSaved, removeSaved, hasHydrated } =
    useSavedLocationsStore();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const savedQuery = useSavedLocationsDetailsQuery(savedIds);

  return (
    <ScreenContainer
      header={<SafeHeader title="Saved Hubs" subtitle="Bookmarked on this device" />}
      refreshing={savedQuery.isFetching}
      onRefresh={() => {
        void savedQuery.refetchAll();
      }}
      testID="traveller-saved-screen"
    >
      <View style={styles.scopeRow}>
        <Badge label="Saved on this device" variant="neutral" icon="smartphone" size="sm" />
      </View>

      {!hasHydrated || savedQuery.isLoading ? (
        <LoadingSkeleton count={2} />
      ) : savedIds.length === 0 ? (
        <EmptyState
          mascot="map"
          title="No Saved Hubs Yet"
          description="Tap the bookmark icon on any Colombo, Kandy, or Galle hub to keep it handy while planning."
          actionTitle="Discover Storage Hubs"
          onAction={() => router.replace("/(traveller)")}
        />
      ) : (
        <View style={styles.stack}>
          {savedQuery.items.map((loc) => (
            <LocationCard
              key={loc.id}
              location={loc}
              isSaved
              onToggleSaved={() => {
                void toggleSaved(loc.id);
              }}
              onPress={() =>
                router.push({
                  pathname: "/(traveller)/location",
                  params: { id: loc.id }
                })
              }
            />
          ))}

          {savedQuery.failedIds.map((missingId) => (
            <Card key={missingId} variant="outlined" style={styles.missingCard}>
              <Text style={styles.missingTitle}>Unavailable Listing ({missingId.slice(0, 8)}...)</Text>
              <Text style={styles.missingBody}>
                This saved hub is currently inactive or could not be fetched.
              </Text>
              <Button
                title="Remove Unavailable Listing"
                variant="outline"
                size="sm"
                onPress={() => {
                  void removeSaved(missingId);
                }}
              />
            </Card>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scopeRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  stack: {
    gap: mobileSpacing[4]
  },
  missingCard: {
    gap: mobileSpacing[2]
  },
  missingTitle: {
    ...mobileTypography.headingSm,
    color: mobileTextColors.primary
  },
  missingBody: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileTextColors.secondary
  }
});
