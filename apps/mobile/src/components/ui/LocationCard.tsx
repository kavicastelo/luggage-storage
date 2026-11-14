import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import {
  formatCurrencyMinorUnits,
  type CurrencyCode,
  type PublicStorageLocation
} from "@luggage-storage/contracts";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../lib/theme";
import { Card } from "../Card";
import { Badge } from "../Badge";
import { MobileIcon } from "../MobileIcon";
import { IconButton } from "./IconButton";

export interface LocationCardProps {
  location: PublicStorageLocation;
  onPress: () => void;
  isSaved?: boolean;
  onToggleSaved?: () => void;
  testID?: string;
}

export function formatApproximateDistance(distanceMeters?: number): string | null {
  if (typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters) || distanceMeters < 0) {
    return null;
  }
  if (distanceMeters < 1000) {
    return `~${Math.round(distanceMeters)} m away`;
  }
  return `~${(distanceMeters / 1000).toFixed(1)} km away`;
}

export function LocationCard({
  location,
  onPress,
  isSaved = false,
  onToggleSaved,
  testID
}: LocationCardProps) {
  const distanceLabel = formatApproximateDistance(location.distanceMeters);
  const currency = (location.currency || "LKR") as CurrencyCode;
  const rateText =
    typeof location.baseRateMinor === "number"
      ? `${formatCurrencyMinorUnits(location.baseRateMinor, currency)} / hr`
      : "Rate shown at quote";

  const ratingLabel =
    location.reviewCount > 0 && typeof location.averageRating === "number"
      ? `${location.averageRating.toFixed(1)} (${location.reviewCount})`
      : "No verified reviews yet";

  return (
    <Card
      variant="elevated"
      onPress={onPress}
      accessibilityLabel={`${location.name}, ${location.approximateArea}, ${location.city}, ${rateText}`}
      style={styles.card}
      testID={testID ?? `location-card-${location.id}`}
    >
      <View style={styles.headerRow}>
        {location.primaryImageUrl ? (
          <Image
            source={{ uri: location.primaryImageUrl }}
            style={styles.thumb}
            accessibilityLabel={`${location.name} photo`}
          />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <MobileIcon name="luggage" size="lg" color={mobileColors.navy[700]} />
          </View>
        )}

        <View style={styles.headerText}>
          <View style={styles.badgeLine}>
            <Badge
              label={location.bookingMode === "INSTANT" ? "Instant Book" : "Host Approval"}
              variant={location.bookingMode === "INSTANT" ? "success" : "info"}
              size="sm"
            />
            {location.is24Hours ? <Badge label="24h Access" variant="navy" size="sm" /> : null}
          </View>
          <Text style={styles.name} numberOfLines={2}>
            {location.name}
          </Text>
          <View style={styles.metaLine}>
            <MobileIcon name="map-pin" size="xs" color={mobileTextColors.muted} />
            <Text style={styles.areaText} numberOfLines={1}>
              {location.approximateArea} · {location.city}
              {distanceLabel ? ` · ${distanceLabel}` : ""}
            </Text>
          </View>
        </View>

        {onToggleSaved ? (
          <IconButton
            icon="bookmark"
            onPress={onToggleSaved}
            accessibilityLabel={isSaved ? "Remove saved location" : "Save location on this device"}
            variant={isSaved ? "primary" : "subtle"}
            iconSize="sm"
            testID={testID ? `${testID}-save` : `save-location-${location.id}`}
          />
        ) : null}
      </View>

      <View style={styles.footerRow}>
        <View style={styles.leftFooter}>
          <View style={styles.hoursRow}>
            <MobileIcon name="clock" size="xs" color={mobileTextColors.muted} />
            <Text style={styles.hoursText}>{location.operatingHoursSummary}</Text>
          </View>
          <View style={styles.hoursRow}>
            <MobileIcon
              name="star"
              size="xs"
              color={
                location.reviewCount > 0 ? mobileStatusTokens.warningIcon : mobileTextColors.muted
              }
            />
            <Text style={styles.hoursText}>{ratingLabel}</Text>
          </View>
        </View>

        <View style={styles.pricePill}>
          <Text style={styles.priceLabel}>From</Text>
          <Text style={styles.priceValue}>{rateText}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: mobileSpacing[3],
    gap: mobileSpacing[3]
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing[3]
  },
  thumb: {
    width: 68,
    height: 68,
    borderRadius: mobileRadius.lg,
    backgroundColor: mobileColors.sand[100]
  },
  thumbPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: mobileRadius.lg,
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  headerText: {
    flex: 1,
    gap: 4
  },
  badgeLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing[1]
  },
  name: {
    ...mobileTypography.headingSm,
    marginTop: 2
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  areaText: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.muted,
    flex: 1
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: mobileSpacing[2],
    borderTopWidth: 1,
    borderTopColor: mobileColors.sand[100],
    gap: mobileSpacing[2]
  },
  leftFooter: {
    flex: 1,
    gap: 4
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  hoursText: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.secondary
  },
  pricePill: {
    alignItems: "flex-end",
    backgroundColor: mobileColors.terracotta[50],
    borderWidth: 1,
    borderColor: mobileColors.terracotta[200],
    borderRadius: mobileRadius.lg,
    paddingHorizontal: mobileSpacing[3],
    paddingVertical: mobileSpacing[2]
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: mobileColors.terracotta[600],
    textTransform: "uppercase"
  },
  priceValue: {
    fontSize: 14,
    fontWeight: "800",
    color: mobileColors.navy[950]
  }
});

