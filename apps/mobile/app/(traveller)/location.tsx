import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { formatCurrencyMinorUnits, type CurrencyCode } from "@luggage-storage/contracts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  ImageGallery,
  InteractiveMobileMap,
  LoadingSkeleton,
  MobileIcon,
  SafeHeader,
  ScreenContainer,
  StatusBadge,
  formatApproximateDistance
} from "../../src/components";
import { usePublicLocationDetailQuery, useQuoteBookingQuery } from "../../src/hooks";
import { normalizeApiError } from "../../src/services/api-client";
import { useSavedLocationsStore } from "../../src/store/useSavedLocationsStore";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function TravellerLocationDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const locationId = typeof params.id === "string" ? params.id : undefined;
  const isValidId = Boolean(locationId && UUID_REGEX.test(locationId));

  const { hydrate, isSaved, toggleSaved } = useSavedLocationsStore();
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const locationQuery = usePublicLocationDetailQuery(locationId);
  const location = locationQuery.data;

  const previewWindow = useMemo(() => {
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 9 * 60 * 60 * 1000);
    return {
      dropOffAt: start.toISOString(),
      collectionAt: end.toISOString()
    };
  }, []);

  const previewQuoteQuery = useQuoteBookingQuery(
    location
      ? {
          locationId: location.id,
          dropOffAt: previewWindow.dropOffAt,
          collectionAt: previewWindow.collectionAt,
          items: [{ bagCategory: "BAG_MEDIUM", quantity: 1 }]
        }
      : null
  );

  if (!isValidId) {
    return (
      <ScreenContainer
        header={
          <SafeHeader
            title="Storage Hub"
            onBack={() => (router.canGoBack() ? router.back() : router.replace("/(traveller)"))}
          />
        }
        testID="traveller-location-invalid"
      >
        <EmptyState
          mascot="suitcase-peek"
          title="Select a Storage Location"
          description="Choose a verified Sri Lanka partner hub from Explore to view availability and rates."
          actionTitle="Browse Locations"
          onAction={() => router.replace("/(traveller)")}
        />
      </ScreenContainer>
    );
  }

  const saved = locationId ? isSaved(locationId) : false;
  const distanceLabel = formatApproximateDistance(location?.distanceMeters);
  const currency = ((location?.currency || "LKR") as CurrencyCode);

  const footer = location ? (
    <View style={styles.stickyFooter}>
      <View style={styles.footerPriceCol}>
        <Text style={styles.footerPriceLabel}>
          {previewQuoteQuery.data ? "Sample 1-bag rate" : "Starting from"}
        </Text>
        <Text style={styles.footerPriceValue}>
          {previewQuoteQuery.data
            ? formatCurrencyMinorUnits(previewQuoteQuery.data.totalAmountMinor, currency)
            : typeof location.baseRateMinor === "number"
              ? formatCurrencyMinorUnits(location.baseRateMinor, currency)
              : "See quote"}
        </Text>
      </View>
      <Button
        title="Reserve Storage"
        rightIcon={<MobileIcon name="arrow-right" size={16} color={mobileColors.white} />}
        onPress={() =>
          router.push({
            pathname: "/(traveller)/checkout",
            params: { locId: location.id }
          })
        }
        style={styles.footerBtn}
      />
    </View>
  ) : undefined;

  return (
    <ScreenContainer
      header={
        <SafeHeader
          title={location?.name || "Location Details"}
          subtitle={location ? `${location.approximateArea}, ${location.city}` : undefined}
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/(traveller)"))}
          rightAction={
            locationId ? (
              <IconButton
                icon="bookmark"
                variant={saved ? "navy" : "subtle"}
                accessibilityLabel={saved ? "Remove from saved locations" : "Save location"}
                onPress={() => {
                  void toggleSaved(locationId);
                }}
              />
            ) : undefined
          }
        />
      }
      footer={footer}
      testID="traveller-location-detail-screen"
    >
      {locationQuery.isLoading ? (
        <LoadingSkeleton count={3} />
      ) : locationQuery.isError || !location ? (
        <ErrorState
          title="Could not load location"
          message={
            locationQuery.isError
              ? normalizeApiError(locationQuery.error).message
              : "This location is currently unavailable."
          }
          onRetry={() => {
            void locationQuery.refetch();
          }}
        />
      ) : (
        <View style={styles.stack}>
          <ImageGallery
            images={(location.images ?? []).map((img) => ({
              id: img.id,
              url: img.url,
              caption: img.caption,
              isPrimary: img.isPrimary
            }))}
          />

          <Card variant="elevated" style={styles.cardPad}>
            <View style={styles.badgesRow}>
              <StatusBadge status={location.bookingMode} />
              {location.acceptsOversized ? (
                <Badge label="Oversized Accepted" variant="info" size="sm" />
              ) : null}
              {distanceLabel ? <Badge label={distanceLabel} variant="neutral" size="sm" /> : null}
            </View>

            <Text style={styles.title}>{location.name}</Text>
            <View style={styles.areaRow}>
              <MobileIcon name="map-pin" size={16} color={mobileColors.terracotta[600]} />
              <Text style={styles.areaText}>
                {location.approximateArea}, {location.city}
              </Text>
            </View>

            {location.description ? (
              <Text style={styles.description}>{location.description}</Text>
            ) : null}

            <View style={styles.privacyBanner}>
              <MobileIcon name="lock" size={16} color={mobileColors.navy[700]} />
              <Text style={styles.privacyBannerText}>
                Approximate coordinates ({location.approximateLatitude.toFixed(3)},{" "}
                {location.approximateLongitude.toFixed(3)}) shown before booking. Exact street
                address and counter directions unlock after payment confirmation.
              </Text>
            </View>
          </Card>

          <Card variant="default" style={styles.cardPad}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.sectionTitle}>Transit Route & Map</Text>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/(traveller)/navigation",
                    params: {
                      destinationLat: String(location.approximateLatitude),
                      destinationLng: String(location.approximateLongitude),
                      destinationTitle: location.name,
                      destinationAddress: location.approximateArea
                    }
                  })
                }
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                accessibilityLabel="Preview in-app route"
              >
                <MobileIcon name="navigation" size={14} color={mobileColors.terracotta[500]} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: mobileColors.terracotta[500] }}>
                  Preview Route
                </Text>
              </TouchableOpacity>
            </View>
            <InteractiveMobileMap
              locations={[
                {
                  id: location.id,
                  name: location.name,
                  city: location.city,
                  latitude: location.approximateLatitude,
                  longitude: location.approximateLongitude
                }
              ]}
              selectedLocationId={location.id}
              height={180}
              showControls={false}
            />
          </Card>

          <Card variant="default" style={styles.cardPad}>
            <Text style={styles.sectionTitle}>Operating Hours ({location.timezone})</Text>
            <View style={styles.hoursRow}>
              <MobileIcon name="clock" size={18} color={mobileColors.navy[800]} />
              <Text style={styles.hoursValue}>
                {location.is24Hours
                  ? "Open 24 Hours"
                  : location.operatingHoursSummary ?? "Operating hours not configured"}
              </Text>
            </View>
            <Text style={styles.captionNote}>
              Exact drop-off and collection availability for your timestamps is validated live on
              the next screen.
            </Text>
          </Card>

          <Card variant="default" style={styles.cardPad}>
            <Text style={styles.sectionTitle}>Amenities & Security Features</Text>
            {location.amenities.length === 0 ? (
              <Text style={styles.captionNote}>No optional amenities listed by host.</Text>
            ) : (
              <View style={styles.amenitiesWrap}>
                {location.amenities.map((amenity) => (
                  <Badge
                    key={amenity}
                    label={amenity.replace(/_/g, " ")}
                    variant="neutral"
                    icon="check"
                    size="sm"
                  />
                ))}
              </View>
            )}
          </Card>

          <Card variant="default" style={styles.cardPad}>
            <Text style={styles.sectionTitle}>Custody & Handover Protection</Text>
            <Text style={styles.bodyText}>
              Check-in and collection use a time-limited encrypted QR token paired with a 6-digit
              PIN verified at the partner counter. Luggage release is never delayed over disputed or
              overdue fees.
            </Text>
          </Card>

          <Card variant="outlined" style={styles.cardPad}>
            <Text style={styles.sectionTitle}>Verified Guest Reviews</Text>
            <Text style={styles.bodyText}>
              {location.reviewCount > 0 && typeof location.averageRating === "number"
                ? `${location.averageRating.toFixed(1)} average across ${location.reviewCount} verified bookings.`
                : "No verified reviews yet — Verified post-custody traveller reviews will appear once available."}
            </Text>
          </Card>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: mobileSpacing[4]
  },
  cardPad: {
    gap: mobileSpacing[3]
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  title: {
    ...mobileTypography.headingLg,
    color: mobileTextColors.primary
  },
  areaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  areaText: {
    ...mobileTypography.bodyMd,
    color: mobileTextColors.secondary,
    fontWeight: "600"
  },
  description: {
    ...mobileTypography.bodyMd,
    color: mobileTextColors.secondary
  },
  privacyBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: mobileColors.navy[50],
    padding: mobileSpacing[3],
    borderRadius: mobileRadius.md
  },
  privacyBannerText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileColors.navy[800],
    flex: 1
  },
  sectionTitle: {
    ...mobileTypography.headingSm,
    color: mobileTextColors.primary
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  hoursValue: {
    ...mobileTypography.label,
    color: mobileTextColors.primary
  },
  captionNote: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileTextColors.muted
  },
  amenitiesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  bodyText: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.secondary
  },
  stickyFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: mobileColors.white,
    paddingHorizontal: mobileSpacing[4],
    paddingVertical: mobileSpacing[3],
    borderTopWidth: 1,
    borderTopColor: mobileColors.sand[200],
    gap: mobileSpacing[4]
  },
  footerPriceCol: {
    gap: 2
  },
  footerPriceLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileTextColors.muted
  },
  footerPriceValue: {
    ...mobileTypography.headingMd,
    color: mobileColors.navy[900]
  },
  footerBtn: {
    flex: 1
  }
});
