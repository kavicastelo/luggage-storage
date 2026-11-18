import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BAG_CATEGORIES,
  formatCurrencyMinorUnits,
  type BookingQuoteResponse,
  type CurrencyCode
} from "@luggage-storage/contracts";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  DateTimeSelector,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingSkeleton,
  LocationCard,
  MobileIcon,
  ScreenContainer,
  SearchInput,
  StatusBadge,
  formatColomboDateTime
} from ".";
import {
  useMyBookingsQuery,
  useSearchAvailabilityQuery,
  useSearchLocationsQuery
} from "../hooks";
import { normalizeApiError } from "../services/api-client";
import { getCurrentDeviceLocation } from "../lib/geolocation";
import { useAuthStore } from "../store/useAuthStore";
import { useSavedLocationsStore } from "../store/useSavedLocationsStore";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../lib/theme";

const SRI_LANKA_CITIES = ["All", "Colombo", "Kandy", "Galle", "Ella", "Negombo"] as const;

export interface DiscoveryViewProps {
  initialCity?: string;
  initialSearchTerm?: string;
  headerTitle?: string;
  showBackButton?: boolean;
}

function defaultDropOffDate(): Date {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return d;
}

function defaultCollectionDate(dropOff: Date): Date {
  return new Date(dropOff.getTime() + 6 * 60 * 60 * 1000);
}

