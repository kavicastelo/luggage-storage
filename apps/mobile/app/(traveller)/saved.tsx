import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { DEMO_LOCATIONS, StorageLocationItem } from "../../src/data/mock-marketplace";
import { Card, Button, Badge, MobileIcon, MascotIllustration } from "../../src/components";
import { mobileColors, mobileTypography } from "../../src/lib/theme";

export default function TravellerSavedScreen() {
  const router = useRouter();

  // Saved location IDs state (defaults to 3 bookmarked transit hubs)
  const [savedIds, setSavedIds] = useState<string[]>([
    "loc-cmb-fort-01",
    "loc-ella-02",
    "loc-kandy-03"
  ]);

  const savedLocations = DEMO_LOCATIONS.filter((l) => savedIds.includes(l.id));

  const toggleSave = (id: string) => {
    setSavedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <View style={styles.screenWrapper}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Coastal Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Saved Storage Spots</Text>
          <Text style={styles.headerSubtitle}>
            Your bookmarked hubs near railway stations & coastal destinations
          </Text>
        </View>

        {savedLocations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MascotIllustration
              mascot="suitcase-peek"
              size="md"
              caption="You don't have any saved spots yet. Browse storage spots and tap the bookmark icon to save them for your trip!"
            />
            <Button
              title="Explore Storage Locations"
              variant="primary"
              onPress={() => router.push("/(traveller)")}
              style={{ marginTop: 16 }}
            />
          </View>
        ) : (
          <View style={styles.list}>
            {savedLocations.map((loc: StorageLocationItem) => (
              <Card key={loc.id} style={styles.locationCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.badgeRow}>
                      <Badge label={loc.city} variant="navy" size="sm" />
                      <Badge
                        label={`LKR ${loc.hourlyRateLkr.MEDIUM}/hr`}
                        variant="terracotta"
                        size="sm"
                      />
                      {loc.is24Hours ? (
                        <Badge label="24/7 OPEN" variant="success" size="sm" />
                      ) : null}
                    </View>
                    <Text style={styles.locationName}>{loc.name}</Text>
                    <Text style={styles.landmarkText}>{loc.landmark}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.bookmarkBtn}
                    onPress={() => toggleSave(loc.id)}
                    accessibilityLabel="Remove from saved"
                  >
                    <MobileIcon name="bookmark" size={20} color={mobileColors.terracotta[500]} />
                  </TouchableOpacity>
                </View>

                {/* Rating & Capacity */}
                <View style={styles.metaRow}>
                  <View style={styles.ratingBox}>
                    <MobileIcon name="star" size={13} color={mobileColors.amber[600]} />
                    <Text style={styles.ratingText}>
                      {loc.rating} ({loc.reviewCount} verified reviews)
                    </Text>
                  </View>
                  <Text style={styles.capacityText}>
                    {loc.availableCapacity} spots available
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                  <Button
                    title="View Details"
                    variant="outline"
                    size="sm"
                    onPress={() =>
                      router.push({
                        pathname: "/(traveller)/location",
                        params: { id: loc.id }
                      })
                    }
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Book Now"
                    variant="primary"
                    size="sm"
                    onPress={() =>
                      router.push({
                        pathname: "/(traveller)/checkout",
                        params: { locId: loc.id }
                      })
                    }
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  container: {
    paddingBottom: 40
  },
  header: {
    backgroundColor: mobileColors.navy[900],
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 16
  },
  headerTitle: {
    ...mobileTypography.headingLg,
    color: mobileColors.white
  },
  headerSubtitle: {
    ...mobileTypography.bodySm,
    color: mobileColors.sand[400],
    marginTop: 2
  },
  list: {
    paddingHorizontal: 16,
    gap: 14
  },
  locationCard: {
    padding: 16
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6
  },
  locationName: {
    ...mobileTypography.headingSm,
    color: mobileColors.navy[900],
    marginBottom: 2
  },
  landmarkText: {
    fontSize: 12,
    color: mobileColors.sand[600]
  },
  bookmarkBtn: {
    padding: 8
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: mobileColors.sand[100],
    marginVertical: 10
  },
  ratingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.navy[900]
  },
  capacityText: {
    fontSize: 12,
    color: mobileColors.emerald[700],
    fontWeight: "600"
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center"
  }
});
