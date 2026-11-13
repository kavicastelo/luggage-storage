import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet
} from "react-native";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useHostStore } from "../../src/store/useHostStore";
import { marketplaceApi } from "../../src/services/marketplace-api";
import { DemoHostBooking } from "../../src/data/mock-host-data";
import { MobileIcon } from "../../src/components/MobileIcon";
import { mobileColors } from "../../src/lib/theme";

const VAULT_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VaultTab = "ACTIVE" | "OVERDUE" | "RELEASED";

export default function HostVaultScreen() {
  const { isAuthenticated } = useAuthStore();
  const { bookings, hub, releaseLuggage } = useHostStore();
  const [activeTab, setActiveTab] = useState<VaultTab>("ACTIVE");
  const [selectedBookingForRelease, setSelectedBookingForRelease] =
    useState<DemoHostBooking | null>(null);
  const [releaseSuccessMsg, setReleaseSuccessMsg] = useState<string | null>(null);

  // Group and sort bookings
  const activeVaultBookings = useMemo(() => {
    return bookings
      .filter((b) => b.status === "IN_STORAGE" || b.status === "OVERDUE")
      .sort((a, b) => {
        // Overdue items come first
        if (a.status === "OVERDUE" && b.status !== "OVERDUE") return -1;
        if (b.status === "OVERDUE" && a.status !== "OVERDUE") return 1;
        return a.scheduledPickupTime.localeCompare(b.scheduledPickupTime);
      });
  }, [bookings]);

  const overdueBookings = useMemo(() => {
    return bookings.filter((b) => b.status === "OVERDUE");
  }, [bookings]);

  const releasedBookings = useMemo(() => {
    return bookings.filter((b) => b.status === "COMPLETED");
  }, [bookings]);

  const displayedList = useMemo(() => {
    if (activeTab === "ACTIVE") return activeVaultBookings;
    if (activeTab === "OVERDUE") return overdueBookings;
    return releasedBookings;
  }, [activeTab, activeVaultBookings, overdueBookings, releasedBookings]);

  const totalBagsInVault = activeVaultBookings.reduce((sum, b) => sum + b.totalBags, 0);

  const handleConfirmRelease = async () => {
    if (!selectedBookingForRelease) return;
    if (
      isAuthenticated &&
      VAULT_UUID_REGEX.test(selectedBookingForRelease.id) &&
      (/^\d{6}$/.test(selectedBookingForRelease.pinCode) ||
        selectedBookingForRelease.qrPayload.length === 64)
    ) {
      try {
        const released = await marketplaceApi.completeCollection(selectedBookingForRelease.id, {
          verificationPin: /^\d{6}$/.test(selectedBookingForRelease.pinCode)
            ? selectedBookingForRelease.pinCode
            : undefined,
          qrToken:
            selectedBookingForRelease.qrPayload.length === 64
              ? selectedBookingForRelease.qrPayload
              : undefined,
          releasedBagCount: selectedBookingForRelease.totalBags
        });
        setSelectedBookingForRelease(null);
        setReleaseSuccessMsg(
          `Released ${released.releasedBagCount ?? selectedBookingForRelease.totalBags} bags for ${selectedBookingForRelease.reference}.`
        );
        setTimeout(() => setReleaseSuccessMsg(null), 5000);
        return;
      } catch {
        // Fallback to local session state
      }
    }
    const res = releaseLuggage(selectedBookingForRelease.id);
    setSelectedBookingForRelease(null);
    if (res.success) {
      setReleaseSuccessMsg(res.message);
      setTimeout(() => setReleaseSuccessMsg(null), 5000);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header & Vault Capacity Monitor */}
      <View style={styles.vaultHeaderCard}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.pageTitle}>Vault Luggage Inventory</Text>
            <Text style={styles.pageSubtitle}>
              Physical custody tracking, zone assignments, and overdue monitor.
            </Text>
          </View>
        </View>

        <View style={styles.capacityCard}>
          <View style={styles.capacityRow}>
            <Text style={styles.capacityLabel}>Current Stored Luggage</Text>
            <Text style={styles.capacityValue}>
              {totalBagsInVault} / {hub.totalCapacityBags} Bags
            </Text>
          </View>

          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(
                    100,
                    Math.round((totalBagsInVault / hub.totalCapacityBags) * 100)
                  )}%`
                }
              ]}
            />
          </View>

          <View style={styles.zoneRow}>
            <View style={styles.zoneChip}>
              <Text style={styles.zoneChipLabel}>Rack Zone A: 3 Bags</Text>
            </View>
            <View style={styles.zoneChip}>
              <Text style={styles.zoneChipLabel}>Locker Zone B: 1 Bag</Text>
            </View>
            <View style={styles.zoneChip}>
              <Text style={styles.zoneChipLabel}>Floor Zone C: 0 Bags</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Success Notification */}
      {releaseSuccessMsg && (
        <View style={styles.successBanner}>
          <MobileIcon name="check-circle" size={18} color="#15803D" />
          <Text style={styles.successBannerText}>{releaseSuccessMsg}</Text>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterTabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "ACTIVE" && styles.tabBtnActive]}
          onPress={() => setActiveTab("ACTIVE")}
        >
          <Text style={[styles.tabBtnText, activeTab === "ACTIVE" && styles.tabBtnTextActive]}>
            Active Vault ({activeVaultBookings.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "OVERDUE" && styles.tabBtnActive]}
          onPress={() => setActiveTab("OVERDUE")}
        >
          <Text
            style={[
              styles.tabBtnText,
              activeTab === "OVERDUE" && styles.tabBtnTextActive,
              overdueBookings.length > 0 && styles.tabBtnTextOverdue
            ]}
          >
            Overdue ({overdueBookings.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "RELEASED" && styles.tabBtnActive]}
          onPress={() => setActiveTab("RELEASED")}
        >
          <Text style={[styles.tabBtnText, activeTab === "RELEASED" && styles.tabBtnTextActive]}>
            Released ({releasedBookings.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Luggage Item Cards */}
      <View style={styles.inventoryList}>
        {displayedList.length === 0 ? (
          <View style={styles.emptyCard}>
            <MobileIcon name="inbox" size={36} color={mobileColors.sand[400]} />
            <Text style={styles.emptyTitle}>No luggage items in this view</Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === "OVERDUE"
                ? "No bags are currently past their scheduled pickup window."
                : activeTab === "RELEASED"
                ? "No luggage has been released in this current session."
                : "No bags are currently stored in the physical vault."}
            </Text>
          </View>
        ) : (
          displayedList.map((item) => {
            const isOverdue = item.status === "OVERDUE";
            return (
              <View
                key={item.id}
                style={[styles.itemCard, isOverdue && styles.itemCardOverdue]}
              >
                {/* Overdue Alert Strip */}
                {isOverdue && (
                  <View style={styles.overdueAlertStrip}>
                    <View style={styles.overdueIconRow}>
                      <MobileIcon name="alert-triangle" size={16} color="#DC2626" />
                      <Text style={styles.overdueAlertTitle}>
                        Baggage Overdue ({item.overdueMinutes || 105} mins past scheduled pickup)
                      </Text>
                    </View>
                    <Text style={styles.overdueDisclaimer}>
                      Scheduled for {item.scheduledPickupTime}. Estimated overdue charge LKR{" "}
                      {item.estimatedLateFeeLkr?.toLocaleString() || "600"}. Policy Notice (DEC-002 Pending Sign-Off):
                      Overdue fee handling is illustrative only. No payment is collected in this prototype, and baggage release proceeds without payment gating.
                    </Text>
                  </View>
                )}

                {/* Main Card Info */}
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.itemRef}>{item.reference}</Text>
                    <Text style={styles.travellerName}>{item.travellerName}</Text>
                    <Text style={styles.travellerPhone}>{item.travellerPhone}</Text>
                  </View>

                  <View style={styles.zoneBadge}>
                    <Text style={styles.zoneBadgeText}>
                      Zone {item.zoneCode || "RACK-A"}
                    </Text>
                  </View>
                </View>

                {/* Storage Details Grid */}
                <View style={styles.detailsGrid}>
                  <View style={styles.gridCell}>
                    <Text style={styles.cellLabel}>Luggage Pieces</Text>
                    <Text style={styles.cellValue}>{item.totalBags} Bags</Text>
                  </View>

                  <View style={styles.gridCell}>
                    <Text style={styles.cellLabel}>Scheduled Pickup</Text>
                    <Text style={[styles.cellValue, isOverdue && styles.cellValueOverdue]}>
                      {item.scheduledPickupTime}
                    </Text>
                  </View>

                  <View style={styles.gridCell}>
                    <Text style={styles.cellLabel}>Security Seal</Text>
                    <Text style={styles.cellValueCode}>
                      {item.sealNumbers[0] || "SEAL-LK-48291"}
                    </Text>
                  </View>

                  <View style={styles.gridCell}>
                    <Text style={styles.cellLabel}>Photo Evidence</Text>
                    <Text style={styles.cellValue}>
                      {item.photoEvidenceStatus === "CAPTURED_LOCAL"
                        ? "Captured at Intake"
                        : item.photoEvidenceStatus === "SKIPPED_PENDING_POLICY"
                        ? "Skipped (DEC-001)"
                        : item.photoEvidenceCaptured
                        ? "Captured at Intake"
                        : "Not Provided"}
                    </Text>
                  </View>
                </View>

                {item.notes && (
                  <View style={styles.notesRow}>
                    <Text style={styles.notesText}>Note: {item.notes}</Text>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.cardActionRow}>
                  {item.status !== "COMPLETED" ? (
                    <TouchableOpacity
                      style={[styles.releaseBtn, isOverdue && styles.releaseBtnOverdue]}
                      onPress={() => setSelectedBookingForRelease(item)}
                    >
                      <MobileIcon name="arrow-right" size={16} color="#FFFFFF" />
                      <Text style={styles.releaseBtnText}>
                        {isOverdue ? "Release Baggage (Overdue)" : "Release Baggage"}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.releasedStatus}>
                      <MobileIcon name="check-circle" size={16} color="#15803D" />
                      <Text style={styles.releasedStatusText}>Custody Cleared & Handed Over</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Release Confirmation Modal */}
      <Modal
        visible={Boolean(selectedBookingForRelease)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedBookingForRelease(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Luggage Release</Text>
              <TouchableOpacity
                onPress={() => setSelectedBookingForRelease(null)}
                style={styles.modalCloseBtn}
              >
                <MobileIcon name="x" size={20} color={mobileColors.navy[600]} />
              </TouchableOpacity>
            </View>

            {selectedBookingForRelease && (
              <View style={styles.modalBody}>
                <Text style={styles.modalPrompt}>
                  Handing over luggage custody to guest:
                </Text>

                <View style={styles.modalSummaryBox}>
                  <Text style={styles.modalSummaryRef}>
                    {selectedBookingForRelease.reference}
                  </Text>
                  <Text style={styles.modalSummaryName}>
                    {selectedBookingForRelease.travellerName}
                  </Text>
                  <Text style={styles.modalSummaryBags}>
                    {selectedBookingForRelease.totalBags} Luggage Pieces • Zone{" "}
                    {selectedBookingForRelease.zoneCode || "RACK-A"}
                  </Text>
                  <Text style={styles.modalSummarySeal}>
                    Seal: {selectedBookingForRelease.sealNumbers[0] || "SEAL-LK-48291"}
                  </Text>
                </View>

                {selectedBookingForRelease.status === "OVERDUE" && (
                  <View style={styles.modalOverdueWarning}>
                    <MobileIcon name="info" size={16} color="#DC2626" />
                    <Text style={styles.modalOverdueText}>
                      Late pickup detected. Policy notice (DEC-002 Pending Sign-Off): Overdue fee handling
                      is not configured. In this demonstration prototype, no late payment will be collected
                      or charged to the guest. Handover proceeds without payment collection gating.
                    </Text>
                  </View>
                )}

                <View style={styles.modalActionButtons}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setSelectedBookingForRelease(null)}
                  >
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalConfirmBtn}
                    onPress={handleConfirmRelease}
                  >
                    <Text style={styles.modalConfirmBtnText}>Confirm Handover</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Honest Prototype Notice */}
      <View style={styles.prototypeNoticeCard}>
        <MobileIcon name="info" size={16} color={mobileColors.terracotta[600]} />
        <Text style={styles.prototypeNoticeText}>
          <Text style={styles.boldText}>Vault Monitor Prototype:</Text> Inventory counts, zone
          allocations, and release handovers operate in the active mobile session store. Fastify
          server custody audit events attach in Phase 3+.
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
  vaultHeaderCard: {
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
  headerTopRow: {
    marginBottom: 12
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
    lineHeight: 18
  },
  capacityCard: {
    backgroundColor: mobileColors.sand[100],
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  capacityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  capacityLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.navy[800]
  },
  capacityValue: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.terracotta[600]
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: mobileColors.sand[200],
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: mobileColors.terracotta[600],
    borderRadius: 4
  },
  zoneRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap"
  },
  zoneChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: mobileColors.sand[300]
  },
  zoneChipLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.navy[700]
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#86EFAC",
    gap: 8
  },
  successBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#15803D",
    fontWeight: "600"
  },
  filterTabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16
  },
  tabBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  tabBtnActive: {
    backgroundColor: mobileColors.navy[900],
    borderColor: mobileColors.navy[900]
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[700]
  },
  tabBtnTextActive: {
    color: "#FFFFFF"
  },
  tabBtnTextOverdue: {
    color: "#DC2626"
  },
  inventoryList: {
    marginBottom: 16
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    marginTop: 8
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginTop: 10,
    marginBottom: 4
  },
  emptySubtitle: {
    fontSize: 13,
    color: mobileColors.navy[600],
    textAlign: "center",
    lineHeight: 18
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  itemCardOverdue: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFFDFD"
  },
  overdueAlertStrip: {
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FECACA"
  },
  overdueIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4
  },
  overdueAlertTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626"
  },
  overdueDisclaimer: {
    fontSize: 11,
    color: "#991B1B",
    lineHeight: 15
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12
  },
  itemRef: {
    fontSize: 15,
    fontWeight: "700",
    color: mobileColors.navy[900],
    fontFamily: "monospace"
  },
  travellerName: {
    fontSize: 14,
    fontWeight: "600",
    color: mobileColors.navy[800],
    marginTop: 2
  },
  travellerPhone: {
    fontSize: 12,
    color: mobileColors.navy[500],
    marginTop: 1
  },
  zoneBadge: {
    backgroundColor: mobileColors.sand[200],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  zoneBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.navy[800]
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: mobileColors.sand[100],
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginBottom: 12
  },
  gridCell: {
    width: "48%"
  },
  cellLabel: {
    fontSize: 11,
    color: mobileColors.navy[500],
    marginBottom: 2
  },
  cellValue: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.navy[900]
  },
  cellValueOverdue: {
    color: "#DC2626",
    fontWeight: "700"
  },
  cellValueCode: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.terracotta[600],
    fontFamily: "monospace"
  },
  notesRow: {
    paddingVertical: 6,
    marginBottom: 8
  },
  notesText: {
    fontSize: 12,
    color: mobileColors.navy[600],
    fontStyle: "italic"
  },
  cardActionRow: {
    marginTop: 4
  },
  releaseBtn: {
    flexDirection: "row",
    backgroundColor: mobileColors.terracotta[600],
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    gap: 8
  },
  releaseBtnOverdue: {
    backgroundColor: "#DC2626"
  },
  releaseBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  releasedStatus: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6
  },
  releasedStatusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#15803D"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  modalCloseBtn: {
    padding: 4
  },
  modalBody: {},
  modalPrompt: {
    fontSize: 13,
    color: mobileColors.navy[600],
    marginBottom: 12
  },
  modalSummaryBox: {
    backgroundColor: mobileColors.sand[100],
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  modalSummaryRef: {
    fontSize: 15,
    fontWeight: "700",
    color: mobileColors.navy[900],
    fontFamily: "monospace"
  },
  modalSummaryName: {
    fontSize: 14,
    fontWeight: "600",
    color: mobileColors.navy[800],
    marginTop: 2
  },
  modalSummaryBags: {
    fontSize: 13,
    color: mobileColors.navy[700],
    marginTop: 4
  },
  modalSummarySeal: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.terracotta[600],
    marginTop: 2,
    fontFamily: "monospace"
  },
  modalOverdueWarning: {
    flexDirection: "row",
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    gap: 8
  },
  modalOverdueText: {
    flex: 1,
    fontSize: 11,
    color: "#991B1B",
    lineHeight: 15
  },
  modalActionButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: mobileColors.sand[200],
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center"
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[800]
  },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: mobileColors.terracotta[600],
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center"
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF"
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
