import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  BAG_CATEGORIES,
  formatCurrencyMinorUnits,
  type BookingQuoteResponse,
  type CurrencyCode
} from "@luggage-storage/contracts";
import {
  Badge,
  Button,
  Card,
  DateTimeSelector,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  LocationCard,
  MobileIcon,
  ScreenContainer,
  SearchInput,
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
  headerTitle = "BagBox Sri Lanka"
}: DiscoveryViewProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { savedIds, hydrate: hydrateSaved, toggleSaved, isSaved } = useSavedLocationsStore();

  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
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

  const [availabilityFilterOpen, setAvailabilityFilterOpen] = useState(false);
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

  const searchParams = useMemo(
    () => ({
      city: selectedCity !== "All" ? selectedCity : undefined,
      searchTerm: searchTerm.trim() || undefined,
      latitude: nearMeCoords?.latitude,
      longitude: nearMeCoords?.longitude,
      radiusMeters: nearMeCoords ? 15000 : undefined,
      page: 1,
      limit: 30
    }),
    [nearMeCoords, searchTerm, selectedCity]
  );

  const locationsQuery = useSearchLocationsQuery(searchParams, true);

  const isAvailabilityWindowValid = collectionAt.getTime() > dropOffAt.getTime();
  const availabilityQuery = useSearchAvailabilityQuery(
    availabilityFilterOpen && isAvailabilityWindowValid
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
    if (!availabilityFilterOpen || !isAvailabilityWindowValid || !availabilityQuery.data) {
      return base;
    }
    return base.filter((loc) => {
      const q = quoteMap.get(loc.id);
      return q ? q.available : false;
    });
  }, [
    availabilityFilterOpen,
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
      availabilityFilterOpen ? availabilityQuery.refetch() : Promise.resolve(),
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
      <View style={styles.heroHeader}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTitleCol}>
            <Text style={styles.heroEyebrow}>TRUSTED CUSTODY NETWORK</Text>
            <Text style={styles.heroTitle}>{headerTitle}</Text>
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
            style={[styles.toolChip, availabilityFilterOpen ? styles.toolChipActive : null]}
            onPress={() => setAvailabilityFilterOpen((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="Filter by schedule and bags"
          >
            <MobileIcon
              name="calendar"
              size={14}
              color={availabilityFilterOpen ? mobileColors.white : mobileColors.sand[100]}
            />
            <Text style={styles.toolChipText}>
              {availabilityFilterOpen ? "Dates & Bags (On)" : "Check Dates & Bags"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        {activeBannerBooking ? (
          <Card variant="elevated" style={styles.activeBookingBanner}>
            <View style={styles.activeBannerRow}>
              <View style={styles.activeBannerCol}>
                <Text style={styles.activeBannerEyebrow}>ACTIVE RESERVATION</Text>
                <Text style={styles.activeBannerTitle}>
                  {activeBannerBooking.location.name} • #{activeBannerBooking.referenceCode}
                </Text>
                <Text style={styles.activeBannerMeta}>
                  {activeBannerBooking.totalBags} bag(s) • {activeBannerBooking.status}
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

        {gpsStatusMessage ? (
          <View style={styles.noticeRow}>
            <MobileIcon name="info" size={16} color={mobileColors.navy[700]} />
            <Text style={styles.noticeText}>{gpsStatusMessage}</Text>
          </View>
        ) : null}

        {availabilityFilterOpen ? (
          <Card variant="outlined" style={styles.availabilityCard}>
            <Text style={styles.sectionTitle}>Check Live Capacity & Pricing</Text>
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
              errorText={
                !isAvailabilityWindowValid ? "Collection must be after drop-off." : null
              }
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
          </Card>
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
              setNearMeCoords(null);
              setAvailabilityFilterOpen(false);
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
    gap: 2
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
