import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet
} from "react-native";
import { useRouter } from "expo-router";
import { BookingDetail } from "@luggage-storage/contracts";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useHostStore } from "../../src/store/useHostStore";
import { marketplaceApi } from "../../src/services/marketplace-api";
import { DemoHostBooking } from "../../src/data/mock-host-data";
import { MobileIcon } from "../../src/components/MobileIcon";
import { mobileColors } from "../../src/lib/theme";

const HOST_BOOKING_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapHostApiBooking(b: BookingDetail): DemoHostBooking {
  const bags = { SMALL: 0, MEDIUM: 0, LARGE: 0, OVERSIZED: 0 };
  for (const item of b.items) {
    if (item.bagCategory === "BAG_SMALL") bags.SMALL += item.quantity;
    if (item.bagCategory === "BAG_MEDIUM") bags.MEDIUM += item.quantity;
    if (item.bagCategory === "BAG_LARGE") bags.LARGE += item.quantity;
    if (item.bagCategory === "BAG_OVERSIZED") bags.OVERSIZED += item.quantity;
  }
  const status: DemoHostBooking["status"] =
    b.status === "IN_STORAGE"
      ? new Date(b.collectionAt).getTime() < Date.now()
        ? "OVERDUE"
        : "IN_STORAGE"
      : b.status === "COMPLETED"
        ? "COMPLETED"
        : b.status.startsWith("CANCELLED") || b.status === "REJECTED" || b.status === "EXPIRED"
          ? "CANCELLED"
          : "CONFIRMED";
  const commissionMinor =
    b.pricingSnapshot?.platformCommissionMinor ?? Math.round(b.totalAmountMinor * 0.15);
  const netMinor = b.pricingSnapshot?.hostPayableMinor ?? b.totalAmountMinor - commissionMinor;

  return {
    id: b.id,
    reference: b.referenceCode,
    travellerName: b.travellerDisplayName || `Guest (${b.travellerUserId.slice(0, 8)})`,
    travellerCountry: "LK",
    travellerPhone: "Protected Platform Contact",
    status,
    scheduledIntakeTime: new Date(b.dropOffAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    }),
    scheduledPickupTime: new Date(b.collectionAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    }),
    dropOffTimestamp: new Date(b.dropOffAt).getTime(),
    pickUpTimestamp: new Date(b.collectionAt).getTime(),
    bags,
    totalBags: b.totalBags,
    totalAmountLkr: Math.round(b.totalAmountMinor / 100),
    hostNetPayoutLkr: Math.round(netMinor / 100),
    platformFeeLkr: Math.round(commissionMinor / 100),
    qrPayload: "SINGLE_USE_HASHED",
    pinCode: "Counter PIN",
    sealNumbers: [],
    zoneCode: "COUNTER",
    photoEvidenceCaptured: false,
    notes: b.status === "PENDING_HOST_APPROVAL" ? "Awaiting Host Approval" : b.travellerNotes || undefined
  };
}

type FilterTab = "ALL" | "CONFIRMED" | "IN_STORAGE" | "OVERDUE" | "COMPLETED";

