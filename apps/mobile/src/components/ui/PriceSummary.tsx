import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  formatCurrencyMinorUnits,
  type BookingQuoteResponse,
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

export interface PriceSummaryProps {
  quote: BookingQuoteResponse;
  title?: string;
  testID?: string;
}

export function PriceSummary({
  quote,
  title = "Authoritative Quote Summary",
  testID
}: PriceSummaryProps) {
  const currency = (quote.currency || "LKR") as CurrencyCode;

  return (
    <Card variant="default" style={styles.card} testID={testID ?? "price-summary-card"}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.unitChip}>
          <Text style={styles.unitChipText}>
            {quote.durationUnits} {quote.pricingUnit.toLowerCase()} unit
            {quote.durationUnits === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      {!quote.available && quote.unavailabilityReason ? (
        <View style={styles.unavailableBanner}>
          <MobileIcon name="alert-triangle" size="sm" color={mobileStatusTokens.dangerIcon} />
          <Text style={styles.unavailableText}>{quote.unavailabilityReason}</Text>
        </View>
      ) : null}

      <View style={styles.lineList}>
        {quote.items.map((item) => (
          <View key={item.bagCategory} style={styles.lineRow}>
            <Text style={styles.lineLabel}>
              {item.quantity}x {item.bagCategory} ({formatCurrencyMinorUnits(item.unitRateMinor, currency)}/{quote.pricingUnit.toLowerCase()})
            </Text>
            <Text style={styles.lineAmount}>
              {formatCurrencyMinorUnits(item.lineTotalMinor, currency)}
            </Text>
          </View>
        ))}

        {quote.discountMinor > 0 ? (
          <View style={styles.lineRow}>
            <Text style={styles.discountLabel}>Duration Discount</Text>
            <Text style={styles.discountAmount}>
              -{formatCurrencyMinorUnits(quote.discountMinor, currency)}
            </Text>
          </View>
        ) : null}

        {quote.taxAmountMinor > 0 ? (
          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>Taxes & Levies</Text>
            <Text style={styles.lineAmount}>
              {formatCurrencyMinorUnits(quote.taxAmountMinor, currency)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Payable</Text>
        <Text style={styles.totalValue}>
          {formatCurrencyMinorUnits(quote.totalAmountMinor, currency)}
        </Text>
      </View>

      <View style={styles.policyBox}>
        <MobileIcon name="info" size="xs" color={mobileTextColors.muted} />
        <Text style={styles.policyText}>{quote.cancellationPolicySummary}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: mobileSpacing[3]
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing[2]
  },
  title: {
    ...mobileTypography.headingSm
  },
  unitChip: {
    backgroundColor: mobileColors.sand[100],
    borderRadius: mobileRadius.full,
    paddingHorizontal: mobileSpacing[2],
    paddingVertical: 4
  },
  unitChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  unavailableBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[2],
    backgroundColor: mobileStatusTokens.dangerBg,
    borderWidth: 1,
    borderColor: mobileStatusTokens.dangerBorder,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing[3]
  },
  unavailableText: {
    ...mobileTypography.bodySm,
    color: mobileStatusTokens.danger,
    fontWeight: "600",
    flex: 1
  },
  lineList: {
    gap: mobileSpacing[2]
  },
  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: mobileSpacing[2]
  },
  lineLabel: {
    ...mobileTypography.bodyMd,
    flex: 1
  },
  lineAmount: {
    ...mobileTypography.bodyMd,
    fontWeight: "600",
    color: mobileColors.navy[950]
  },
  discountLabel: {
    ...mobileTypography.bodyMd,
    color: mobileStatusTokens.success
  },
  discountAmount: {
    ...mobileTypography.bodyMd,
    fontWeight: "700",
    color: mobileStatusTokens.success
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1.5,
    borderTopColor: mobileColors.border,
    paddingTop: mobileSpacing[3]
  },
  totalLabel: {
    ...mobileTypography.headingSm
  },
  totalValue: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    color: mobileColors.terracotta[600]
  },
  policyBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing[2],
    backgroundColor: mobileColors.sand[50],
    borderRadius: mobileRadius.md,
    padding: mobileSpacing[2]
  },
  policyText: {
    ...mobileTypography.bodySm,
    flex: 1
  }
});

