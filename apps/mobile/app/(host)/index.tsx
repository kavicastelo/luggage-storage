import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet
} from "react-native";
import { useRouter } from "expo-router";
import { useHostStore } from "../../src/store/useHostStore";
import { useAuthStore } from "../../src/store/useAuthStore";
import { MobileIcon } from "../../src/components/MobileIcon";
import { mobileColors } from "../../src/lib/theme";

export default function HostLiveDeskScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { hub, bookings, startIntake } = useHostStore();

  const isHostOwner =
    !isAuthenticated ||
    Boolean(user?.roles?.includes("HOST_OWNER") || user?.roles?.includes("SUPERADMIN"));

  // Operational metrics calculated from reactive store
  const inVaultBookings = bookings.filter((b) => b.status === "IN_STORAGE" || b.status === "OVERDUE");
  const overdueBookings = bookings.filter((b) => b.status === "OVERDUE");
  const confirmedArrivals = bookings.filter((b) => b.status === "CONFIRMED");

  const totalBagsInVault = inVaultBookings.reduce((sum, b) => sum + b.totalBags, 0);
  const capacityPercent = Math.min(
    100,
    Math.round((totalBagsInVault / hub.totalCapacityBags) * 100)
  );

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header & Venue Banner */}
      <View style={styles.venueHeader}>
        <View style={styles.venueTopRow}>
          <View style={styles.activePill}>
            <View style={styles.pulseDot} />
            <Text style={styles.activePillText}>Desk Counter Active</Text>
          </View>
          <Text style={styles.roleTag}>
            {isHostOwner ? "Host Owner View" : "Host Staff View"}
          </Text>
        </View>

        <Text style={styles.venueTitle}>{hub.name}</Text>
        <Text style={styles.venueAddress}>
          {hub.address} • {hub.operatingHours}
        </Text>
      </View>

      {/* Primary Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.primaryScanBtn}
          onPress={() => router.push("/(host)/scanner")}
          accessibilityLabel="Scan Luggage Pass"
        >
          <MobileIcon name="qr-code" size={22} color="#FFFFFF" />
          <View style={styles.btnTextCol}>
            <Text style={styles.scanBtnTitle}>Scan Luggage Pass</Text>
            <Text style={styles.scanBtnSubtitle}>Camera barcode scan or 6-digit PIN</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryIntakeBtn}
          onPress={() => {
            const firstConfirmed = confirmedArrivals[0] || bookings[0];
            if (firstConfirmed) {
              startIntake(firstConfirmed);
            }
            router.push("/(host)/intake");
          }}
          accessibilityLabel="Manual Intake Wizard"
        >
          <MobileIcon name="plus" size={20} color={mobileColors.terracotta[600]} />
          <Text style={styles.intakeBtnText}>Manual Intake</Text>
        </TouchableOpacity>
      </View>

      {/* Overdue Custody Alert (If overdue items exist) */}
      {overdueBookings.length > 0 && (
        <View style={styles.overdueAlertCard}>
          <View style={styles.overdueHeaderRow}>
            <MobileIcon name="alert-triangle" size={18} color="#991B1B" />
            <Text style={styles.overdueAlertTitle}>Overdue Baggage Notice (30m Grace Elapsed)</Text>
          </View>
          <Text style={styles.overdueAlertBody}>
            Guest <Text style={styles.boldText}>{overdueBookings[0].travellerName}</Text> was
            scheduled for collection at {overdueBookings[0].scheduledPickupTime.split("•")[1] || "earlier"}.
            Storage zone: {overdueBookings[0].zoneCode}.
          </Text>
          <View style={styles.overdueActionsRow}>
            <TouchableOpacity
              style={styles.overdueActionBtn}
              onPress={() => router.push("/(host)/vault")}
            >
              <Text style={styles.overdueActionText}>Review in Vault Monitor</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Backroom Vault Capacity Meter */}
      <View style={styles.capacityCard}>
        <View style={styles.capacityHeader}>
          <View>
            <Text style={styles.sectionLabel}>Physical Vault Capacity</Text>
            <Text style={styles.capacityHeadline}>
              {totalBagsInVault} / {hub.totalCapacityBags} Bags Stored
            </Text>
          </View>
          <Text style={styles.capacityPercentage}>{capacityPercent}% Full</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${capacityPercent}%` }]} />
        </View>

        {/* Zone Utilization Chips */}
        <View style={styles.zonesRow}>
          {hub.zones.map((zone) => (
            <View key={zone.code} style={styles.zoneChip}>
              <Text style={styles.zoneCodeText}>{zone.code}</Text>
              <Text style={styles.zoneUtilText}>
                {zone.utilized}/{zone.capacity}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Operational KPI Grid */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Expected Today</Text>
          <Text style={styles.kpiNumber}>{confirmedArrivals.length}</Text>
          <Text style={styles.kpiSub}>Arrival handovers</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Vault Stored</Text>
          <Text style={[styles.kpiNumber, { color: mobileColors.navy[900] }]}>
            {inVaultBookings.length}
          </Text>
          <Text style={styles.kpiSub}>Active guest bags</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Completed Today</Text>
          <Text style={[styles.kpiNumber, { color: "#065F46" }]}>
            {bookings.filter((b) => b.status === "COMPLETED").length}
          </Text>
          <Text style={styles.kpiSub}>Released handovers</Text>
        </View>
      </View>

      {/* Active Custody Movement Queue */}
      <View style={styles.queueCard}>
        <View style={styles.queueHeaderRow}>
          <Text style={styles.sectionTitle}>Today&apos;s Movement Queue</Text>
          <TouchableOpacity onPress={() => router.push("/(host)/requests")}>
            <Text style={styles.viewAllLink}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.queueList}>
          {bookings.slice(0, 4).map((b) => (
            <View key={b.id} style={styles.queueItem}>
              <View style={styles.queueItemLeft}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarLetter}>{b.travellerName.charAt(0)}</Text>
                </View>
                <View>
                  <Text style={styles.travellerName}>{b.travellerName}</Text>
                  <Text style={styles.bookingRef}>
                    {b.reference} • {b.totalBags} {b.totalBags === 1 ? "bag" : "bags"}
                  </Text>
                  <Text style={styles.timingText}>
                    {b.status === "CONFIRMED"
                      ? `Arrival: ${b.scheduledIntakeTime}`
                      : `Pickup: ${b.scheduledPickupTime}`}
                  </Text>
                </View>
              </View>

              <View style={styles.queueItemRight}>
                <View
                  style={[
                    styles.statusPill,
                    b.status === "OVERDUE"
                      ? styles.statusOverdue
                      : b.status === "IN_STORAGE"
                      ? styles.statusInStorage
                      : b.status === "CONFIRMED"
                      ? styles.statusConfirmed
                      : styles.statusCompleted
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      b.status === "OVERDUE"
                        ? styles.textOverdue
                        : b.status === "IN_STORAGE"
                        ? styles.textInStorage
                        : b.status === "CONFIRMED"
                        ? styles.textConfirmed
                        : styles.textCompleted
                    ]}
                  >
                    {b.status === "IN_STORAGE"
                      ? "In Vault"
                      : b.status === "CONFIRMED"
                      ? "Confirmed"
                      : b.status === "OVERDUE"
                      ? "Overdue"
                      : "Released"}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Honest Prototype Notice */}
      <View style={styles.prototypeNoticeCard}>
        <MobileIcon name="info" size={16} color={mobileColors.terracotta[600]} />
        <Text style={styles.prototypeNoticeText}>
          <Text style={styles.boldText}>Live Desk Simulation:</Text> Operational metrics and
          queue movements update local demo session state for {hub.city} Fort Hub. Backend Fastify
          API integration connects in Phase 3+.
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
  venueHeader: {
    backgroundColor: mobileColors.navy[900],
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  venueTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    marginRight: 6
  },
  activePillText: {
    color: "#34D399",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  roleTag: {
    color: mobileColors.sand[300],
    fontSize: 11,
    fontWeight: "500"
  },
  venueTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
    letterSpacing: -0.2
  },
  venueAddress: {
    color: mobileColors.sand[300],
    fontSize: 11,
    lineHeight: 16
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14
  },
  primaryScanBtn: {
    flex: 2,
    backgroundColor: mobileColors.terracotta[500],
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: mobileColors.terracotta[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3
  },
  btnTextCol: {
    marginLeft: 10
  },
  scanBtnTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800"
  },
  scanBtnSubtitle: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 10,
    fontWeight: "500"
  },
  secondaryIntakeBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: mobileColors.sand[300]
  },
  intakeBtnText: {
    color: mobileColors.navy[900],
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4
  },
  overdueAlertCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 14,
    marginBottom: 14
  },
  overdueHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6
  },
  overdueAlertTitle: {
    color: "#991B1B",
    fontSize: 12,
    fontWeight: "800"
  },
  overdueAlertBody: {
    color: "#7F1D1D",
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10
  },
  overdueActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  overdueActionBtn: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  overdueActionText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700"
  },
  capacityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    marginBottom: 14
  },
  capacityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.sand[600],
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  capacityHeadline: {
    fontSize: 16,
    fontWeight: "800",
    color: mobileColors.navy[950],
    marginTop: 2
  },
  capacityPercentage: {
    fontSize: 14,
    fontWeight: "800",
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
    backgroundColor: mobileColors.terracotta[500],
    borderRadius: 4
  },
  zonesRow: {
    flexDirection: "row",
    gap: 8
  },
  zoneChip: {
    flex: 1,
    backgroundColor: mobileColors.sand[100],
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: "center"
  },
  zoneCodeText: {
    fontSize: 10,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  zoneUtilText: {
    fontSize: 9,
    color: mobileColors.sand[600],
    marginTop: 1
  },
  kpiGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    alignItems: "center"
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: mobileColors.sand[600],
    textAlign: "center"
  },
  kpiNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: mobileColors.terracotta[600],
    marginVertical: 4
  },
  kpiSub: {
    fontSize: 9,
    color: mobileColors.sand[600],
    textAlign: "center"
  },
  queueCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    marginBottom: 14
  },
  queueHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: mobileColors.navy[950]
  },
  viewAllLink: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.terracotta[600]
  },
  queueList: {
    gap: 10
  },
  queueItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.sand[100]
  },
  queueItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: mobileColors.navy[900],
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10
  },
  avatarLetter: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700"
  },
  travellerName: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[950]
  },
  bookingRef: {
    fontSize: 10,
    fontFamily: "monospace",
    color: mobileColors.sand[600],
    marginTop: 1
  },
  timingText: {
    fontSize: 10,
    color: mobileColors.sand[600],
    marginTop: 1
  },
  queueItemRight: {
    marginLeft: 8
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  statusOverdue: {
    backgroundColor: "#FEF2F2"
  },
  statusInStorage: {
    backgroundColor: "#EFF6FF"
  },
  statusConfirmed: {
    backgroundColor: "#ECFDF5"
  },
  statusCompleted: {
    backgroundColor: mobileColors.sand[100]
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700"
  },
  textOverdue: {
    color: "#DC2626"
  },
  textInStorage: {
    color: "#2563EB"
  },
  textConfirmed: {
    color: "#059669"
  },
  textCompleted: {
    color: mobileColors.sand[600]
  },
  prototypeNoticeCard: {
    backgroundColor: mobileColors.sand[200],
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 4
  },
  prototypeNoticeText: {
    fontSize: 10,
    color: mobileColors.navy[800],
    lineHeight: 15,
    flex: 1
  },
  boldText: {
    fontWeight: "700"
  }
});
