import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet
} from "react-native";
import { useRouter } from "expo-router";
import { DEMO_LOCATIONS, StorageLocationItem } from "../../src/data/mock-marketplace";
import { Card, Button, Badge, MobileIcon, MascotIllustration } from "../../src/components";
import { mobileColors, mobileRadius, mobileTypography } from "../../src/lib/theme";

export default function TravellerExploreScreen() {
  const router = useRouter();
  const [selectedLocation, setSelectedLocation] = useState<StorageLocationItem>(DEMO_LOCATIONS[0]);

  return (
    <View style={styles.screenWrapper}>
      {/* Top Navigation */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to Explore"
        >
          <MobileIcon name="chevron-left" size={20} color={mobileColors.white} />
          <Text style={styles.backButtonText}>Explore</Text>
        </TouchableOpacity>
        <Text style={styles.topNavTitle}>Geospatial Map Discovery</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Interactive Map Visual Container */}
        <View style={styles.mapCanvas}>
          <View style={styles.mapOverlayHeader}>
            <View>
              <Text style={styles.mapHeaderTitle}>Sri Lanka Transit Map</Text>
              <Text style={styles.mapHeaderSubtitle}>
                Select a station pin to view partner details & live availability
              </Text>
            </View>
            <Badge label="OPENSTREETMAP TILES" variant="navy" size="sm" />
          </View>

          {/* Interactive Map Pins */}
          <View style={styles.pinsContainer}>
            {DEMO_LOCATIONS.map((loc) => {
              const isSelected = loc.id === selectedLocation.id;
              return (
                <TouchableOpacity
                  key={loc.id}
                  style={[styles.pinButton, isSelected && styles.pinButtonActive]}
                  onPress={() => setSelectedLocation(loc)}
                  accessibilityLabel={`Select ${loc.name}`}
                >
                  <MobileIcon
                    name="map-pin"
                    size={14}
                    color={isSelected ? mobileColors.white : mobileColors.terracotta[500]}
                  />
                  <Text style={[styles.pinText, isSelected && styles.pinTextActive]}>
                    {loc.city}: LKR {loc.hourlyRateLkr.MEDIUM}/hr
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selected Location Bottom Sheet / Card */}
        <Card style={styles.selectedCard} variant="elevated">
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <Badge label={selectedLocation.city} variant="navy" size="sm" />
                {selectedLocation.is24Hours ? (
                  <Badge label="24/7 OPEN" variant="success" size="sm" />
                ) : (
                  <Badge label={selectedLocation.openHours} variant="neutral" size="sm" />
                )}
                <Badge
                  label={`${selectedLocation.availableCapacity} / ${selectedLocation.totalCapacity} Available`}
                  variant="info"
                  size="sm"
                />
              </View>
              <Text style={styles.locationTitle}>{selectedLocation.name}</Text>
              <Text style={styles.landmarkText}>{selectedLocation.landmark}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.verifiedHostBox}>
              <MobileIcon name="shield" size={14} color={mobileColors.emerald[700]} />
              <Text style={styles.verifiedHostName}>{selectedLocation.verifiedHost}</Text>
            </View>
            <View style={styles.ratingBox}>
              <MobileIcon name="star" size={14} color={mobileColors.amber[600]} />
              <Text style={styles.ratingText}>
                {selectedLocation.rating} ({selectedLocation.reviewCount})
              </Text>
            </View>
          </View>

          <View style={styles.pricingRow}>
            <View>
              <Text style={styles.rateLabel}>Hourly Rate (Cabin Bag)</Text>
              <Text style={styles.rateValue}>
                LKR {selectedLocation.hourlyRateLkr.MEDIUM}
                <Text style={styles.rateUnit}> / hr</Text>
              </Text>
              <Text style={styles.dailyCapText}>
                Max LKR {selectedLocation.dailyCapLkr.MEDIUM} / day
              </Text>
            </View>
            <View style={styles.actionsRow}>
              <Button
                title="View Dossier"
                variant="outline"
                size="sm"
                onPress={() =>
                  router.push({
                    pathname: "/(traveller)/location",
                    params: { id: selectedLocation.id }
                  })
                }
              />
              <Button
                title="Book Storage"
                variant="primary"
                size="sm"
                onPress={() =>
                  router.push({
                    pathname: "/(traveller)/checkout",
                    params: { locId: selectedLocation.id }
                  })
                }
              />
            </View>
          </View>
        </Card>

        {/* All Location Cards List */}
        <View style={styles.listSection}>
          <Text style={styles.listHeading}>All Sri Lanka Storage Locations</Text>
          {DEMO_LOCATIONS.map((loc) => {
            const isSelected = loc.id === selectedLocation.id;
            return (
              <TouchableOpacity
                key={loc.id}
                style={[styles.miniCard, isSelected && styles.miniCardActive]}
                onPress={() => setSelectedLocation(loc)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniCardCity}>{loc.city}</Text>
                  <Text style={styles.miniCardName}>{loc.name}</Text>
                  <Text style={styles.miniCardPrice}>
                    LKR {loc.hourlyRateLkr.MEDIUM}/hr • Cap LKR {loc.dailyCapLkr.MEDIUM}
                  </Text>
                </View>
                <MobileIcon
                  name="chevron-right"
                  size={16}
                  color={isSelected ? mobileColors.terracotta[500] : mobileColors.sand[400]}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <MascotIllustration
          mascot="map"
          size="sm"
          caption={`Selected transit pin: ${selectedLocation.name} (${selectedLocation.coordinates.lat}° N, ${selectedLocation.coordinates.lng}° E)`}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  topNav: {
    backgroundColor: mobileColors.navy[900],
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingRight: 10
  },
  backButtonText: {
    color: mobileColors.white,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 2
  },
  topNavTitle: {
    color: mobileColors.white,
    fontSize: 15,
    fontWeight: "700"
  },
  container: {
    paddingBottom: 40
  },
  mapCanvas: {
    backgroundColor: mobileColors.navy[950],
    padding: 16,
    minHeight: 220,
    justifyContent: "space-between"
  },
  mapOverlayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16
  },
  mapHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.white
  },
  mapHeaderSubtitle: {
    fontSize: 11,
    color: mobileColors.sand[400],
    marginTop: 2,
    maxWidth: 240
  },
  pinsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 10
  },
  pinButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: mobileRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6
  },
  pinButtonActive: {
    backgroundColor: mobileColors.terracotta[500],
    borderColor: mobileColors.terracotta[400]
  },
  pinText: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.sand[100]
  },
  pinTextActive: {
    color: mobileColors.white
  },
  selectedCard: {
    margin: 16,
    marginTop: -12,
    padding: 16
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6
  },
  locationTitle: {
    ...mobileTypography.headingSm,
    color: mobileColors.navy[900],
    marginBottom: 2
  },
  landmarkText: {
    fontSize: 11,
    color: mobileColors.sand[600]
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
  verifiedHostBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  verifiedHostName: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.navy[900]
  },
  ratingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end"
  },
  rateLabel: {
    fontSize: 10,
    color: mobileColors.sand[600]
  },
  rateValue: {
    fontSize: 16,
    fontWeight: "800",
    color: mobileColors.terracotta[500]
  },
  rateUnit: {
    fontSize: 11,
    color: mobileColors.sand[700],
    fontWeight: "500"
  },
  dailyCapText: {
    fontSize: 10,
    color: mobileColors.sand[600]
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8
  },
  listSection: {
    paddingHorizontal: 16,
    marginBottom: 16
  },
  listHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginBottom: 8
  },
  miniCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.white,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    marginBottom: 8
  },
  miniCardActive: {
    borderColor: mobileColors.terracotta[500],
    backgroundColor: mobileColors.terracotta[50]
  },
  miniCardCity: {
    fontSize: 10,
    fontWeight: "800",
    color: mobileColors.terracotta[600],
    textTransform: "uppercase"
  },
  miniCardName: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.navy[900],
    marginVertical: 2
  },
  miniCardPrice: {
    fontSize: 11,
    color: mobileColors.sand[600]
  }
});
