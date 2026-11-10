import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useHostStore } from "../../src/store/useHostStore";
import { MobileIcon } from "../../src/components/MobileIcon";
import { mobileColors } from "../../src/lib/theme";
import { marketplaceApi } from "../../src/services/marketplace-api";
import { HostBusiness, StorageLocation } from "@luggage-storage/contracts";

export default function HostSettingsScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { activeDemoRole, hub, resetToDefaults } = useHostStore();
  const [resetSuccess, setResetSuccess] = useState(false);
  const [liveBusiness, setLiveBusiness] = useState<HostBusiness | null>(null);
  const [liveLocation, setLiveLocation] = useState<StorageLocation | null>(null);

  const isOwner = isAuthenticated
    ? Boolean(user?.roles?.includes("HOST_OWNER") || user?.roles?.includes("SUPERADMIN"))
    : activeDemoRole === "HOST_OWNER";

  useEffect(() => {
    let isMounted = true;
    async function loadLiveHostData() {
      if (!isOwner) return;
      try {
        const businesses = await marketplaceApi.getOwnedBusinesses();
        if (isMounted && businesses && businesses.length > 0) {
          setLiveBusiness(businesses[0]);
        }
        const locations = await marketplaceApi.getOwnedLocations();
        if (isMounted && locations && locations.length > 0) {
          setLiveLocation(locations[0]);
        }
      } catch {
        // Fallback to local store fixtures
      }
    }
    loadLiveHostData();
    return () => {
      isMounted = false;
    };
  }, [isOwner]);

  // Role Guard for Host Staff
  if (!isOwner) {
    return (
      <View style={styles.deniedContainer}>
        <View style={styles.deniedCard}>
          <Text style={styles.deniedBadge}>RBAC Guard • 403 Forbidden</Text>
          <Text style={styles.deniedTitle}>Host Owner Access Required</Text>
          <Text style={styles.deniedBody}>
            Partner profile settings, business compliance records, and session configuration
            are restricted to Host Owner accounts. Staff members have operational access only
            (Live Desk, Requests, Scanner, Intake, and Vault).
          </Text>
          <TouchableOpacity
            style={styles.returnDeskBtn}
            onPress={() => router.replace("/(host)")}
          >
            <Text style={styles.returnDeskBtnText}>Return to Live Desk</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleReset = () => {
    resetToDefaults();
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 3000);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <Text style={styles.pageTitle}>Storage Partner Profile</Text>
        <Text style={styles.pageSubtitle}>
          Location configurations, counter staff directory, and simulated business credentials.
        </Text>
      </View>

      {resetSuccess && (
        <View style={styles.successBanner}>
          <MobileIcon name="check-circle" size={18} color="#15803D" />
          <Text style={styles.successBannerText}>
            Local session reset to canonical initial state.
          </Text>
        </View>
      )}

      {/* Facility & Location Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MobileIcon name="map-pin" size={18} color={mobileColors.terracotta[600]} />
          <Text style={styles.sectionTitle}>Physical Facility Details</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Facility Name:</Text>
          <Text style={styles.detailValue}>{liveLocation?.name || hub.name}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Location Identifier:</Text>
          <Text style={styles.detailCode}>{liveLocation?.id || hub.id}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Physical Address:</Text>
          <Text style={styles.detailValue}>
            {liveLocation?.addressLine1 ? `${liveLocation.addressLine1}, ${liveLocation.city}` : hub.address}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Operating Hours:</Text>
          <Text style={styles.detailValue}>{hub.operatingHours}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status:</Text>
          <Text style={styles.detailValue}>{liveLocation?.status || "ACTIVE"}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Luggage Capacity:</Text>
          <Text style={styles.detailValue}>{hub.totalCapacityBags} Bags Maximum</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Active Host Staff:</Text>
          <Text style={styles.detailValue}>{hub.primaryHostName}</Text>
        </View>
      </View>

      {/* Team Directory Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MobileIcon name="users" size={18} color={mobileColors.navy[900]} />
          <Text style={styles.sectionTitle}>Counter Staff Directory</Text>
        </View>

        <View style={styles.teamMemberRow}>
          <View style={styles.avatarPill}>
            <Text style={styles.avatarInitials}>RF</Text>
          </View>
          <View style={styles.teamTextCol}>
            <Text style={styles.memberName}>Roshan Fernando</Text>
            <Text style={styles.memberRole}>Counter Supervisor • Active On-Duty</Text>
            <Text style={styles.memberContact}>+94 77 123 4567 • Staff ID #STF-084</Text>
          </View>
        </View>

        <View style={styles.teamDivider} />

        <View style={styles.teamMemberRow}>
          <View style={styles.avatarPill}>
            <Text style={styles.avatarInitials}>PW</Text>
          </View>
          <View style={styles.teamTextCol}>
            <Text style={styles.memberName}>Priyantha Wickramasinghe</Text>
            <Text style={styles.memberRole}>Partner Business Owner • Admin</Text>
            <Text style={styles.memberContact}>+94 71 987 6543 • Host ID #HST-012</Text>
          </View>
        </View>
      </View>

      {/* Business Credentials (DEC-010 Compliant) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MobileIcon name="shield" size={18} color={mobileColors.terracotta[600]} />
          <Text style={styles.sectionTitle}>Host Business &amp; Compliance Records (Simulated Compliance Records)</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Trade / Brand Name:</Text>
          <Text style={styles.detailValue}>{liveBusiness?.tradeName || "Colombo Fort Hub"}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Legal Entity Name:</Text>
          <Text style={styles.detailValue}>{liveBusiness?.legalBusinessName || "Lanka Storage Hub PVT LTD"}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Business Reg. No (BRN):</Text>
          <Text style={styles.detailCode}>{liveBusiness?.businessRegistrationNumber || "PV-00294812 (Demo)"}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Tax ID (TIN):</Text>
          <Text style={styles.detailCode}>{liveBusiness?.taxIdentifier || "TIN-10928472-0001"}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Verification Status:</Text>
          <Text style={styles.detailCode}>{liveBusiness?.verification?.status || liveBusiness?.status || "NOT_SUBMITTED"}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Public Liability Policy:</Text>
          <Text style={styles.detailCode}>POL-LUG-2026-9912</Text>
        </View>

        <View style={styles.decNoticeBox}>
          <Text style={styles.decNoticeText}>
            <Text style={styles.boldText}>Compliance Invariant (DEC-010):</Text> The records above
            are local testing fixtures. Production status requires authenticated municipal verification
            and AML/KYC checks during merchant settlement onboarding.
          </Text>
        </View>
      </View>

      {/* App Controls */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MobileIcon name="settings" size={18} color={mobileColors.navy[800]} />
          <Text style={styles.sectionTitle}>Prototype Session Controls</Text>
        </View>

        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
          <MobileIcon name="refresh" size={16} color={mobileColors.navy[800]} />
          <Text style={styles.resetBtnText}>Reset Demo State to Initial Defaults</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchSurfaceBtn}
          onPress={() => router.push("/")}
        >
          <MobileIcon name="arrow-left" size={16} color={mobileColors.terracotta[600]} />
          <Text style={styles.switchSurfaceBtnText}>Return to Role Select Home</Text>
        </TouchableOpacity>
      </View>

      {/* Honest Prototype Notice */}
      <View style={styles.prototypeNoticeCard}>
        <MobileIcon name="info" size={16} color={mobileColors.terracotta[600]} />
        <Text style={styles.prototypeNoticeText}>
          <Text style={styles.boldText}>Settings Prototype:</Text> Profile management operates
          on client session fixtures. Partner verification workflows will connect with Superadmin
          onboarding services in Phase 3+.
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
    lineHeight: 18
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
  sectionCard: {
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10
  },
  detailLabel: {
    fontSize: 12,
    color: mobileColors.navy[500],
    width: "40%"
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.navy[800],
    width: "58%",
    textAlign: "right"
  },
  detailCode: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.terracotta[600],
    fontFamily: "monospace",
    width: "58%",
    textAlign: "right"
  },
  teamMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4
  },
  avatarPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: mobileColors.navy[900],
    justifyContent: "center",
    alignItems: "center"
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14
  },
  teamTextCol: {
    flex: 1
  },
  memberName: {
    fontSize: 14,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  memberRole: {
    fontSize: 12,
    color: mobileColors.terracotta[600],
    fontWeight: "500",
    marginTop: 1
  },
  memberContact: {
    fontSize: 11,
    color: mobileColors.navy[500],
    marginTop: 2
  },
  teamDivider: {
    height: 1,
    backgroundColor: mobileColors.sand[200],
    marginVertical: 12
  },
  decNoticeBox: {
    backgroundColor: mobileColors.sand[100],
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  decNoticeText: {
    fontSize: 11,
    color: mobileColors.navy[600],
    lineHeight: 15
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileColors.sand[100],
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    gap: 8,
    marginBottom: 10
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.navy[800]
  },
  switchSurfaceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: mobileColors.terracotta[600],
    gap: 8
  },
  switchSurfaceBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.terracotta[600]
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
  },
  deniedContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  deniedCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center"
  },
  deniedBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#dc2626",
    textTransform: "uppercase",
    marginBottom: 8
  },
  deniedTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8
  },
  deniedBody: {
    fontSize: 13,
    color: "#475569",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20
  },
  returnDeskBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: "100%",
    alignItems: "center"
  },
  returnDeskBtnText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14
  }
});
