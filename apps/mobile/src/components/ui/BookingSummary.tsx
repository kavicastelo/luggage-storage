import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  formatCurrencyMinorUnits,
  type BookingDetail,
  type CurrencyCode
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
import { MobileIcon } from "../MobileIcon";
import { Button } from "../Button";
import { StatusBadge } from "./StatusBadge";
import { formatColomboDateTime } from "./DateTimeSelector";

export interface BookingSummaryProps {
  booking: BookingDetail;
  onOpenDirections?: () => void;
  testID?: string;
}

export function BookingSummary({
  booking,
  onOpenDirections,
  testID
}: BookingSummaryProps) {
  const currency = (booking.currency || "LKR") as CurrencyCode;
  const tz = booking.location.timezone || "Asia/Colombo";
  const hasExactAddress = Boolean(
    booking.location.addressDisclosed && booking.location.addressLine1
  );

  return (
    <Card variant="elevated" style={styles.card} testID={testID ?? `booking-summary-${booking.id}`}>
      <View style={styles.topRow}>
        <View style={styles.refPill}>
          <Text style={styles.refText}>REF: {booking.referenceCode}</Text>
        </View>
        <StatusBadge status={booking.status} size="sm" />
      </View>

      <Text style={styles.locationName}>{booking.location.name}</Text>

      <View style={styles.scheduleGrid}>
        <View style={styles.scheduleRow}>
          <MobileIcon name="calendar" size="xs" color={mobileColors.terracotta[500]} />
          <Text style={styles.scheduleLabel}>Drop-off:</Text>
          <Text style={styles.scheduleValue}>
            {formatColomboDateTime(new Date(booking.dropOffAt), tz)}
          </Text>
        </View>
        <View style={styles.scheduleRow}>
          <MobileIcon name="clock" size="xs" color={mobileColors.navy[700]} />
          <Text style={styles.scheduleLabel}>Collection:</Text>
          <Text style={styles.scheduleValue}>
            {formatColomboDateTime(new Date(booking.collectionAt), tz)}
          </Text>
        </View>
        <View style={styles.scheduleRow}>
          <MobileIcon name="luggage" size="xs" color={mobileColors.navy[700]} />
          <Text style={styles.scheduleLabel}>Luggage:</Text>
          <Text style={styles.scheduleValue}>
            {booking.totalBags} bag{booking.totalBags === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      {hasExactAddress ? (
        <View style={styles.disclosedBox}>
          <View style={styles.addressHeader}>
            <MobileIcon name="map-pin" size="sm" color={mobileStatusTokens.successIcon} />
            <Text style={styles.disclosedTitle}>Verified Drop-Off Address</Text>
          </View>
          <Text style={styles.disclosedLine}>
            {booking.location.addressLine1}
            {booking.location.addressLine2 ? `, ${booking.location.addressLine2}` : ""}
            {`, ${booking.location.city}`}
          </Text>
          {booking.location.directionsNotes ? (
            <Text style={styles.directionsNote}>{booking.location.directionsNotes}</Text>
          ) : null}
          {onOpenDirections ? (
            <Button
              title="Open Map Directions"
              variant="outline"
              size="sm"
              leftIcon={<MobileIcon name="navigation" size="sm" />}
              onPress={onOpenDirections}
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.privacyBox}>
          <MobileIcon name="lock" size="sm" color={mobileTextColors.muted} />
          <Text style={styles.privacyText}>
            Approximate area: {booking.location.approximateArea} · {booking.location.city}. Exact street address unlocks automatically once payment is confirmed.
          </Text>
        </View>
      )}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>
          {formatCurrencyMinorUnits(booking.totalAmountMinor, currency)}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: mobileSpacing[3]
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: mobileSpacing[2]
  },
  refPill: {
    backgroundColor: mobileColors.navy[50],
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing[2],
    paddingVertical: 4
  },
  refText: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[900],
    fontFamily: "monospace"
  },
  locationName: {
    ...mobileTypography.headingMd
  },
  scheduleGrid: {
    gap: mobileSpacing[2]
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[2]
  },
  scheduleLabel: {
    ...mobileTypography.bodySm,
    width: 72
  },
  scheduleValue: {
    ...mobileTypography.bodyMd,
    fontWeight: "600",
    color: mobileColors.navy[950],
    flex: 1
  },
  disclosedBox: {
    backgroundColor: mobileStatusTokens.successBg,
    borderWidth: 1,
    borderColor: mobileStatusTokens.successBorder,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing[3],
    gap: mobileSpacing[2]
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[1]
  },
  disclosedTitle: {
    ...mobileTypography.label,
    color: mobileStatusTokens.success
  },
  disclosedLine: {
    ...mobileTypography.bodyMd,
    fontWeight: "600",
    color: mobileColors.navy[950]
  },
  directionsNote: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.secondary
  },
  privacyBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing[2],
    backgroundColor: mobileColors.sand[100],
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing[3]
  },
  privacyText: {
    ...mobileTypography.bodySm,
    flex: 1
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: mobileColors.sand[100],
    paddingTop: mobileSpacing[3]
  },
  totalLabel: {
    ...mobileTypography.label
  },
  totalAmount: {
    fontSize: 17,
    fontWeight: "800",
    color: mobileColors.navy[950]
  }
});