export default function HostRequestsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { bookings: storeBookings, startIntake, declineRequest } = useHostStore();
  const [liveBookings, setLiveBookings] = useState<DemoHostBooking[] | null>(null);
  const [pendingApprovalIds, setPendingApprovalIds] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    marketplaceApi
      .getHostBookings()
      .then((res) => {
        if (active && res.bookings.length > 0) {
          const approvalMap: Record<string, boolean> = {};
          for (const item of res.bookings) {
            if (item.status === "PENDING_HOST_APPROVAL") {
              approvalMap[item.id] = true;
            }
          }
          setPendingApprovalIds(approvalMap);
          setLiveBookings(res.bookings.map(mapHostApiBooking));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const bookings = liveBookings ?? storeBookings;

  const filterCounts = useMemo(() => {
    return {
      ALL: bookings.length,
      CONFIRMED: bookings.filter((b) => b.status === "CONFIRMED").length,
      IN_STORAGE: bookings.filter((b) => b.status === "IN_STORAGE").length,
      OVERDUE: bookings.filter((b) => b.status === "OVERDUE").length,
      COMPLETED: bookings.filter((b) => b.status === "COMPLETED").length
    };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Filter tab check
      if (activeFilter !== "ALL" && b.status !== activeFilter) {
        return false;
      }
      // Search query check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesRef = b.reference.toLowerCase().includes(q);
        const matchesName = b.travellerName.toLowerCase().includes(q);
        const matchesPin = b.pinCode.toLowerCase().includes(q);
        const matchesZone = b.zoneCode?.toLowerCase().includes(q);
        if (!matchesRef && !matchesName && !matchesPin && !matchesZone) {
          return false;
        }
      }
      return true;
    });
  }, [bookings, activeFilter, searchQuery]);

  const handleStartIntake = (booking: DemoHostBooking) => {
    startIntake(booking);
    router.push({
      pathname: "/(host)/intake",
      params: { ref: booking.reference }
    });
  };

  const handleGoToVault = () => {
    router.push("/(host)/vault");
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.headerCard}>
        <Text style={styles.pageTitle}>Luggage Requests & Bookings</Text>
        <Text style={styles.pageSubtitle}>
          Monitor expected guest drop-offs, active vault custody, and historical releases.
        </Text>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <MobileIcon name="search" size={18} color={mobileColors.sand[600]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, reference (LS-...), or PIN"
            placeholderTextColor={mobileColors.sand[500]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearBtn}>
              <MobileIcon name="x" size={16} color={mobileColors.sand[600]} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterTabsContainer}
      >
        {(
          [
            { key: "ALL", label: "All Records" },
            { key: "CONFIRMED", label: "Incoming" },
            { key: "IN_STORAGE", label: "In Vault" },
            { key: "OVERDUE", label: "Overdue" },
            { key: "COMPLETED", label: "Released" }
          ] as const
        ).map((tab) => {
          const isActive = activeFilter === tab.key;
          const count = filterCounts[tab.key];
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveFilter(tab.key)}
            >
              <Text style={[styles.filterChipLabel, isActive && styles.filterChipLabelActive]}>
                {tab.label}
              </Text>
              <View style={[styles.filterChipBadge, isActive && styles.filterChipBadgeActive]}>
                <Text style={[styles.filterChipBadgeText, isActive && styles.filterChipBadgeTextActive]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bookings List */}
      <View style={styles.listSection}>
        {filteredBookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <MobileIcon name="inbox" size={36} color={mobileColors.sand[400]} />
            <Text style={styles.emptyTitle}>No matching bookings found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? `No bookings match "${searchQuery}". Try searching by reference or traveller name.`
                : `There are currently no bookings with status "${activeFilter}".`}
            </Text>
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.resetSearchBtn}
                onPress={() => setSearchQuery("")}
              >
                <Text style={styles.resetSearchBtnText}>Clear Search Filter</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredBookings.map((booking) => {
            const isExpanded = expandedBookingId === booking.id;
            return (
              <View key={booking.id} style={styles.bookingCard}>
                {/* Top Row: Ref & Status */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.refCol}>
                    <Text style={styles.bookingRef}>{booking.reference}</Text>
                    <Text style={styles.guestName}>{booking.travellerName}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      booking.status === "OVERDUE"
                        ? styles.statusOverdue
                        : booking.status === "IN_STORAGE"
                        ? styles.statusInStorage
                        : booking.status === "CONFIRMED"
                        ? styles.statusConfirmed
                        : styles.statusCompleted
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        booking.status === "OVERDUE"
                          ? styles.textOverdue
                          : booking.status === "IN_STORAGE"
                          ? styles.textInStorage
                          : booking.status === "CONFIRMED"
                          ? styles.textConfirmed
                          : styles.textCompleted
                      ]}
                    >
                      {booking.status === "IN_STORAGE"
                        ? "In Vault"
                        : booking.status === "CONFIRMED"
                        ? "Expected Intake"
                        : booking.status === "OVERDUE"
                        ? "Overdue Alert"
                        : "Released"}
                    </Text>
                  </View>
                </View>

                {/* Metrics Row: Bags, Time, PIN */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricBlock}>
                    <Text style={styles.metricLabel}>Baggage Count</Text>
                    <Text style={styles.metricVal}>
                      {booking.totalBags} {booking.totalBags === 1 ? "Piece" : "Pieces"}
                    </Text>
                  </View>

                  <View style={styles.metricBlock}>
                    <Text style={styles.metricLabel}>
                      {booking.status === "CONFIRMED" ? "Scheduled Arrival" : "Scheduled Pickup"}
                    </Text>
                    <Text style={styles.metricVal}>
                      {booking.status === "CONFIRMED"
                        ? booking.scheduledIntakeTime
                        : booking.scheduledPickupTime}
                    </Text>
                  </View>

                  <View style={styles.metricBlock}>
                    <Text style={styles.metricLabel}>Pass PIN</Text>
                    <Text style={styles.metricValPin}>{booking.pinCode}</Text>
                  </View>
                </View>

                {/* Details Accordion Content */}
                {isExpanded && (
                  <View style={styles.expandedDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Vault Zone:</Text>
                      <Text style={styles.detailValue}>
                        {booking.zoneCode ? `Zone ${booking.zoneCode}` : "Unassigned (Pending Intake)"}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Security Seal:</Text>
                      <Text style={styles.detailValue}>
                        {booking.sealNumbers.length > 0
                          ? booking.sealNumbers.join(", ")
                          : "Not Tagged (Issued at Intake)"}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Traveller Contact:</Text>
                      <Text style={styles.detailValue}>{booking.travellerPhone}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Total Amount:</Text>
                      <Text style={styles.detailValue}>
                        LKR {booking.totalAmountLkr.toLocaleString()} (Paid Online)
                      </Text>
                    </View>

                    {booking.notes && (
                      <View style={styles.notesBlock}>
                        <Text style={styles.notesLabel}>Special Handling Notes:</Text>
                        <Text style={styles.notesValue}>{booking.notes}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Action Buttons & Expand Toggle */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.toggleDetailsBtn}
                    onPress={() =>
                      setExpandedBookingId(isExpanded ? null : booking.id)
                    }
                  >
                    <Text style={styles.toggleDetailsText}>
                      {isExpanded ? "Hide Details ▲" : "View Details ▼"}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.actionBtnGroup}>
                    {booking.status === "CONFIRMED" && (
                      <>
                        <TouchableOpacity
                          style={styles.declineBtn}
                          onPress={async () => {
                            if (HOST_BOOKING_UUID.test(booking.id)) {
                              try {
                                const updated = await marketplaceApi.rejectHostBooking(booking.id, {
                                  reason: "Declined via Host Mobile Desk"
                                });
                                setPendingApprovalIds((p) => ({ ...p, [booking.id]: false }));
                                setLiveBookings((prev) =>
                                  prev
                                    ? prev.map((b) =>
                                        b.id === booking.id ? mapHostApiBooking(updated) : b
                                      )
                                    : prev
                                );
                                return;
                              } catch {
                                // Fallback to store action
                              }
                            }
                            declineRequest(booking.id);
                          }}
                        >
                          <Text style={styles.declineBtnText}>Decline</Text>
                        </TouchableOpacity>

                        {pendingApprovalIds[booking.id] ? (
                          <TouchableOpacity
                            style={styles.intakeActionBtn}
                            onPress={async () => {
                              try {
                                const updated = await marketplaceApi.acceptHostBooking(booking.id, {
                                  reason: "Accepted via Host Mobile Desk"
                                });
                                setPendingApprovalIds((p) => ({ ...p, [booking.id]: false }));
                                setLiveBookings((prev) =>
                                  prev
                                    ? prev.map((b) =>
                                        b.id === booking.id ? mapHostApiBooking(updated) : b
                                      )
                                    : prev
                                );
                              } catch {
                                // Keep request visible on error
                              }
                            }}
                          >
                            <Text style={styles.intakeActionBtnText}>Accept</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.intakeActionBtn}
                            onPress={() => handleStartIntake(booking)}
                          >
                            <Text style={styles.intakeActionBtnText}>Start Intake</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}

                    {(booking.status === "IN_STORAGE" || booking.status === "OVERDUE") && (
                      <TouchableOpacity
                        style={styles.vaultActionBtn}
                        onPress={handleGoToVault}
                      >
                        <Text style={styles.vaultActionBtnText}>Manage in Vault</Text>
                      </TouchableOpacity>
                    )}

                    {booking.status === "COMPLETED" && (
                      <View style={styles.completedBadge}>
                        <MobileIcon name="check-circle" size={14} color="#15803D" />
                        <Text style={styles.completedBadgeText}>Custody Cleared</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Honest Prototype Notice */}
      <View style={styles.prototypeNoticeCard}>
        <MobileIcon name="info" size={16} color={mobileColors.terracotta[600]} />
        <Text style={styles.prototypeNoticeText}>
          <Text style={styles.boldText}>Prototype Simulation:</Text> Bookings and status changes
          are updated in the local mobile session store. Actions do not alter live production databases.
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mobileColors.sand[100],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: mobileColors.navy[900],
    marginLeft: 8,
    padding: 0
  },
  clearBtn: {
    padding: 4
  },
  filterTabsContainer: {
    paddingBottom: 12,
    gap: 8,
    flexDirection: "row"
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    marginRight: 6
  },
  filterChipActive: {
    backgroundColor: mobileColors.terracotta[600],
    borderColor: mobileColors.terracotta[600]
  },
  filterChipLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.navy[700],
    marginRight: 6
  },
  filterChipLabelActive: {
    color: "#FFFFFF"
  },
  filterChipBadge: {
    backgroundColor: mobileColors.sand[200],
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1
  },
  filterChipBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)"
  },
  filterChipBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.navy[800]
  },
  filterChipBadgeTextActive: {
    color: "#FFFFFF"
  },
  listSection: {
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
    lineHeight: 18,
    marginBottom: 16
  },
  resetSearchBtn: {
    backgroundColor: mobileColors.sand[200],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  resetSearchBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.navy[800]
  },
  bookingCard: {
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
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12
  },
  refCol: {
    flex: 1
  },
  bookingRef: {
    fontSize: 15,
    fontWeight: "700",
    color: mobileColors.navy[900],
    fontFamily: "monospace"
  },
  guestName: {
    fontSize: 14,
    color: mobileColors.navy[700],
    marginTop: 2
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  statusConfirmed: {
    backgroundColor: "#EFF6FF"
  },
  statusInStorage: {
    backgroundColor: "#FEF3C7"
  },
  statusOverdue: {
    backgroundColor: "#FEE2E2"
  },
  statusCompleted: {
    backgroundColor: "#DCFCE7"
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700"
  },
  textConfirmed: {
    color: "#1D4ED8"
  },
  textInStorage: {
    color: "#B45309"
  },
  textOverdue: {
    color: "#DC2626"
  },
  textCompleted: {
    color: "#15803D"
  },
  metricsRow: {
    flexDirection: "row",
    backgroundColor: mobileColors.sand[100],
    borderRadius: 10,
    padding: 10,
    marginBottom: 12
  },
  metricBlock: {
    flex: 1
  },
  metricLabel: {
    fontSize: 11,
    color: mobileColors.navy[500],
    marginBottom: 2
  },
  metricVal: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.navy[900]
  },
  metricValPin: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.terracotta[600],
    fontFamily: "monospace"
  },
  expandedDetails: {
    backgroundColor: mobileColors.sand[100],
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6
  },
  detailLabel: {
    fontSize: 12,
    color: mobileColors.navy[500],
    fontWeight: "500"
  },
  detailValue: {
    fontSize: 12,
    color: mobileColors.navy[800],
    fontWeight: "600"
  },
  notesBlock: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: mobileColors.sand[200]
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.navy[600],
    marginBottom: 2
  },
  notesValue: {
    fontSize: 12,
    color: mobileColors.navy[800],
    fontStyle: "italic"
  },
  cardActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  toggleDetailsBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4
  },
  toggleDetailsText: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.navy[600]
  },
  actionBtnGroup: {
    flexDirection: "row",
    gap: 8
  },
  declineBtn: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  declineBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626"
  },
  intakeActionBtn: {
    backgroundColor: mobileColors.terracotta[600],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  intakeActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  vaultActionBtn: {
    backgroundColor: mobileColors.navy[900],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  vaultActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#15803D"
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
