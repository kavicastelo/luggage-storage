import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { formatCurrencyMinorUnits, type CurrencyCode } from "@luggage-storage/contracts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  SafeHeader,
  ScreenContainer,
  StatusBadge,
  formatColomboDateTime
} from "../../src/components";
import {
  useBusinessPayoutDetailsQuery,
  useHostFinanceSummaryQuery,
  useHostPayoutBatchesQuery,
  useOwnedBusinessesQuery
} from "../../src/hooks";
import { normalizeApiError } from "../../src/services/api-client";
import { useAuthStore } from "../../src/store/useAuthStore";
import {
  mobileColors,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

export default function HostEarningsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const isOwner = Boolean(
    user?.roles?.includes("HOST_OWNER") || user?.roles?.includes("SUPERADMIN")
  );

  const businessesQuery = useOwnedBusinessesQuery(isOwner);
  const business = businessesQuery.data?.[0] ?? null;

  const financeQuery = useHostFinanceSummaryQuery(business?.id, isOwner);
  const payoutQuery = useBusinessPayoutDetailsQuery(business?.id, isOwner && Boolean(business?.id));
  const batchesQuery = useHostPayoutBatchesQuery(business?.id, isOwner);

  if (!isOwner) {
    return (
      <ScreenContainer
        header={<SafeHeader title="Host Earnings & Settlements" />}
        testID="host-earnings-forbidden"
      >
        <Card variant="outlined" style={styles.deniedCard}>
          <Text style={styles.deniedBadge}>RBAC Guard • 403 Forbidden</Text>
          <Text style={styles.deniedTitle}>Host Owner Access Required</Text>
          <Text style={styles.deniedBody}>
            Financial settlement balances and bank payout details are restricted to HOST_OWNER and
            SUPERADMIN accounts.
          </Text>
          <Button
            title="Return to Live Desk"
            onPress={() => router.replace("/(host)")}
          />
        </Card>
      </ScreenContainer>
    );
  }

  const summary = financeQuery.data;
  const currency = (summary?.currency || "LKR") as CurrencyCode;
  const payout = payoutQuery.data;

  return (
    <ScreenContainer
      header={
        <SafeHeader
          title="Host Earnings & Settlements"
          subtitle={business ? business.tradeName : "LKR Double-Entry Ledger"}
        />
      }
      refreshing={financeQuery.isRefetching}
      onRefresh={() => {
        void Promise.all([financeQuery.refetch(), payoutQuery.refetch()]);
      }}
      testID="host-earnings-screen"
    >
      {financeQuery.isLoading || businessesQuery.isLoading ? (
        <LoadingSkeleton count={4} />
      ) : financeQuery.isError ? (
        <ErrorState
          title="Unable to Load Financial Ledger"
          message={normalizeApiError(financeQuery.error).message}
          onRetry={() => {
            void financeQuery.refetch();
          }}
        />
      ) : !summary ? (
        <EmptyState
          mascot="thinking"
          title="No Settlement Data Yet"
          description="Confirmed and released luggage bookings accrue host payables automatically."
        />
      ) : (
        <View style={styles.stack}>
          <Card variant="navy" style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>ELIGIBLE HOST PAYABLES ({currency})</Text>
            <Text style={styles.heroAmount}>
              {formatCurrencyMinorUnits(summary.totalEligibleMinor, currency)}
            </Text>
            <Text style={styles.heroSub}>
              Accrued ledger entries move to Eligible after verified collection release and hold
              clearance.
            </Text>
          </Card>

          <View style={styles.kpiGrid}>
            <Card variant="default" style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Accrued</Text>
              <Text style={styles.kpiVal}>
                {formatCurrencyMinorUnits(summary.totalAccruedMinor, currency)}
              </Text>
            </Card>
            <Card variant="default" style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>On Hold</Text>
              <Text style={styles.kpiVal}>
                {formatCurrencyMinorUnits(summary.totalOnHoldMinor, currency)}
              </Text>
            </Card>
            <Card variant="default" style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Settled Paid</Text>
              <Text style={styles.kpiVal}>
                {formatCurrencyMinorUnits(summary.totalPaidMinor, currency)}
              </Text>
            </Card>
          </View>

          {business ? (
            <Card variant="default" style={styles.cardGap}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>LKR Settlement Bank Account</Text>
                <Badge
                  label={payout?.payoutAccountNumberMasked ? "Configured" : "Action Needed"}
                  variant={payout?.payoutAccountNumberMasked ? "success" : "warning"}
                  size="sm"
                />
              </View>
              {payout?.payoutAccountNumberMasked ? (
                <Text style={styles.metaText}>
                  {payout.payoutBankName || "Bank"} • {payout.payoutAccountNumberMasked} •{" "}
                  {payout.payoutAccountName || business.legalBusinessName}
                </Text>
              ) : (
                <Text style={styles.metaText}>
                  Add your Sri Lanka bank account details in Partner Onboarding to enable manual LKR
                  bank settlements.
                </Text>
              )}
              <Button
                title="Update Bank Payout Details"
                size="sm"
                variant="outline"
                onPress={() => router.push("/(host)/onboarding")}
              />
            </Card>
          ) : null}

          <Text style={styles.sectionTitle}>Transaction History ({summary.payables.length})</Text>

          {summary.payables.length === 0 ? (
            <EmptyState
              mascot="thinking"
              title="No Payable Records Yet"
              description="Each paid booking generates a double-entry payable showing gross booking amount, platform commission, and net host payable."
            />
          ) : (
            summary.payables.map((item) => (
              <Card key={item.id} variant="elevated" style={styles.cardGap}>
                <View style={styles.rowBetween}>
                  <Text style={styles.refCode}>
                    #{item.referenceCode || item.bookingId.slice(0, 8)}
                  </Text>
                  <StatusBadge status={item.status} size="sm" />
                </View>

                <Text style={styles.netValue}>
                  Net Host Payable:{" "}
                  {formatCurrencyMinorUnits(item.netPayableMinor, (item.currency || currency) as CurrencyCode)}
                </Text>
                <Text style={styles.metaText}>
                  Gross Booking:{" "}
                  {formatCurrencyMinorUnits(item.grossSubtotalMinor, (item.currency || currency) as CurrencyCode)}{" "}
                  • Platform Fee:{" "}
                  {formatCurrencyMinorUnits(item.commissionMinor, (item.currency || currency) as CurrencyCode)}
                </Text>
                <Text style={styles.metaText}>
                  Accrued: {formatColomboDateTime(new Date(item.accruedAt))}
                </Text>
              </Card>
            ))
          )}

          <Text style={styles.sectionTitle}>
            Settlement Payout Batches ({batchesQuery.data?.length ?? 0})
          </Text>
          {batchesQuery.isLoading ? (
            <LoadingSkeleton count={2} />
          ) : batchesQuery.error ? (
            <ErrorState
              title="Unable to Load Payout Batches"
              message={normalizeApiError(batchesQuery.error).message}
              onRetry={() => void batchesQuery.refetch()}
            />
          ) : (batchesQuery.data?.length ?? 0) === 0 ? (
            <EmptyState
              mascot="thinking"
              title="No Payout Batches Yet"
              description="Once eligible host payables are grouped and disbursed by finance, bank settlement batches and wire references appear here."
            />
          ) : (
            (batchesQuery.data ?? []).map((batch) => (
              <Card key={batch.id} variant="default" style={styles.cardGap}>
                <View style={styles.rowBetween}>
                  <Text style={styles.refCode}>{batch.batchCode}</Text>
                  <StatusBadge status={batch.status} size="sm" />
                </View>
                <Text style={styles.netValue}>
                  Net Disbursed:{" "}
                  {formatCurrencyMinorUnits(
                    batch.totalNetPayableMinor,
                    (batch.currency || currency) as CurrencyCode
                  )}
                </Text>
                <Text style={styles.metaText}>
                  Items: {batch.itemCount} • Method: {batch.payoutMethod}
                  {batch.payoutReference ? ` • Ref: ${batch.payoutReference}` : ""}
                </Text>
                <Text style={styles.metaText}>
                  {batch.disbursedAt
                    ? `Disbursed: ${formatColomboDateTime(new Date(batch.disbursedAt))}`
                    : `Generated: ${formatColomboDateTime(new Date(batch.createdAt))}`}
                </Text>
              </Card>
            ))
          )}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: mobileSpacing[4]
  },
  deniedCard: {
    gap: mobileSpacing[3],
    marginTop: mobileSpacing[4],
    borderColor: mobileStatusTokens.dangerBorder,
    backgroundColor: mobileStatusTokens.dangerBg
  },
  deniedBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileStatusTokens.danger,
    textTransform: "uppercase"
  },
  deniedTitle: {
    ...mobileTypography.headingMd,
    color: mobileColors.navy[900]
  },
  deniedBody: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.secondary
  },
  heroCard: {
    gap: 6
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: mobileColors.terracotta[300]
  },
  heroAmount: {
    ...mobileTypography.displayLg,
    color: mobileColors.white
  },
  heroSub: {
    fontSize: 12,
    lineHeight: 16,
    color: mobileColors.sand[200]
  },
  kpiGrid: {
    flexDirection: "row",
    gap: mobileSpacing[2]
  },
  kpiCard: {
    flex: 1,
    gap: 4
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileTextColors.muted
  },
  kpiVal: {
    ...mobileTypography.label,
    color: mobileColors.navy[900]
  },
  cardGap: {
    gap: mobileSpacing[2]
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: mobileSpacing[2]
  },
  sectionTitle: {
    ...mobileTypography.headingSm,
    color: mobileTextColors.primary
  },
  refCode: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.terracotta[600]
  },
  netValue: {
    ...mobileTypography.label,
    color: mobileColors.navy[900]
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
    color: mobileTextColors.secondary
  }
});
