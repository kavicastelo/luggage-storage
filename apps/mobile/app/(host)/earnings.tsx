import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet
} from "react-native";
import { useHostStore } from "../../src/store/useHostStore";
import { MobileIcon } from "../../src/components/MobileIcon";
import { mobileColors } from "../../src/lib/theme";

export default function HostEarningsScreen() {
  const { transactions } = useHostStore();
  const [filterBatch, setFilterBatch] = useState<"ALL" | "CLEARED" | "PENDING">("ALL");
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // Financial aggregates
  const financialSummary = useMemo(() => {
    const grossTotal = transactions.reduce((sum, tx) => sum + tx.grossAmountLkr, 0);
    const platformFeeTotal = transactions.reduce((sum, tx) => sum + tx.platformFeeLkr, 0);
    const netTotal = transactions.reduce(
      (sum, tx) => sum + (tx.netHostLkr ?? tx.netPayoutLkr),
      0
    );

    const clearedTotal = transactions
      .filter((tx) => tx.payoutStatus === "CLEARED_BATCH" || tx.status === "CLEARED")
      .reduce((sum, tx) => sum + (tx.netHostLkr ?? tx.netPayoutLkr), 0);

    const pendingTotal = transactions
      .filter(
        (tx) =>
          tx.payoutStatus === "PENDING_SETTLEMENT" || tx.status === "PENDING_BATCH"
      )
      .reduce((sum, tx) => sum + (tx.netHostLkr ?? tx.netPayoutLkr), 0);

    return {
      grossTotal,
      platformFeeTotal,
      netTotal,
      clearedTotal,
      pendingTotal
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (filterBatch === "CLEARED") {
      return transactions.filter(
        (tx) => tx.payoutStatus === "CLEARED_BATCH" || tx.status === "CLEARED"
      );
    }
    if (filterBatch === "PENDING") {
      return transactions.filter(
        (tx) =>
          tx.payoutStatus === "PENDING_SETTLEMENT" || tx.status === "PENDING_BATCH"
      );
    }
    return transactions;
  }, [transactions, filterBatch]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.headerCard}>
        <Text style={styles.pageTitle}>Host Earnings & Settlements</Text>
        <Text style={styles.pageSubtitle}>
          Itemized ledger, 85% net host revenue breakdown, and weekly payout schedules.
        </Text>

        {/* Payout Schedule Callout */}
        <View style={styles.scheduleCallout}>
          <MobileIcon name="clock" size={16} color={mobileColors.navy[700]} />
          <View style={styles.scheduleTextCol}>
            <Text style={styles.scheduleTitle}>Next Automated Payout: Wednesday Batch</Text>
            <Text style={styles.scheduleSubtitle}>
              Commercial Bank of Ceylon • Account Ending in 8492
            </Text>
          </View>
        </View>
      </View>

      {/* KPI Highlights */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Net Host Earnings (85%)</Text>
          <Text style={styles.kpiValue}>
            LKR {financialSummary.netTotal.toLocaleString()}
          </Text>
          <Text style={styles.kpiSub}>Total earned to date</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Pending Next Payout</Text>
          <Text style={[styles.kpiValue, styles.kpiPending]}>
            LKR {financialSummary.pendingTotal.toLocaleString()}
          </Text>
          <Text style={styles.kpiSub}>Releasing Wed Nov 12</Text>
        </View>
      </View>

      {/* 85 / 15 Split Breakdown Card */}
      <View style={styles.splitCard}>
        <View style={styles.splitHeader}>
          <MobileIcon name="pie-chart" size={18} color={mobileColors.terracotta[600]} />
          <Text style={styles.splitCardTitle}>Revenue Share Breakdown</Text>
        </View>

        <View style={styles.splitRow}>
          <Text style={styles.splitLabel}>Gross Paid Guest Volume (100%)</Text>
          <Text style={styles.splitValGross}>
            LKR {financialSummary.grossTotal.toLocaleString()}
          </Text>
        </View>

        <View style={styles.splitRow}>
          <Text style={styles.splitLabel}>Platform Service Fee (15%)</Text>
          <Text style={styles.splitValFee}>
            -LKR {financialSummary.platformFeeTotal.toLocaleString()}
          </Text>
        </View>

        <View style={styles.splitDivider} />

        <View style={styles.splitRow}>
          <Text style={styles.splitLabelNet}>Net Host Share (85%)</Text>
          <Text style={styles.splitValNet}>
            LKR {financialSummary.netTotal.toLocaleString()}
          </Text>
        </View>

        {/* DEC-006 Disclaimer */}
        <View style={styles.splitDisclaimerBox}>
          <Text style={styles.splitDisclaimerText}>
            <Text style={styles.boldText}>Policy Note (DEC-006):</Text> The 85% host / 15% platform split
            and weekly Wednesday batch cycle are illustrative defaults pending final Product Owner
            commercial sign-off.
          </Text>
        </View>
      </View>

      {/* Bank Account Details Card */}
      <View style={styles.bankCard}>
        <View style={styles.bankHeader}>
          <MobileIcon name="credit-card" size={18} color={mobileColors.navy[900]} />
          <Text style={styles.bankCardTitle}>Settlement Bank Account</Text>
        </View>

        <View style={styles.bankDetailRow}>
          <Text style={styles.bankDetailLabel}>Financial Institution:</Text>
          <Text style={styles.bankDetailValue}>Commercial Bank of Ceylon PLC</Text>
        </View>

        <View style={styles.bankDetailRow}>
          <Text style={styles.bankDetailLabel}>Branch:</Text>
          <Text style={styles.bankDetailValue}>Fort Corporate Branch (Colombo 01)</Text>
        </View>

        <View style={styles.bankDetailRow}>
          <Text style={styles.bankDetailLabel}>Account Number:</Text>
          <Text style={styles.bankDetailValue}>**** **** **** 8492</Text>
        </View>

        <View style={styles.bankDetailRow}>
          <Text style={styles.bankDetailLabel}>Settlement Currency:</Text>
          <Text style={styles.bankDetailValue}>LKR (Sri Lankan Rupee)</Text>
        </View>
      </View>

      {/* Transaction History Filter & Header */}
      <View style={styles.ledgerHeaderRow}>
        <Text style={styles.sectionTitle}>Transaction History</Text>
        <View style={styles.filterGroup}>
          <TouchableOpacity
            style={[styles.filterBtn, filterBatch === "ALL" && styles.filterBtnActive]}
            onPress={() => setFilterBatch("ALL")}
          >
            <Text
              style={[
                styles.filterBtnText,
                filterBatch === "ALL" && styles.filterBtnTextActive
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, filterBatch === "PENDING" && styles.filterBtnActive]}
            onPress={() => setFilterBatch("PENDING")}
          >
            <Text
              style={[
                styles.filterBtnText,
                filterBatch === "PENDING" && styles.filterBtnTextActive
              ]}
            >
              Pending
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, filterBatch === "CLEARED" && styles.filterBtnActive]}
            onPress={() => setFilterBatch("CLEARED")}
          >
            <Text
              style={[
                styles.filterBtnText,
                filterBatch === "CLEARED" && styles.filterBtnTextActive
              ]}
            >
              Cleared
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Transaction Item List */}
      <View style={styles.txList}>
        {filteredTransactions.map((tx) => {
          const isExpanded = expandedTxId === tx.id;
          const isCleared = tx.payoutStatus === "CLEARED_BATCH" || tx.status === "CLEARED";
          const refCode = tx.reference || tx.bookingRef;
          const displayDate = tx.timestamp || tx.date;
          const netAmt = tx.netHostLkr ?? tx.netPayoutLkr;
          const batchCode = tx.payoutBatchId || tx.settlementBatch;

          return (
            <TouchableOpacity
              key={tx.id}
              style={styles.txCard}
              activeOpacity={0.8}
              onPress={() => setExpandedTxId(isExpanded ? null : tx.id)}
            >
              <View style={styles.txTopRow}>
                <View style={styles.txRefCol}>
                  <Text style={styles.txRef}>{refCode}</Text>
                  <Text style={styles.txTraveller}>{tx.travellerName}</Text>
                  <Text style={styles.txTimestamp}>{displayDate}</Text>
                </View>

                <View style={styles.txAmountCol}>
                  <Text style={styles.txNetVal}>
                    +LKR {netAmt.toLocaleString()}
                  </Text>
                  <View
                    style={[
                      styles.txStatusPill,
                      isCleared ? styles.pillCleared : styles.pillPending
                    ]}
                  >
                    <Text
                      style={[
                        styles.txStatusText,
                        isCleared ? styles.textCleared : styles.textPending
                      ]}
                    >
                      {isCleared ? "Cleared Payout" : "Pending Next Batch"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Collapsible calculation breakdown */}
              {isExpanded && (
                <View style={styles.txExpanded}>
                  <View style={styles.txCalcRow}>
                    <Text style={styles.txCalcLabel}>Guest Paid (Gross):</Text>
                    <Text style={styles.txCalcVal}>
                      LKR {tx.grossAmountLkr.toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.txCalcRow}>
                    <Text style={styles.txCalcLabel}>Platform Service Fee (15%):</Text>
                    <Text style={styles.txCalcValFee}>
                      -LKR {tx.platformFeeLkr.toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.txCalcRow}>
                    <Text style={styles.txCalcLabel}>Host Net Settlement (85%):</Text>
                    <Text style={styles.txCalcValNet}>
                      LKR {netAmt.toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.txCalcRow}>
                    <Text style={styles.txCalcLabel}>Settlement Batch ID:</Text>
                    <Text style={styles.txCalcValBatch}>{batchCode}</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Honest Prototype Notice */}
      <View style={styles.prototypeNoticeCard}>
        <MobileIcon name="info" size={16} color={mobileColors.terracotta[600]} />
        <Text style={styles.prototypeNoticeText}>
          <Text style={styles.boldText}>Settlement Ledger Simulation:</Text> Revenue records and
          batch payouts are simulated demonstration data. Banking rails and automated ACH/SLIPS
          disbursements will be integrated during live payment system onboarding.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: mobileColors.sand[100],
    paddingBottom: 40
  },
  headerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginBottom: 4
  },
  pageSubtitle: {
    fontSize: 13,
    color: mobileColors.navy[600],
    lineHeight: 18,
    marginBottom: 12
  },
  scheduleCallout: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mobileColors.sand[100],
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    gap: 8
  },
  scheduleTextCol: {
    flex: 1
  },
  scheduleTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  scheduleSubtitle: {
    fontSize: 11,
    color: mobileColors.navy[600],
    marginTop: 1
  },
  kpiGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.navy[600],
    marginBottom: 4
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  kpiPending: {
    color: mobileColors.terracotta[600]
  },
  kpiSub: {
    fontSize: 10,
    color: mobileColors.sand[600],
    marginTop: 4
  },
  splitCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  splitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12
  },
  splitCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  splitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8
  },
  splitLabel: {
    fontSize: 13,
    color: mobileColors.navy[600]
  },
  splitLabelNet: {
    fontSize: 14,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  splitValGross: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.navy[800]
  },
  splitValFee: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626"
  },
  splitValNet: {
    fontSize: 15,
    fontWeight: "700",
    color: "#15803D"
  },
  splitDivider: {
    height: 1,
    backgroundColor: mobileColors.sand[200],
    marginVertical: 8
  },
  splitDisclaimerBox: {
    backgroundColor: mobileColors.sand[100],
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  splitDisclaimerText: {
    fontSize: 11,
    color: mobileColors.navy[600],
    lineHeight: 15
  },
  bankCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  bankHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12
  },
  bankCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  bankDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6
  },
  bankDetailLabel: {
    fontSize: 12,
    color: mobileColors.navy[500]
  },
  bankDetailValue: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.navy[800]
  },
  ledgerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  filterGroup: {
    flexDirection: "row",
    backgroundColor: mobileColors.sand[200],
    borderRadius: 8,
    padding: 2
  },
  filterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  filterBtnActive: {
    backgroundColor: "#FFFFFF"
  },
  filterBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.navy[600]
  },
  filterBtnTextActive: {
    color: mobileColors.navy[900]
  },
  txList: {
    marginBottom: 16
  },
  txCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  txTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  txRefCol: {
    flex: 1
  },
  txRef: {
    fontSize: 14,
    fontWeight: "700",
    color: mobileColors.navy[900],
    fontFamily: "monospace"
  },
  txTraveller: {
    fontSize: 13,
    color: mobileColors.navy[700],
    marginTop: 2
  },
  txTimestamp: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 1
  },
  txAmountCol: {
    alignItems: "flex-end"
  },
  txNetVal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#15803D"
  },
  txStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4
  },
  pillCleared: {
    backgroundColor: "#DCFCE7"
  },
  pillPending: {
    backgroundColor: "#FEF3C7"
  },
  txStatusText: {
    fontSize: 10,
    fontWeight: "700"
  },
  textCleared: {
    color: "#15803D"
  },
  textPending: {
    color: "#B45309"
  },
  txExpanded: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: mobileColors.sand[200],
    gap: 4
  },
  txCalcRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  txCalcLabel: {
    fontSize: 11,
    color: mobileColors.navy[500]
  },
  txCalcVal: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.navy[800]
  },
  txCalcValFee: {
    fontSize: 11,
    fontWeight: "600",
    color: "#DC2626"
  },
  txCalcValNet: {
    fontSize: 11,
    fontWeight: "700",
    color: "#15803D"
  },
  txCalcValBatch: {
    fontSize: 11,
    fontFamily: "monospace",
    color: mobileColors.navy[600]
  },
  prototypeNoticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    gap: 10
  },
  prototypeNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 16
  },
  boldText: {
    fontWeight: "700"
  }
});
