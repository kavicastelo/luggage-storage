import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal
} from "react-native";
import { useRouter } from "expo-router";
import {
  DEMO_LOCATIONS,
  DEMO_BOOKINGS,
  StorageLocationItem
} from "../../src/data/mock-marketplace";
import { Card, Button, Badge, MobileIcon, MobileDevDrawer } from "../../src/components";
import { mobileColors, mobileRadius, mobileTypography } from "../../src/lib/theme";

const DESTINATION_CHIPS = [
  "All",
  "Colombo",
  "Ella",
  "Kandy",
  "Galle",
  "Katunayake",
  "Mirissa"
] as const;

export default function TravellerExploreHubScreen() {
  const router = useRouter();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDestination, setSelectedDestination] = useState<string>("All");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filter24HoursOnly, setFilter24HoursOnly] = useState(false);
  const [filterCctvOnly, setFilterCctvOnly] = useState(false);
  const [filterClimateOnly, setFilterClimateOnly] = useState(false);
  const [filterMaxDailyPrice, setFilterMaxDailyPrice] = useState<number | null>(null);

  // Active custody booking reference
  const activeBooking = useMemo(() => {
    return DEMO_BOOKINGS.find((b) => b.status === "IN_STORAGE");
  }, []);

  // Filtered storage locations
  const filteredLocations = useMemo(() => {
    return DEMO_LOCATIONS.filter((loc) => {
      // Destination Chip
      if (selectedDestination !== "All" && loc.city !== selectedDestination) {
        return false;
      }
      // Text Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCity = loc.city.toLowerCase().includes(q);
        const matchesName = loc.name.toLowerCase().includes(q);
        const matchesLandmark = loc.landmark.toLowerCase().includes(q);
        if (!matchesCity && !matchesName && !matchesLandmark) return false;
      }
      // Modals Filters
      if (filter24HoursOnly && !loc.is24Hours) return false;
      if (filterCctvOnly && !loc.hasCctv) return false;
      if (filterClimateOnly && !loc.hasClimateControl) return false;
      if (filterMaxDailyPrice && loc.dailyCapLkr.MEDIUM > filterMaxDailyPrice) return false;

      return true;
    });
  }, [
    selectedDestination,
    searchQuery,
    filter24HoursOnly,
    filterCctvOnly,
    filterClimateOnly,
    filterMaxDailyPrice
  ]);

  return (
    <View style={styles.screenWrapper}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Coastal Hero Header */}
        <View style={styles.heroHeader}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.brandTitle}>Ayubowan!</Text>
              <Text style={styles.brandSubtitle}>
                Verified Luggage Storage Across Sri Lanka
              </Text>
            </View>
            <TouchableOpacity
              style={styles.mapIconBtn}
              onPress={() => router.push("/(traveller)/explore")}
              accessibilityLabel="Open Map Discovery"
            >
              <MobileIcon name="map" size={20} color={mobileColors.white} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <MobileIcon name="search" size={18} color={mobileColors.sand[600]} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search railway stations, cities, landmarks..."
              placeholderTextColor={mobileColors.sand[600]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <MobileIcon name="x" size={16} color={mobileColors.sand[600]} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => setFilterModalOpen(true)}
              accessibilityLabel="Filter Storage Spots"
            >
              <MobileIcon name="filter" size={18} color={mobileColors.navy[900]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Destination Quick-Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {DESTINATION_CHIPS.map((dest) => {
            const isSelected = selectedDestination === dest;
            return (
              <TouchableOpacity
                key={dest}
                style={[styles.chip, isSelected ? styles.chipActive : null]}
                onPress={() => setSelectedDestination(dest)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected ? styles.chipTextActive : null
                  ]}
                >
                  {dest}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Active Custody Quick Banner (if active storage exists) */}
        {activeBooking && (
          <TouchableOpacity
            style={styles.activeBanner}
            onPress={() => router.push("/(traveller)/bookings")}
            activeOpacity={0.85}
          >
            <View style={styles.activeBannerIcon}>
              <MobileIcon name="clock" size={20} color={mobileColors.emerald[700]} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.activeBannerTop}>
                <Text style={styles.activeBannerTitle}>Active Storage in Progress</Text>
                <Badge label="IN CUSTODY" variant="success" size="sm" />
              </View>
              <Text style={styles.activeBannerDesc}>
                {activeBooking.locationName} • Zone {activeBooking.zoneCode}
              </Text>
              <Text style={styles.activeBannerAction}>
                Remaining: 02h 15m • Tap to View Digital Pass →
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Map Preview Banner */}
        <Card style={styles.mapCard} variant="outlined">
          <View style={styles.mapCardHeader}>
            <View>
              <Text style={styles.mapCardTitle}>Interactive Sri Lanka Map</Text>
              <Text style={styles.mapCardDesc}>
                {filteredLocations.length} storage hubs near major rail & transit stops
              </Text>
            </View>
            <Button
              title="Full Map"
              size="sm"
              variant="outline"
              leftIcon={<MobileIcon name="compass" size={14} color={mobileColors.navy[900]} />}
              onPress={() => router.push("/(traveller)/explore")}
            />
          </View>
          <View style={styles.mapCanvasPreview}>
            <View style={styles.mapPinGrid}>
              {filteredLocations.slice(0, 4).map((loc) => (
                <TouchableOpacity
                  key={loc.id}
                  style={styles.mapPinPill}
                  onPress={() => router.push({ pathname: "/(traveller)/location", params: { id: loc.id } })}
                >
                  <MobileIcon name="map-pin" size={12} color={mobileColors.terracotta[500]} />
                  <Text style={styles.mapPinText}>
                    {loc.city}: LKR {loc.hourlyRateLkr.MEDIUM}/hr
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Card>

        {/* Location Listings Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Available Storage Locations ({filteredLocations.length})
          </Text>
          <Text style={styles.sectionSubtitle}>Verified Ceylon Hospitality Partners</Text>
        </View>

        {/* Storage Location Listing Cards */}
        {filteredLocations.length === 0 ? (
          <Card style={styles.emptyCard}>
            <MobileIcon name="search" size={32} color={mobileColors.sand[500]} />
            <Text style={styles.emptyTitle}>No Storage Spots Found</Text>
            <Text style={styles.emptySubtitle}>
              Try adjusting your search query or reset your filters.
            </Text>
            <Button
              title="Reset Filters"
              variant="outline"
              size="sm"
              onPress={() => {
                setSearchQuery("");
                setSelectedDestination("All");
                setFilter24HoursOnly(false);
                setFilterCctvOnly(false);
                setFilterClimateOnly(false);
                setFilterMaxDailyPrice(null);
              }}
              style={{ marginTop: 12 }}
            />
          </Card>
        ) : (
          filteredLocations.map((loc: StorageLocationItem) => (
            <Card key={loc.id} style={styles.locationCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.badgeRow}>
                    <Badge label={loc.city} variant="navy" size="sm" />
                    {loc.is24Hours ? (
                      <Badge label="24/7 OPEN" variant="success" size="sm" />
                    ) : (
                      <Badge label={loc.openHours} variant="neutral" size="sm" />
                    )}
                    <Badge
                      label={`${loc.availableCapacity} / ${loc.totalCapacity} Open`}
                      variant="info"
                      size="sm"
                    />
                  </View>
                  <Text style={styles.locationName}>{loc.name}</Text>
                  <Text style={styles.landmarkText}>
                    <MobileIcon name="map-pin" size={12} color={mobileColors.sand[600]} />{" "}
                    {loc.landmark}
                  </Text>
                </View>
              </View>

              {/* Verified Host & Rating */}
              <View style={styles.hostRow}>
                <View style={styles.verifiedHostPill}>
                  <MobileIcon name="shield" size={13} color={mobileColors.emerald[700]} />
                  <Text style={styles.verifiedHostText}>{loc.verifiedHost}</Text>
                </View>
                <View style={styles.ratingPill}>
                  <MobileIcon name="star" size={13} color={mobileColors.amber[600]} />
                  <Text style={styles.ratingText}>
                    {loc.rating} ({loc.reviewCount})
                  </Text>
                </View>
              </View>

              {/* Amenities & Security Checklist */}
              <View style={styles.amenitiesRow}>
                {loc.hasCctv ? (
                  <View style={styles.amenityItem}>
                    <MobileIcon name="check" size={12} color={mobileColors.emerald[600]} />
                    <Text style={styles.amenityText}>CCTV 24/7</Text>
                  </View>
                ) : null}
                {loc.hasClimateControl ? (
                  <View style={styles.amenityItem}>
                    <MobileIcon name="check" size={12} color={mobileColors.emerald[600]} />
                    <Text style={styles.amenityText}>Climate Controlled</Text>
                  </View>
                ) : null}
                <View style={styles.amenityItem}>
                  <MobileIcon name="check" size={12} color={mobileColors.emerald[600]} />
                  <Text style={styles.amenityText}>LKR 250k Guarantee</Text>
                </View>
              </View>

              {/* Pricing & Booking Actions */}
              <View style={styles.pricingRow}>
                <View>
                  <Text style={styles.rateLabel}>Standard Cabin Bag</Text>
                  <Text style={styles.rateValue}>
                    LKR {loc.hourlyRateLkr.MEDIUM}
                    <Text style={styles.rateUnit}> / hr</Text>
                  </Text>
                  <Text style={styles.dailyCapText}>
                    Max LKR {loc.dailyCapLkr.MEDIUM} / day
                  </Text>
                </View>
                <View style={styles.actionButtons}>
                  <Button
                    title="Details"
                    variant="outline"
                    size="sm"
                    onPress={() =>
                      router.push({
                        pathname: "/(traveller)/location",
                        params: { id: loc.id }
                      })
                    }
                  />
                  <Button
                    title="Book Spot"
                    variant="primary"
                    size="sm"
                    onPress={() =>
                      router.push({
                        pathname: "/(traveller)/checkout",
                        params: { locId: loc.id }
                      })
                    }
                  />
                </View>
              </View>
            </Card>
          ))
        )}

        {/* Footer Brand Seal */}
        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            Official Partner Network • Powered by Ceylon Warmth & Coastal Precision
          </Text>
        </View>
      </ScrollView>

      {/* Filter Sheet Modal (TM-014) */}
      <Modal visible={filterModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Storage Hubs</Text>
              <TouchableOpacity onPress={() => setFilterModalOpen(false)}>
                <MobileIcon name="x" size={20} color={mobileColors.navy[900]} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              <Text style={styles.filterSectionTitle}>Amenities & Access</Text>
              <TouchableOpacity
                style={styles.filterCheckRow}
                onPress={() => setFilter24HoursOnly((p) => !p)}
              >
                <View style={[styles.checkbox, filter24HoursOnly && styles.checkboxActive]}>
                  {filter24HoursOnly ? (
                    <MobileIcon name="check" size={14} color={mobileColors.white} />
                  ) : null}
                </View>
                <Text style={styles.filterCheckLabel}>24/7 Access Only</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterCheckRow}
                onPress={() => setFilterCctvOnly((p) => !p)}
              >
                <View style={[styles.checkbox, filterCctvOnly && styles.checkboxActive]}>
                  {filterCctvOnly ? (
                    <MobileIcon name="check" size={14} color={mobileColors.white} />
                  ) : null}
                </View>
                <Text style={styles.filterCheckLabel}>24/7 CCTV Surveillance</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterCheckRow}
                onPress={() => setFilterClimateOnly((p) => !p)}
              >
                <View style={[styles.checkbox, filterClimateOnly && styles.checkboxActive]}>
                  {filterClimateOnly ? (
                    <MobileIcon name="check" size={14} color={mobileColors.white} />
                  ) : null}
                </View>
                <Text style={styles.filterCheckLabel}>Climate Control / AC Vault</Text>
              </TouchableOpacity>

              <Text style={[styles.filterSectionTitle, { marginTop: 16 }]}>
                Maximum Daily Price (Cabin Bag)
              </Text>
              <View style={styles.priceFilterRow}>
                {[1400, 1800, 2200].map((pr) => (
                  <TouchableOpacity
                    key={pr}
                    style={[
                      styles.priceChip,
                      filterMaxDailyPrice === pr && styles.priceChipActive
                    ]}
                    onPress={() =>
                      setFilterMaxDailyPrice((prev) => (prev === pr ? null : pr))
                    }
                  >
                    <Text
                      style={[
                        styles.priceChipText,
                        filterMaxDailyPrice === pr && styles.priceChipTextActive
                      ]}
                    >
                      ≤ LKR {pr}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Reset All"
                variant="ghost"
                size="md"
                onPress={() => {
                  setFilter24HoursOnly(false);
                  setFilterCctvOnly(false);
                  setFilterClimateOnly(false);
                  setFilterMaxDailyPrice(null);
                }}
              />
              <Button
                title="Apply Filters"
                variant="primary"
                size="md"
                onPress={() => setFilterModalOpen(false)}
                style={{ flex: 1, marginLeft: 12 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Developer Drawer (Strictly sequestered behind __DEV__) */}
      <MobileDevDrawer />
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  container: {
    paddingBottom: 32
  },
  heroHeader: {
    backgroundColor: mobileColors.navy[900],
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  brandTitle: {
    ...mobileTypography.displaySm,
    color: mobileColors.white
  },
  brandSubtitle: {
    ...mobileTypography.bodySm,
    color: mobileColors.sand[400],
    marginTop: 2
  },
  mapIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: mobileColors.navy[800],
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: mobileColors.navy[700]
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mobileColors.white,
    borderRadius: mobileRadius.lg,
    paddingHorizontal: 14,
    height: 50,
    gap: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: mobileColors.navy[950]
  },
  filterBtn: {
    padding: 6,
    borderLeftWidth: 1,
    borderLeftColor: mobileColors.sand[200],
    paddingLeft: 10
  },
  chipsScroll: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  chipActive: {
    backgroundColor: mobileColors.navy[900],
    borderColor: mobileColors.navy[900]
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.sand[800]
  },
  chipTextActive: {
    color: mobileColors.white
  },
  activeBanner: {
    flexDirection: "row",
    backgroundColor: mobileColors.emerald[50],
    borderWidth: 1,
    borderColor: mobileColors.emerald[100],
    borderRadius: mobileRadius.xl,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 14,
    alignItems: "center",
    gap: 12
  },
  activeBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: mobileColors.emerald[100],
    justifyContent: "center",
    alignItems: "center"
  },
  activeBannerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2
  },
  activeBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  activeBannerDesc: {
    fontSize: 12,
    color: mobileColors.sand[700]
  },
  activeBannerAction: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.emerald[700],
    marginTop: 4
  },
  mapCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 14
  },
  mapCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  mapCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  mapCardDesc: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 2
  },
  mapCanvasPreview: {
    height: 90,
    backgroundColor: mobileColors.navy[950],
    borderRadius: mobileRadius.lg,
    padding: 10,
    justifyContent: "center"
  },
  mapPinGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center"
  },
  mapPinPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: mobileRadius.full,
    gap: 4
  },
  mapPinText: {
    color: mobileColors.sand[100],
    fontSize: 11,
    fontWeight: "600"
  },
  sectionHeaderRow: {
    paddingHorizontal: 20,
    marginBottom: 12
  },
  sectionTitle: {
    ...mobileTypography.headingSm,
    color: mobileColors.navy[900]
  },
  sectionSubtitle: {
    fontSize: 12,
    color: mobileColors.sand[600],
    marginTop: 2
  },
  locationCard: {
    marginHorizontal: 20,
    marginBottom: 16
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
    marginBottom: 8
  },
  locationName: {
    ...mobileTypography.headingSm,
    color: mobileColors.navy[900],
    marginBottom: 4
  },
  landmarkText: {
    fontSize: 12,
    color: mobileColors.sand[700]
  },
  hostRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: mobileColors.sand[100]
  },
  verifiedHostPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  verifiedHostText: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.navy[900]
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  amenitiesRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12
  },
  amenityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  amenityText: {
    fontSize: 11,
    color: mobileColors.sand[700]
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 8
  },
  rateLabel: {
    fontSize: 11,
    color: mobileColors.sand[600]
  },
  rateValue: {
    fontSize: 18,
    fontWeight: "800",
    color: mobileColors.terracotta[500]
  },
  rateUnit: {
    fontSize: 12,
    color: mobileColors.sand[700],
    fontWeight: "500"
  },
  dailyCapText: {
    fontSize: 11,
    color: mobileColors.sand[600]
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8
  },
  emptyCard: {
    marginHorizontal: 20,
    padding: 32,
    alignItems: "center"
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginTop: 8
  },
  emptySubtitle: {
    fontSize: 12,
    color: mobileColors.sand[600],
    textAlign: "center",
    marginTop: 4
  },
  footerNote: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: "center"
  },
  footerText: {
    fontSize: 11,
    color: mobileColors.sand[500],
    textAlign: "center"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10, 25, 47, 0.6)",
    justifyContent: "flex-end"
  },
  modalContent: {
    backgroundColor: mobileColors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.sand[200],
    paddingBottom: 12,
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginBottom: 8
  },
  filterCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: mobileColors.sand[300],
    justifyContent: "center",
    alignItems: "center"
  },
  checkboxActive: {
    backgroundColor: mobileColors.terracotta[500],
    borderColor: mobileColors.terracotta[500]
  },
  filterCheckLabel: {
    fontSize: 14,
    color: mobileColors.navy[900]
  },
  priceFilterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6
  },
  priceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    backgroundColor: mobileColors.sand[50]
  },
  priceChipActive: {
    borderColor: mobileColors.terracotta[500],
    backgroundColor: mobileColors.terracotta[50]
  },
  priceChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.sand[800]
  },
  priceChipTextActive: {
    color: mobileColors.terracotta[600]
  },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: mobileColors.sand[200],
    paddingTop: 16,
    marginTop: 12
  }
});
