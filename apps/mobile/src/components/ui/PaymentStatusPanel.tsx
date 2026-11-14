import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  formatCurrencyMinorUnits,
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
import { Button } from "../Button";
import { MobileIcon } from "../MobileIcon";
import { StatusBadge } from "./StatusBadge";

export interface PaymentStatusPanelProps {
  bookingStatus: string;
  paymentStatus: string | null;
  providerLabel?: string;
  amountMinor: number;
  currency?: string;
  expiresAt?: string | null;
  errorMessage?: string | null;
  isChecking?: boolean;
  isRetrying?: boolean;
  onCheckStatus?: () => void;
  onReopenCheckout?: () => void;
  onRetryCheckout?: () => void;
  onOpenPass?: () => void;
  testID?: string;
}

export function PaymentStatusPanel({
  bookingStatus,
  paymentStatus,
  providerLabel = "PayHere Hosted Checkout",
  amountMinor,
  currency = "LKR",
  expiresAt,
  errorMessage,
  isChecking = false,
  isRetrying = false,
  onCheckStatus,
  onReopenCheckout,
  onRetryCheckout,
  onOpenPass,
  testID
}: PaymentStatusPanelProps) {
  const isoCurrency = (currency || "LKR") as CurrencyCode;
  const isConfirmed = bookingStatus === "CONFIRMED" || bookingStatus === "IN_STORAGE";

  return (
    <Card variant="elevated" style={styles.card} testID={testID ?? "payment-status-panel"}>
      <View style={styles.headerRow}>
        <View style={styles.providerWrap}>
          <MobileIcon name="credit-card" size="md" color={mobileColors.navy[900]} />
          <View>
            <Text style={styles.title}>{providerLabel}</Text>
            <Text style={styles.amount}>
              {formatCurrencyMinorUnits(amountMinor, isoCurrency)}
            </Text>
          </View>
        </View>
        <StatusBadge status={paymentStatus ?? bookingStatus} size="sm" />
      </View>

      <Text style={styles.summaryText}>
        {isConfirmed
          ? "Payment has been verified by the server. Your storage pass and exact street address are unlocked."
          : "Payment confirmation is verified strictly from the server ledger and signed PayHere webhook."}
      </Text>

      {expiresAt && !isConfirmed ? (
        <View style={styles.expiryRow}>
          <MobileIcon name="clock" size="xs" color={mobileTextColors.muted} />
          <Text style={styles.expiryText}>Hold expires: {new Date(expiresAt).toLocaleString()}</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <MobileIcon name="alert-triangle" size="sm" color={mobileStatusTokens.dangerIcon} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {isConfirmed && onOpenPass ? (
          <Button
            title="View Digital Custody Pass"
            onPress={onOpenPass}
            leftIcon={<MobileIcon name="qr-code" size="sm" color={mobileColors.white} />}
            fullWidth
          />
        ) : null}

        {!isConfirmed && onCheckStatus ? (
          <Button
            title="Check Payment Status"
            variant="secondary"
            onPress={onCheckStatus}
            isLoading={isChecking}
            leftIcon={<MobileIcon name="refresh" size="sm" color={mobileColors.white} />}
            fullWidth
          />
        ) : null}

        {!isConfirmed && onReopenCheckout ? (
          <Button
            title="Re-open PayHere Checkout"
            variant="outline"
            onPress={onReopenCheckout}
            leftIcon={<MobileIcon name="external-link" size="sm" />}
            fullWidth
          />
        ) : null}

        {!isConfirmed && onRetryCheckout ? (
          <Button
            title="Retry PayHere Checkout"
            variant="primary"
            onPress={onRetryCheckout}
            isLoading={isRetrying}
            fullWidth
          />
        ) : null}
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
  providerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[3],
    flex: 1
  },
  title: {
    ...mobileTypography.headingSm
  },
  amount: {
    ...mobileTypography.bodyMd,
    fontWeight: "700",
    color: mobileColors.terracotta[600]
  },
  summaryText: {
    ...mobileTypography.bodyMd
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  expiryText: {
    ...mobileTypography.bodySm
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing[2],
    backgroundColor: mobileStatusTokens.dangerBg,
    borderWidth: 1,
    borderColor: mobileStatusTokens.dangerBorder,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing[3]
  },
  errorText: {
    ...mobileTypography.bodySm,
    color: mobileStatusTokens.danger,
    fontWeight: "600",
    flex: 1
  },
  actions: {
    gap: mobileSpacing[2]
  }
});