export function DiscoveryView({
  initialCity = "All",
  initialSearchTerm = "",
  headerTitle = "LuggageStorage Sri Lanka",
  showBackButton = false
}: DiscoveryViewProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useAuthStore();
  const { savedIds, hydrate: hydrateSaved, toggleSaved, isSaved } = useSavedLocationsStore();

  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialSearchTerm);
  const [selectedCity, setSelectedCity] = useState<string>(
    SRI_LANKA_CITIES.includes(initialCity as (typeof SRI_LANKA_CITIES)[number])
      ? initialCity
      : "All"
  );
  const [nearMeCoords, setNearMeCoords] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [gpsStatusMessage, setGpsStatusMessage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [availabilityFilterActive, setAvailabilityFilterActive] = useState(false);
  const [dropOffAt, setDropOffAt] = useState<Date>(() => defaultDropOffDate());
  const [collectionAt, setCollectionAt] = useState<Date>(() =>
    defaultCollectionDate(defaultDropOffDate())
  );
  const [bagCounts, setBagCounts] = useState<Record<(typeof BAG_CATEGORIES)[number], number>>({
    BAG_SMALL: 0,
    BAG_MEDIUM: 1,
    BAG_LARGE: 0,
    BAG_OVERSIZED: 0
  });

  useEffect(() => {
    void hydrateSaved();
  }, [hydrateSaved]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const totalSelectedBags = useMemo(
    () =>
      bagCounts.BAG_SMALL +
      bagCounts.BAG_MEDIUM +
      bagCounts.BAG_LARGE +
      bagCounts.BAG_OVERSIZED,
    [bagCounts]
  );

  const searchParams = useMemo(
    () => ({
      city: selectedCity !== "All" ? selectedCity : undefined,
      searchTerm: debouncedSearchTerm.trim() || undefined,
      latitude: nearMeCoords?.latitude,
      longitude: nearMeCoords?.longitude,
      radiusMeters: nearMeCoords ? 15000 : undefined,
      page: 1,
      limit: 30
    }),
    [nearMeCoords, debouncedSearchTerm, selectedCity]
  );

  const locationsQuery = useSearchLocationsQuery(searchParams, true);

  const isAvailabilityWindowValid = collectionAt.getTime() > dropOffAt.getTime();
  const availabilityQuery = useSearchAvailabilityQuery(
    availabilityFilterActive && isAvailabilityWindowValid && totalSelectedBags > 0
      ? {
          city: selectedCity !== "All" ? selectedCity : undefined,
          dropOffAt: dropOffAt.toISOString(),
          collectionAt: collectionAt.toISOString(),
          smallBags: bagCounts.BAG_SMALL,
          mediumBags: bagCounts.BAG_MEDIUM,
          largeBags: bagCounts.BAG_LARGE,
          oversizedBags: bagCounts.BAG_OVERSIZED
        }
      : null
  );

  const myBookingsQuery = useMyBookingsQuery({ limit: 5 }, isAuthenticated);

  const quoteMap = useMemo(() => {
    const map = new Map<string, BookingQuoteResponse>();
    for (const q of availabilityQuery.data?.quotes ?? []) {
      map.set(q.locationId, q);
    }
    return map;
  }, [availabilityQuery.data]);

  const activeBannerBooking = useMemo(() => {
    const bookings = myBookingsQuery.data?.bookings ?? [];
    return bookings.find((b) =>
      ["CONFIRMED", "IN_STORAGE", "PENDING_PAYMENT", "PENDING_HOST_APPROVAL"].includes(b.status)
    );
  }, [myBookingsQuery.data]);

  const visibleLocations = useMemo(() => {
    const base = locationsQuery.data?.locations ?? [];
    if (!availabilityFilterActive || !isAvailabilityWindowValid || !availabilityQuery.data) {
      return base;
    }
    return base.filter((loc) => {
      const q = quoteMap.get(loc.id);
      return q ? q.available : false;
    });
  }, [
    availabilityFilterActive,
    availabilityQuery.data,
    isAvailabilityWindowValid,
    locationsQuery.data,
    quoteMap
  ]);

  const handleToggleNearMe = async () => {
    if (nearMeCoords) {
      setNearMeCoords(null);
      setGpsStatusMessage(null);
      return;
    }
    setIsLocating(true);
    setGpsStatusMessage(null);
    try {
      const geo = await getCurrentDeviceLocation();
      if (!geo.ok) {
        setGpsStatusMessage(geo.reason);
        return;
      }
      setNearMeCoords({
        latitude: geo.latitude,
        longitude: geo.longitude
      });
      setGpsStatusMessage("Filtered within ~15 km using privacy-rounded distance.");
    } catch {
      setGpsStatusMessage(
        "Unable to read device GPS coordinates right now. Filter by city instead."
      );
    } finally {
      setIsLocating(false);
    }
  };

  const adjustBag = (cat: (typeof BAG_CATEGORIES)[number], delta: number) => {
    setBagCounts((prev) => ({
      ...prev,
      [cat]: Math.max(0, Math.min(20, prev[cat] + delta))
    }));
  };

  const handleRefresh = async () => {
    await Promise.all([
      locationsQuery.refetch(),
      availabilityFilterActive ? availabilityQuery.refetch() : Promise.resolve(),
      isAuthenticated ? myBookingsQuery.refetch() : Promise.resolve()
    ]);
  };

  const errorMessage = locationsQuery.isError
    ? normalizeApiError(locationsQuery.error).message
    : null;

  return (
    <ScreenContainer
      padded={false}
      refreshing={locationsQuery.isRefetching}
      onRefresh={() => {
        void handleRefresh();
      }}
      testID="traveller-discovery-screen"
    >
      <View
        style={[
          styles.heroHeader,
          { paddingTop: Math.max(insets.top + mobileSpacing[3], mobileSpacing[5]) }
        ]}
      >
        <View style={styles.heroTopRow}>
          {showBackButton ? (
            <IconButton
              icon="arrow-left"
              variant="navy"
              onPress={() => router.back()}
              accessibilityLabel="Go back"
              testID="discovery-back-btn"
            />
          ) : null}
          <View style={styles.heroTitleCol}>
            <Text style={styles.heroEyebrow}>LUGGAGESTORAGE · SRI LANKA</Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {headerTitle}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.accountPill}
            onPress={() =>
              router.push(isAuthenticated ? "/(traveller)/profile" : "/(auth)/login")
            }
            accessibilityRole="button"
            accessibilityLabel={isAuthenticated ? "Account profile" : "Sign In"}
          >
            <MobileIcon name="user" size={16} color={mobileColors.white} />
            <Text style={styles.accountPillText}>
              {isAuthenticated ? user?.displayName?.split(" ")[0] || "Account" : "Sign In"}
            </Text>
          </TouchableOpacity>
        </View>

        <SearchInput
          value={searchTerm}
          onChangeText={setSearchTerm}
          onClear={() => setSearchTerm("")}
          placeholder="Search Colombo Fort, Kandy, Galle..."
          testID="discovery-search-input"
        />

        <View style={styles.filterToolbar}>
          <TouchableOpacity
            style={[styles.toolChip, nearMeCoords ? styles.toolChipActive : null]}
            onPress={() => {
              void handleToggleNearMe();
            }}
            disabled={isLocating}
            accessibilityRole="button"
            accessibilityLabel="Filter locations near me"
          >
            <MobileIcon
              name="navigation"
              size={14}
              color={nearMeCoords ? mobileColors.white : mobileColors.sand[100]}
            />
            <Text style={styles.toolChipText}>
              {isLocating ? "Locating..." : nearMeCoords ? "Near Me (On)" : "Near Me"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolChip, availabilityFilterActive ? styles.toolChipActive : null]}
            onPress={() => setFilterSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Filter by schedule and bags"
            testID="discovery-dates-bags-trigger"
          >
            <MobileIcon
              name="calendar"
              size={14}
              color={availabilityFilterActive ? mobileColors.white : mobileColors.sand[100]}
            />
            <Text style={styles.toolChipText}>
              {availabilityFilterActive
                ? `${totalSelectedBags} bag${totalSelectedBags === 1 ? "" : "s"} · Live Quote`
                : "Dates & Bags"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        {activeBannerBooking ? (
          <Card variant="elevated" style={styles.activeBookingBanner}>
            <View style={styles.activeBannerRow}>
              <View style={styles.activeBannerCol}>
                <View style={styles.activeBannerTop}>
                  <Text style={styles.activeBannerEyebrow}>ACTIVE RESERVATION</Text>
                  <StatusBadge status={activeBannerBooking.status} size="sm" />
                </View>
                <Text style={styles.activeBannerTitle}>
                  {activeBannerBooking.location.name} • #{activeBannerBooking.referenceCode}
                </Text>
                <Text style={styles.activeBannerMeta}>
                  {activeBannerBooking.totalBags} bag(s) scheduled
                </Text>
              </View>
              <Button
                title={
                  activeBannerBooking.status === "PENDING_PAYMENT"
                    ? "Pay Now"
                    : activeBannerBooking.status === "CONFIRMED" ||
                        activeBannerBooking.status === "IN_STORAGE"
                      ? "Custody Pass"
                      : "View"
                }
                size="sm"
                onPress={() => {
                  if (activeBannerBooking.status === "PENDING_PAYMENT") {
                    router.push({
                      pathname: "/(traveller)/checkout",
                      params: {
                        locId: activeBannerBooking.locationId,
                        bookingId: activeBannerBooking.id
                      }
                    });
                  } else if (
                    activeBannerBooking.status === "CONFIRMED" ||
                    activeBannerBooking.status === "IN_STORAGE"
                  ) {
                    router.push({
                      pathname: "/(traveller)/pass",
                      params: {
                        bookingId: activeBannerBooking.id,
                        ref: activeBannerBooking.referenceCode
                      }
                    });
                  } else {
                    router.push("/(traveller)/bookings");
                  }
                }}
              />
            </View>
          </Card>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cityChipsRow}
        >
          {SRI_LANKA_CITIES.map((city) => {
            const active = selectedCity === city;
            return (
              <TouchableOpacity
                key={city}
                style={[styles.cityChip, active && styles.cityChipActive]}
                onPress={() => setSelectedCity(city)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.cityChipText, active && styles.cityChipTextActive]}>
                  {city}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {availabilityFilterActive ? (
          <View style={styles.activeFilterSummaryRow}>
            <TouchableOpacity
              style={styles.activeFilterSummaryBody}
              onPress={() => setFilterSheetVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Edit dates and bags filter"
            >
              <MobileIcon name="calendar" size={14} color={mobileColors.terracotta[600]} />
              <Text style={styles.activeFilterSummaryText} numberOfLines={1}>
                {totalSelectedBags} bag{totalSelectedBags === 1 ? "" : "s"} •{" "}
                {formatColomboDateTime(dropOffAt)} → {formatColomboDateTime(collectionAt)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.clearFilterPill}
              onPress={() => setAvailabilityFilterActive(false)}
              accessibilityRole="button"
              accessibilityLabel="Clear dates and bags filter"
            >
              <Text style={styles.clearFilterText}>Clear</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {gpsStatusMessage ? (
          <View style={styles.noticeRow}>
            <MobileIcon name="info" size={16} color={mobileColors.navy[700]} />
            <Text style={styles.noticeText}>{gpsStatusMessage}</Text>
          </View>
        ) : null}

        <View style={styles.privacyCard}>
          <MobileIcon name="shield-check" size={16} color={mobileColors.emerald[700]} />
          <Text style={styles.privacyText}>
            Privacy protection active: discovery shows approximate area coordinates only. Exact
            street address and directions unlock after confirmed payment.
          </Text>
        </View>

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>
            {selectedCity === "All" ? "Verified Sri Lanka Hubs" : `Hubs in ${selectedCity}`}
          </Text>
          <Badge label={`${visibleLocations.length} open`} variant="navy" size="sm" />
        </View>

        {locationsQuery.isLoading ? (
          <LoadingSkeleton count={3} />
        ) : errorMessage ? (
          <ErrorState
            title="Could not load storage locations"
            message={errorMessage}
            onRetry={() => {
              void locationsQuery.refetch();
            }}
          />
        ) : visibleLocations.length === 0 ? (
          <EmptyState
            mascot="suitcase-peek"
            title="No matching hubs found"
            description="Try clearing your search keyword, picking another Sri Lanka city, or adjusting your check-in dates."
            actionTitle="Reset Filters"
            onAction={() => {
              setSelectedCity("All");
              setSearchTerm("");
              setDebouncedSearchTerm("");
              setNearMeCoords(null);
              setAvailabilityFilterActive(false);
            }}
          />
        ) : (
          <View style={styles.listGap}>
            {visibleLocations.map((loc) => {
              const liveQuote = quoteMap.get(loc.id);
              return (
                <View key={loc.id} style={styles.cardStack}>
                  <LocationCard
                    location={loc}
                    isSaved={savedIds.includes(loc.id) || isSaved(loc.id)}
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
                  {liveQuote ? (
                    <View style={styles.liveQuoteStrip}>
                      <Text style={styles.liveQuoteText}>
                        Quote for selected window:{" "}
                        <Text style={styles.liveQuoteStrong}>
                          {formatCurrencyMinorUnits(
                            liveQuote.totalAmountMinor,
                            (liveQuote.currency || "LKR") as CurrencyCode
                          )}
                        </Text>{" "}
                        ({liveQuote.remainingCapacityUnits} capacity units remaining)
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

      <BottomSheet
        visible={filterSheetVisible}
        title="Check Dates & Bags"
        subtitle="Filter hubs with live capacity and instant LKR quotes"
        onClose={() => setFilterSheetVisible(false)}
        testID="discovery-dates-bags-sheet"
      >
        <View style={styles.sheetContent}>
          <DateTimeSelector
            label="Drop-off (Asia/Colombo)"
            value={dropOffAt}
            minimumDate={new Date()}
            onChange={(next) => {
              setDropOffAt(next);
              if (collectionAt.getTime() <= next.getTime()) {
                setCollectionAt(defaultCollectionDate(next));
              }
            }}
          />
          <DateTimeSelector
            label="Collection (Asia/Colombo)"
            value={collectionAt}
            minimumDate={new Date(dropOffAt.getTime() + 60 * 60 * 1000)}
            onChange={setCollectionAt}
            errorText={!isAvailabilityWindowValid ? "Collection must be after drop-off." : null}
          />

          <View style={styles.bagGrid}>
            {(
              [
                { key: "BAG_SMALL", label: "Small" },
                { key: "BAG_MEDIUM", label: "Medium" },
                { key: "BAG_LARGE", label: "Large" },
                { key: "BAG_OVERSIZED", label: "Oversized" }
              ] as const
            ).map((item) => (
              <View key={item.key} style={styles.bagCounterCard}>
                <Text style={styles.bagCounterLabel}>{item.label}</Text>
                <View style={styles.bagStepperRow}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => adjustBag(item.key, -1)}
                    accessibilityRole="button"
                    accessibilityLabel={`Decrease ${item.label} bags`}
                  >
                    <MobileIcon name="minus" size={16} color={mobileColors.navy[900]} />
                  </TouchableOpacity>
                  <Text style={styles.bagCountVal}>{bagCounts[item.key]}</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => adjustBag(item.key, 1)}
                    accessibilityRole="button"
                    accessibilityLabel={`Increase ${item.label} bags`}
                  >
                    <MobileIcon name="plus" size={16} color={mobileColors.navy[900]} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.windowSummary}>
            Window: {formatColomboDateTime(dropOffAt)} → {formatColomboDateTime(collectionAt)}
          </Text>

          <View style={styles.sheetActions}>
            <Button
              title="Clear Filter"
              variant="outline"
              size="sm"
              style={styles.sheetActionBtn}
              onPress={() => {
                setAvailabilityFilterActive(false);
                setFilterSheetVisible(false);
              }}
            />
            <Button
              title="Apply Dates & Bags"
              variant="primary"
              size="sm"
              style={styles.sheetActionBtn}
              disabled={!isAvailabilityWindowValid || totalSelectedBags === 0}
              onPress={() => {
                setAvailabilityFilterActive(true);
                setFilterSheetVisible(false);
              }}
            />
          </View>
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroHeader: {
    backgroundColor: mobileColors.navy[900],
    paddingHorizontal: mobileSpacing[4],
    paddingTop: mobileSpacing[4],
    paddingBottom: mobileSpacing[6],
    gap: mobileSpacing[3]
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: mobileSpacing[3]
  },
  heroTitleCol: {
    flex: 1
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: mobileColors.terracotta[400]
  },
  heroTitle: {
    ...mobileTypography.headingLg,
    color: mobileColors.white
  },
  accountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.navy[800],
    borderWidth: 1,
    borderColor: mobileColors.navy[700]
  },
  accountPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.white
  },
  filterToolbar: {
    flexDirection: "row",
    gap: mobileSpacing[3],
    flexWrap: "wrap"
  },
  toolChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.navy[800],
    borderWidth: 1,
    borderColor: mobileColors.navy[700]
  },
  toolChipActive: {
    backgroundColor: mobileColors.terracotta[600],
    borderColor: mobileColors.terracotta[500]
  },
  toolChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.white
  },
  body: {
    padding: mobileSpacing[4],
    gap: mobileSpacing[4]
  },
  activeBookingBanner: {
    borderLeftWidth: 4,
    borderLeftColor: mobileColors.emerald[500]
  },
  activeBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing[3]
  },
  activeBannerCol: {
    flex: 1,
    gap: 4
  },
  activeBannerTop: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: mobileSpacing[2]
  },
  activeBannerEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.emerald[700],
    letterSpacing: 0.6
  },
  activeBannerTitle: {
    ...mobileTypography.label,
    color: mobileTextColors.primary
  },
  activeBannerMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileTextColors.secondary
  },
  cityChipsRow: {
    gap: mobileSpacing[2],
    paddingVertical: 2
  },
  cityChip: {
    minHeight: 40,
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.white,
    borderWidth: 1,
    borderColor: mobileColors.sand[300]
  },
  cityChipActive: {
    backgroundColor: mobileColors.navy[900],
    borderColor: mobileColors.navy[900]
  },
  cityChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileTextColors.primary
  },
  cityChipTextActive: {
    color: mobileColors.white
  },
  activeFilterSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing[2],
    backgroundColor: mobileColors.terracotta[50],
    borderWidth: 1,
    borderColor: mobileColors.terracotta[200],
    borderRadius: mobileRadius.lg,
    paddingHorizontal: mobileSpacing[3],
    paddingVertical: mobileSpacing[2]
  },
  activeFilterSummaryBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  activeFilterSummaryText: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.terracotta[800],
    flex: 1
  },
  clearFilterPill: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.white,
    borderWidth: 1,
    borderColor: mobileColors.terracotta[300],
    alignItems: "center",
    justifyContent: "center"
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.terracotta[700]
  },
  sheetContent: {
    gap: mobileSpacing[3]
  },
  sheetActions: {
    flexDirection: "row",
    gap: mobileSpacing[3],
    marginTop: mobileSpacing[2]
  },
  sheetActionBtn: {
    flex: 1
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[2],
    backgroundColor: mobileColors.sand[100],
    padding: mobileSpacing[3],
    borderRadius: mobileRadius.lg
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileColors.navy[800],
    flex: 1
  },
  availabilityCard: {
    gap: mobileSpacing[3]
  },
  sectionTitle: {
    ...mobileTypography.headingSm,
    color: mobileTextColors.primary
  },
  bagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing[2]
  },
  bagCounterCard: {
    flexBasis: "48%",
    backgroundColor: mobileColors.sand[50],
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    padding: mobileSpacing[3],
    gap: 6
  },
  bagCounterLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileTextColors.primary
  },
  bagStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.white,
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    alignItems: "center",
    justifyContent: "center"
  },
  bagCountVal: {
    ...mobileTypography.headingSm,
    color: mobileTextColors.primary
  },
  windowSummary: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileTextColors.secondary
  },
  privacyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[2],
    backgroundColor: mobileStatusTokens.successBg,
    padding: mobileSpacing[3],
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    borderColor: mobileStatusTokens.successBorder
  },
  privacyText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileStatusTokens.success,
    flex: 1
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  resultsTitle: {
    ...mobileTypography.headingMd,
    color: mobileTextColors.primary
  },
  listGap: {
    gap: mobileSpacing[4]
  },
  cardStack: {
    gap: 4
  },
  liveQuoteStrip: {
    backgroundColor: mobileColors.navy[50],
    paddingHorizontal: mobileSpacing[3],
    paddingVertical: 8,
    borderRadius: mobileRadius.md
  },
  liveQuoteText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileColors.navy[800]
  },
  liveQuoteStrong: {
    fontWeight: "700",
    color: mobileColors.navy[900]
  }
});
